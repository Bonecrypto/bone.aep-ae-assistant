
  /*
   * Инструменты в духе Motion Tools:
   *   ae.quickEase   — influence входа/выхода прямо на выделенные ключи (можно на одиночный ключ)
   *   ae.cloneKeys   — копия выделенных ключей в текущее время (с теми же интервалами и ease)
   *   ae.extract     — достать слои из выделенного прекомпа обратно в композицию, на тех же местах
   *   ae.toShapes    — текст / Illustrator-слой -> шейпы (команда меню AE)
   */
  tools["ae.quickEase"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var props = selectedProps(layers), keys = 0, B = KeyframeInterpolationType.BEZIER;
    var doIn = args.which !== "out", doOut = args.which !== "in";
    undoable(args.undoName, function () {
      for (var i = 0; i < props.length; i++) {
        var p = props[i].prop, sel = p.selectedKeys;
        if (!p.canVaryOverTime || !sel.length) continue;
        var n = easeDims(p);
        for (var j = 0; j < sel.length; j++) {
          var k = sel[j];
          var inE = doIn ? easeList(n, 0, args.inInfluence) : p.keyInTemporalEase(k);
          var outE = doOut ? easeList(n, 0, args.outInfluence) : p.keyOutTemporalEase(k);
          p.setTemporalEaseAtKey(k, inE, outE);
          p.setInterpolationTypeAtKey(k, doIn ? B : p.keyInInterpolationType(k), doOut ? B : p.keyOutInterpolationType(k));
          keys++;
        }
      }
    });
    if (!keys) return fail("NO_KEYS_SELECTED");
    return { ok: true, changed: keys };
  };

  tools["ae.cloneKeys"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var props = selectedProps(layers), keys = 0, i, j, t0 = null;
    // общее начало: самый ранний выделенный ключ среди всех свойств — чтобы сохранить взаимное расположение
    for (i = 0; i < props.length; i++) {
      var sk = props[i].prop.selectedKeys;
      for (j = 0; j < sk.length; j++) { var kt = props[i].prop.keyTime(sk[j]); if (t0 === null || kt < t0) t0 = kt; }
    }
    if (t0 === null) return fail("NO_KEYS_SELECTED");
    var shift = comp.time - t0;
    undoable(args.undoName, function () {
      for (i = 0; i < props.length; i++) {
        var p = props[i].prop, sel = p.selectedKeys, copy = [];
        for (j = 0; j < sel.length; j++) {
          var k = sel[j];
          copy.push({ t: p.keyTime(k) + shift, v: p.keyValue(k), inI: p.keyInInterpolationType(k), outI: p.keyOutInterpolationType(k),
            inE: p.keyInTemporalEase(k), outE: p.keyOutTemporalEase(k) });
        }
        for (j = 0; j < copy.length; j++) {
          var c = copy[j];
          p.setValueAtTime(c.t, c.v);
          var n = p.nearestKeyIndex(c.t);
          p.setTemporalEaseAtKey(n, c.inE, c.outE);
          p.setInterpolationTypeAtKey(n, c.inI, c.outI);
          keys++;
        }
      }
    });
    return { ok: true, changed: keys };
  };

  tools["ae.extract"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var sel = selectedLayers(comp), pre = null, i;
    for (i = 0; i < sel.length; i++) if (sel[i].source instanceof CompItem) { pre = sel[i]; break; }
    if (!pre) return fail("NO_PRECOMP");
    var inner = pre.source, made = 0;
    undoable(args.undoName, function () {
      // null повторяет трансформацию прекомпа: слои сохраняют вид в кадре
      var tr = pre.property("ADBE Transform Group"), holder = comp.layers.addNull(comp.duration);
      holder.name = pre.name;
      var copyT = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity"];
      for (var c = 0; c < copyT.length; c++) {
        var from = tr.property(copyT[c]), to = holder.property("ADBE Transform Group").property(copyT[c]);
        if (from && to && !from.numKeys) { try { to.setValue(from.value); } catch (e) {} }
      }
      holder.moveBefore(pre);
      var copies = [];
      for (i = inner.numLayers; i >= 1; i--) {
        inner.layer(i).copyToComp(comp);
        var nl = comp.layer(1);
        nl.startTime = nl.startTime + pre.startTime;
        copies.push(nl);
      }
      for (i = copies.length - 1; i >= 0; i--) {
        copies[i].moveBefore(holder);
        if (!copies[i].parent) copies[i].parent = holder; // без «прыжка»: координаты прекомпа = пространство null
        made++;
      }
      pre.enabled = false;
    });
    return { ok: true, changed: made, from: pre.name };
  };

  tools["ae.toShapes"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var sel = selectedLayers(comp);
    if (!sel.length) return fail("NO_SELECTION");
    var hasText = false, i;
    for (i = 0; i < sel.length; i++) if (sel[i] instanceof TextLayer) hasText = true;
    var name = hasText ? "Create Shapes from Text" : "Create Shapes from Vector Layer";
    var id = 0;
    try { id = app.findMenuCommandId(name); } catch (e) {}
    if (!id) id = hasText ? 3781 : 3973; // известные ID команд, если меню AE на другом языке
    var before = comp.numLayers;
    undoable(args.undoName, function () { app.executeCommand(id); });
    var made = comp.numLayers - before;
    if (made <= 0) return fail("COMMAND_FAILED", { command: name });
    return { ok: true, changed: made };
  };
