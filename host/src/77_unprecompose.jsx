
  /*
   * ae.unprecompose — распаковать прекомпы обратно в композицию (например, после импорта из Premiere).
   * args: {
   *   scope: "selected" | "all"   выделенные прекомп-слои или все прекомпы в активной композиции,
   *   recursive: true             распаковывать и вложенные прекомпы,
   *   removeLayer: true           удалить слой прекомпа (false — выключить),
   *   removeComps: true           удалить из проекта распакованные композиции, которые больше нигде не используются,
   *   holderName: "...", undoName
   * }
   * Время: слой встаёт туда, где он был виден (с учётом обрезки прекомпа).
   * Трансформация: если прекомп стоит «как есть» — без null; иначе слои вешаются на null с трансформацией
   * (и анимацией) прекомпа, прозрачность прекомпа переносится выражением.
   * Пропускаются: Time Remap, изменённая скорость, эффекты на слое прекомпа.
   */
  var TR_PROPS = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z"];

  function near(a, b) { return Math.abs(a - b) < 0.01; }

  // Прекомп ничего не меняет: точка привязки = позиция, масштаб 100, без поворота, без ключей и родителя.
  function isIdentity(pre) {
    var tr = pre.property("ADBE Transform Group");
    if (pre.parent || pre.threeDLayer) return false;
    for (var i = 0; i < TR_PROPS.length; i++) { var p = tr.property(TR_PROPS[i]); if (p.numKeys || hasExpression(p)) return false; }
    var a = tr.property("ADBE Anchor Point").value, p0 = tr.property("ADBE Position").value, s = tr.property("ADBE Scale").value;
    return near(a[0], p0[0]) && near(a[1], p0[1]) && near(s[0], 100) && near(s[1], 100) && near(tr.property("ADBE Rotate Z").value, 0);
  }

  function opacityIsFull(pre) {
    var o = pre.property("ADBE Transform Group").property("ADBE Opacity");
    return !o.numKeys && !hasExpression(o) && near(o.value, 100);
  }

  function effectCount(layer) { var fx = layer.property("ADBE Effect Parade"); return fx ? fx.numProperties : 0; }

  // Распаковать один прекомп-слой. Возвращает новые слои (для рекурсии) или null, если пропущен.
  function unpackOne(comp, pre, args, stat, tag) {
    if (pre.timeRemapEnabled) { stat.remap++; return null; }
    if (!near(pre.stretch, 100)) { stat.stretch++; return null; }
    if (effectCount(pre) > 0) { stat.effects++; return null; }
    var inner = pre.source, offset = pre.startTime, i;
    var needHolder = !isIdentity(pre), fade = !opacityIsFull(pre), holder = null;

    if (needHolder || fade) {
      holder = comp.layers.addNull(comp.duration);
      holder.name = (args.holderName || "Precomp") + " " + tag + ": " + pre.name;
      var ftr = pre.property("ADBE Transform Group"), htr = holder.property("ADBE Transform Group");
      var all = TR_PROPS.concat(["ADBE Opacity"]), bad = { n: 0 };
      for (i = 0; i < all.length; i++) copyProp(ftr.property(all[i]), htr.property(all[i]), bad);
      if (pre.parent) holder.parent = pre.parent;
      holder.inPoint = pre.inPoint; holder.outPoint = pre.outPoint;
      holder.moveBefore(pre);
    }

    var map = {}, made = [];
    for (i = 1; i <= inner.numLayers; i++) {
      var src = inner.layer(i);
      src.copyToComp(comp);
      var nl = comp.layer(1);
      nl.startTime = src.startTime + offset;
      var nin = Math.max(src.inPoint + offset, pre.inPoint), nout = Math.min(src.outPoint + offset, pre.outPoint);
      if (nin >= nout) { nl.remove(); stat.hidden++; continue; } // этот слой в прекомпе не был виден
      nl.inPoint = nin; nl.outPoint = nout;
      nl.moveBefore(holder || pre);
      map[src.index] = nl;
      made.push({ layer: nl, src: src });
    }
    // родители внутри прекомпа сохраняются, остальные цепляются к null
    for (i = 0; i < made.length; i++) {
      var L = made[i].layer, sp = made[i].src.parent;
      if (sp && map[sp.index]) L.parent = map[sp.index];
      else if (holder && needHolder) L.parent = holder;
      if (fade) {
        var op = L.property("ADBE Transform Group").property("ADBE Opacity");
        if (canChain(op)) chainExpression(op, "return value * thisComp.layer(" + quote(holder.name) + ").transform.opacity / 100;");
        else stat.foreign++;
      }
      try { if (pre.blendingMode !== BlendingMode.NORMAL && L.blendingMode === BlendingMode.NORMAL) L.blendingMode = pre.blendingMode; } catch (e) {}
    }
    if (args.removeLayer === false) pre.enabled = false; else pre.remove();
    stat.layers += made.length;
    stat.precomps++;
    stat.comps.push(inner);
    var out = [];
    for (i = 0; i < made.length; i++) out.push(made[i].layer);
    return out;
  }

  tools["ae.unprecompose"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var queue = [], i;
    var pool = args.scope === "all" ? [] : selectedLayers(comp);
    if (args.scope === "all") for (i = 1; i <= comp.numLayers; i++) pool.push(comp.layer(i));
    for (i = 0; i < pool.length; i++) if (pool[i].source instanceof CompItem && !pool[i].locked) queue.push(pool[i]);
    if (!queue.length) return fail("NO_PRECOMP");
    var stat = { precomps: 0, layers: 0, hidden: 0, remap: 0, stretch: 0, effects: 0, foreign: 0, removedComps: 0, comps: [] };
    undoable(args.undoName, function () {
      var depth = 0, n = 0;
      while (queue.length && depth < 6) {
        var next = [];
        for (var q = 0; q < queue.length; q++) {
          var made = unpackOne(comp, queue[q], args, stat, String(++n));
          if (made && args.recursive !== false) for (var k = 0; k < made.length; k++) if (made[k].source instanceof CompItem) next.push(made[k]);
        }
        queue = next; depth++;
      }
      if (args.removeComps !== false) {
        for (var c = 0; c < stat.comps.length; c++) {
          var it = stat.comps[c];
          try { if (it.usedIn.length === 0) { it.remove(); stat.removedComps++; } } catch (e) {} // уже удалена (повтор в списке)
        }
      }
    });
    stat.comps = [];
    if (!stat.precomps) return fail("NOTHING_UNPACKED", { skipped: { remap: stat.remap, stretch: stat.stretch, effects: stat.effects } });
    stat.ok = true;
    return stat;
  };

  // «Достать из прекомпа» — то же самое для выделенного, слой прекомпа выключается.
  tools["ae.extract"] = function (args) {
    var r = tools["ae.unprecompose"]({ scope: "selected", recursive: false, removeLayer: false, removeComps: false, holderName: args.holderName, undoName: args.undoName });
    if (r.ok) { r.changed = r.layers; r.from = ""; }
    return r;
  };
