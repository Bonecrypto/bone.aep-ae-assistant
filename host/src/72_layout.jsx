
  /*
   * Раскладка слоёв (как в Motion от Mt. Mograph):
   *   ae.anchor     — точка привязки по сетке 3x3 без сдвига слоя
   *   ae.align      — выровнять по краям/центру композиции или выделения
   *   ae.distribute — распределить центры равномерно
   * Границы считаются по sourceRectAtTime с учётом масштаба и поворота. Для слоёв с родителем
   * и 3D-слоёв — приближённо (без учёта родителя и камеры).
   */
  function rot2(x, y, deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }

  // Сдвинуть позицию слоя на [dx, dy] (вместе со всеми её ключами).
  function shiftPosition(tr, dx, dy) {
    var pos = tr.property("ADBE Position"), k;
    if (pos.dimensionsSeparated) {
      var px = tr.property("ADBE Position_0"), py = tr.property("ADBE Position_1");
      if (px.numKeys) for (k = 1; k <= px.numKeys; k++) px.setValueAtKey(k, px.keyValue(k) + dx); else px.setValue(px.value + dx);
      if (py.numKeys) for (k = 1; k <= py.numKeys; k++) py.setValueAtKey(k, py.keyValue(k) + dy); else py.setValue(py.value + dy);
      return;
    }
    var move = function (v) { var r = copyArr(v); r[0] += dx; r[1] += dy; return r; };
    if (pos.numKeys) for (k = 1; k <= pos.numKeys; k++) pos.setValueAtKey(k, move(pos.keyValue(k)));
    else pos.setValue(move(pos.value));
  }

  // Границы слоя в координатах композиции (без учёта родителя).
  function compBounds(layer, t) {
    var tr = layer.property("ADBE Transform Group");
    var r = layer.sourceRectAtTime(t, false);
    var a = tr.property("ADBE Anchor Point").valueAtTime(t, false);
    var s = tr.property("ADBE Scale").valueAtTime(t, false);
    var p = tr.property("ADBE Position").valueAtTime(t, false);
    var rot = tr.property("ADBE Rotate Z").valueAtTime(t, false);
    var xs = [], ys = [], cs = [[r.left, r.top], [r.left + r.width, r.top], [r.left, r.top + r.height], [r.left + r.width, r.top + r.height]];
    for (var i = 0; i < 4; i++) {
      var q = rot2((cs[i][0] - a[0]) * s[0] / 100, (cs[i][1] - a[1]) * s[1] / 100, rot);
      xs.push(p[0] + q[0]); ys.push(p[1] + q[1]);
    }
    var mn = function (v) { var m = v[0]; for (var j = 1; j < v.length; j++) if (v[j] < m) m = v[j]; return m; };
    var mx = function (v) { var m = v[0]; for (var j = 1; j < v.length; j++) if (v[j] > m) m = v[j]; return m; };
    return { left: mn(xs), right: mx(xs), top: mn(ys), bottom: mx(ys) };
  }

  function movable(layer) {
    return !layer.locked && !(layer instanceof CameraLayer) && !(layer instanceof LightLayer) && layer.property("ADBE Transform Group");
  }

  tools["ae.anchor"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var changed = 0, keyed = 0, t = comp.time;
    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!movable(L)) continue;
        var tr = L.property("ADBE Transform Group"), ap = tr.property("ADBE Anchor Point");
        if (ap.numKeys || hasExpression(ap)) { keyed++; continue; }
        var r = L.sourceRectAtTime(t, false), a = ap.value;
        var na = [r.left + r.width * args.x, r.top + r.height * args.y];
        var s = tr.property("ADBE Scale").valueAtTime(t, false), rot = tr.property("ADBE Rotate Z").valueAtTime(t, false);
        var d = rot2((na[0] - a[0]) * s[0] / 100, (na[1] - a[1]) * s[1] / 100, rot);
        var nv = copyArr(a); nv[0] = na[0]; nv[1] = na[1];
        ap.setValue(nv);
        shiftPosition(tr, d[0], d[1]);
        changed++;
      }
    });
    if (!changed) return fail(keyed ? "ANCHOR_KEYED" : "NOTHING_CHANGED", { skipped: { other: keyed } });
    return { ok: true, changed: changed, keyed: keyed };
  };

  tools["ae.align"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = [], all = selectedLayers(comp), i;
    for (i = 0; i < all.length; i++) if (movable(all[i])) layers.push(all[i]);
    if (!layers.length) return fail("NO_SELECTION");
    var t = comp.time, bs = [];
    for (i = 0; i < layers.length; i++) bs.push(compBounds(layers[i], t));
    // цель: кадр композиции или общие границы выделения (для одного слоя — всегда кадр)
    var box = { left: 0, top: 0, right: comp.width, bottom: comp.height };
    if (args.to === "selection" && layers.length > 1) {
      box = { left: bs[0].left, top: bs[0].top, right: bs[0].right, bottom: bs[0].bottom };
      for (i = 1; i < bs.length; i++) {
        if (bs[i].left < box.left) box.left = bs[i].left; if (bs[i].top < box.top) box.top = bs[i].top;
        if (bs[i].right > box.right) box.right = bs[i].right; if (bs[i].bottom > box.bottom) box.bottom = bs[i].bottom;
      }
    }
    undoable(args.undoName, function () {
      for (i = 0; i < layers.length; i++) {
        var b = bs[i], dx = 0, dy = 0, m = args.mode;
        if (m === "left") dx = box.left - b.left;
        if (m === "right") dx = box.right - b.right;
        if (m === "hcenter" || m === "center") dx = (box.left + box.right) / 2 - (b.left + b.right) / 2;
        if (m === "top") dy = box.top - b.top;
        if (m === "bottom") dy = box.bottom - b.bottom;
        if (m === "vcenter" || m === "center") dy = (box.top + box.bottom) / 2 - (b.top + b.bottom) / 2;
        shiftPosition(layers[i].property("ADBE Transform Group"), dx, dy);
      }
    });
    return { ok: true, changed: layers.length };
  };

  tools["ae.distribute"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var items = [], all = selectedLayers(comp), i, t = comp.time, h = args.axis !== "y";
    for (i = 0; i < all.length; i++) if (movable(all[i])) { var b = compBounds(all[i], t); items.push({ l: all[i], c: h ? (b.left + b.right) / 2 : (b.top + b.bottom) / 2 }); }
    if (items.length < 3) return fail("NEED_THREE_LAYERS");
    items.sort(function (a, b) { return a.c - b.c; });
    var first = items[0].c, step = (items[items.length - 1].c - first) / (items.length - 1);
    undoable(args.undoName, function () {
      for (var k = 1; k < items.length - 1; k++) {
        var d = first + step * k - items[k].c;
        shiftPosition(items[k].l.property("ADBE Transform Group"), h ? d : 0, h ? 0 : d);
      }
    });
    return { ok: true, changed: items.length };
  };
