  /*
   * My animations (like saved presets in Animation Composer).
   * ae.animCapture - snapshot of the first selected layer: animated transform props,
   *   effects (all params), text animators, layer markers. Times are relative to the layer.
   * ae.animApply - recreate the snapshot on every selected layer.
   *   args: { anim, at: "layer"|"playhead", relative: bool (position as offset), undoName }
   */
  var ANIM_INDEXED = { "ADBE Effect Parade": 1, "ADBE Text Animators": 1, "ADBE Text Selectors": 1, "ADBE Text Animator Properties": 1 };
  var ANIM_POS = { "ADBE Position": 1, "ADBE Position_0": 1, "ADBE Position_1": 1, "ADBE Position_2": 1 };

  function animValueOk(p) {
    var t = p.propertyValueType;
    return t !== PropertyValueType.NO_VALUE && t !== PropertyValueType.TEXT_DOCUMENT && t !== PropertyValueType.SHAPE &&
      (PropertyValueType.CUSTOM_VALUE === undefined || t !== PropertyValueType.CUSTOM_VALUE) &&
      (PropertyValueType.MARKER === undefined || t !== PropertyValueType.MARKER);
  }
  function animSpatial(p) { return p.propertyValueType === PropertyValueType.TwoD_SPATIAL || p.propertyValueType === PropertyValueType.ThreeD_SPATIAL; }
  function animEaseSave(list) { var r = []; for (var i = 0; i < list.length; i++) r.push([list[i].speed, list[i].influence]); return r; }
  function animEaseLoad(list) { var r = []; for (var i = 0; i < list.length; i++) r.push(new KeyframeEase(list[i][0], clamp(list[i][1], 0.1, 100))); return r; }

  // st = { t0: layer.inPoint, keys, props }; onlyAnimated - transform: skip static props
  function capProp(p, st, onlyAnimated) {
    if (!animValueOk(p)) return null;
    var hasX = false, n = { i: p.propertyIndex, m: p.matchName };
    try { hasX = p.canSetExpression && p.expression !== ""; } catch (e) {}
    if (onlyAnimated && !p.numKeys && !hasX) return null;
    if (hasX) { n.x = p.expression; n.xe = p.expressionEnabled; }
    if (p.numKeys) {
      n.k = [];
      for (var k = 1; k <= p.numKeys; k++) {
        var key = { t: p.keyTime(k) - st.t0, v: copyArr(p.keyValue(k)) };
        try { key.ii = p.keyInInterpolationType(k); key.oi = p.keyOutInterpolationType(k); } catch (e1) {}
        try { key.ie = animEaseSave(p.keyInTemporalEase(k)); key.oe = animEaseSave(p.keyOutTemporalEase(k)); } catch (e2) {}
        if (animSpatial(p)) try { key.is = copyArr(p.keyInSpatialTangent(k)); key.os = copyArr(p.keyOutSpatialTangent(k)); } catch (e3) {}
        try { key.ab = p.keyTemporalAutoBezier(k); key.tc = p.keyTemporalContinuous(k); } catch (e4) {}
        n.k.push(key); st.keys++;
      }
    } else {
      try { n.v = copyArr(p.value); } catch (e5) { return hasX ? n : null; }
    }
    st.props++;
    return n;
  }

  function capGroup(g, st, onlyAnimated) {
    var n = { i: g.propertyIndex, m: g.matchName, nm: g.name, c: [] };
    try { if (g.enabled === false) n.en = false; } catch (e) {}
    for (var i = 1; i <= g.numProperties; i++) {
      var p = g.property(i), c = null;
      if (p.propertyType === PropertyType.PROPERTY) c = capProp(p, st, onlyAnimated);
      else c = capGroup(p, st, onlyAnimated);
      if (c && (c.c === undefined || c.c.length || ANIM_INDEXED[g.matchName])) { if (ANIM_INDEXED[g.matchName]) c.add = 1; n.c.push(c); }
    }
    return n;
  }

  tools["ae.animCapture"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp).sort(function (a, b) { return a.index - b.index; });
    if (!layers.length) return fail("NO_SELECTION");
    var L = layers[0], st = { t0: L.inPoint, keys: 0, props: 0 }, groups = [];
    var tr = L.property("ADBE Transform Group");
    var trn = capGroup(tr, st, true);
    try { trn.sep = tr.property("ADBE Position").dimensionsSeparated; } catch (e) {}
    if (trn.c.length) groups.push(trn);
    var effects = 0, animators = 0;
    if (args.effects !== false) {
      var fx = L.property("ADBE Effect Parade");
      if (fx && fx.numProperties) { var f = capGroup(fx, st, false); effects = f.c.length; groups.push(f); }
    }
    var tp = L.property("ADBE Text Properties");
    if (tp) {
      var ta = tp.property("ADBE Text Animators");
      if (ta && ta.numProperties) { var a = capGroup(ta, st, false); a.text = 1; animators = a.c.length; groups.push(a); }
    }
    var markers = [], mp = L.property("ADBE Marker");
    for (var k = 1; k <= mp.numKeys; k++) {
      var mv = mp.keyValue(k), t = mp.keyTime(k);
      var out = mv.comment === "TR Out"; // строка
      markers.push({ c: mv.comment, d: mv.duration, edge: out ? "out" : "in", t: out ? t - L.outPoint : t - L.inPoint });
    }
    if (!groups.length && !markers.length) return fail("NOTHING_TO_SAVE");
    return { ok: true, anim: { v: 1, from: L.name, text: !!tp, groups: groups, markers: markers,
      stats: { props: st.props, keys: st.keys, effects: effects, animators: animators, markers: markers.length } } };
  };

  function findChild(g, n) {
    var p = null;
    try { p = g.property(n.i); } catch (e) {}
    if (p && p.matchName === n.m) return p;
    try { return g.property(n.m); } catch (e2) { return null; }
  }

  // ctx = { shift, base: {matchName: [srcBase, dstValue]}, fails }
  function putProp(p, n, ctx) {
    try {
      if (n.k) {
        for (var r = p.numKeys; r >= 1; r--) p.removeKey(r);
        var rel = ctx.relative && ANIM_POS[n.m], d = null;
        if (rel) { var b0 = n.k[0].v, now = p.valueAtTime(ctx.now, false); d = n.k.length ? [b0, now] : null; }
        for (var k = 0; k < n.k.length; k++) {
          var v = n.k[k].v;
          if (d) v = (v instanceof Array) ? (function (a, b, c) { var o = []; for (var j = 0; j < a.length; j++) o.push(c[j] + a[j] - b[j]); return o; })(v, d[0], d[1]) : d[1] + v - d[0];
          p.setValueAtTime(ctx.shift + n.k[k].t, v);
        }
        for (var q = 0; q < n.k.length; q++) {
          var key = n.k[q], idx = q + 1;
          try { if (key.ie) p.setTemporalEaseAtKey(idx, animEaseLoad(key.ie), animEaseLoad(key.oe)); } catch (e1) {}
          try { if (key.ii) p.setInterpolationTypeAtKey(idx, key.ii, key.oi); } catch (e2) {}
          try { if (key.is) p.setSpatialTangentsAtKey(idx, key.is, key.os); } catch (e3) {}
          try { if (key.ab !== undefined) { p.setTemporalContinuousAtKey(idx, key.tc); p.setTemporalAutoBezierAtKey(idx, key.ab); } } catch (e4) {}
        }
      } else if (n.v !== undefined) {
        if (p.numKeys) for (var r2 = p.numKeys; r2 >= 1; r2--) p.removeKey(r2);
        p.setValue(n.v);
      }
      if (n.x !== undefined && p.canSetExpression) { p.expression = n.x; p.expressionEnabled = n.xe !== false; }
    } catch (e) { ctx.fails++; }
  }

  function putGroup(g, n, ctx) {
    for (var i = 0; i < n.c.length; i++) {
      var c = n.c[i], p = null;
      if (c.add) {
        try { p = g.canAddProperty(c.m) ? g.addProperty(c.m) : null; } catch (e) { p = null; }
        if (p) { try { if (c.nm) p.name = c.nm; } catch (e1) {} try { if (c.en === false) p.enabled = false; } catch (e2) {} }
      } else p = findChild(g, c);
      if (!p) { ctx.fails++; continue; }
      if (c.c) putGroup(p, c, ctx); else putProp(p, c, ctx);
    }
  }

  function minKeyTime(n, m) {
    if (n.k) for (var k = 0; k < n.k.length; k++) if (m.v === null || n.k[k].t < m.v) m.v = n.k[k].t;
    if (n.c) for (var i = 0; i < n.c.length; i++) minKeyTime(n.c[i], m);
  }

  tools["ae.animApply"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp), A = args.anim;
    if (!layers.length) return fail("NO_SELECTION");
    if (!A || !A.groups) return fail("BAD_ARGS");
    var first = { v: null };
    for (var g = 0; g < A.groups.length; g++) minKeyTime(A.groups[g], first);
    var changed = 0, notText = 0, locked = 0, fails = 0;
    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (L.locked) { locked++; continue; }
        var shift = args.at === "playhead" ? comp.time - (first.v === null ? 0 : first.v) : L.inPoint;
        var ctx = { shift: shift, now: comp.time, relative: args.relative !== false, fails: 0 };
        var tp = L.property("ADBE Text Properties"), did = false;
        for (var j = 0; j < A.groups.length; j++) {
          var n = A.groups[j], target = null;
          if (n.text) { if (!tp) { notText++; continue; } target = tp.property("ADBE Text Animators"); }
          else target = L.property(n.m);
          if (!target) continue;
          if (n.m === "ADBE Transform Group" && n.sep) {
            for (var c = 0; c < n.c.length; c++) if (ANIM_POS[n.c[c].m] && n.c[c].m !== "ADBE Position") { try { target.property("ADBE Position").dimensionsSeparated = true; } catch (e) {} break; }
          }
          putGroup(target, n, ctx); did = true;
        }
        var ms = A.markers || [];
        for (var m = 0; m < ms.length; m++) {
          var t = ms[m].edge === "out" ? L.outPoint + ms[m].t : (args.at === "playhead" && ms[m].c !== "TR In" ? ctx.shift + ms[m].t : L.inPoint + ms[m].t); // строка
          if (ms[m].d > 0) { if (!hasMarker(L, ms[m].c)) addLayerMarker(L, t, ms[m].d, ms[m].c); }
          else ensurePointMarker(L, t, ms[m].c);
          did = true;
        }
        fails += ctx.fails;
        if (did) changed++;
      }
    });
    if (!changed) return fail("NOTHING_CHANGED", { skipped: { locked: locked, notText: notText } });
    return { ok: true, changed: changed, notText: notText, locked: locked, fails: fails };
  };

  function hasMarker(L, comment) {
    var mp = L.property("ADBE Marker");
    for (var k = 1; k <= mp.numKeys; k++) if (mp.keyValue(k).comment === comment) return true;
    return false;
  }
