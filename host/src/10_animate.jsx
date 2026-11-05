  /*
   * ae.animate — влёт/улёт выделенных слоёв.
   * args: {
   *   kind: "slide" | "fade" | "scale" | "rotate",
   *   spring: false,  — пружина: перелёт за конечное значение и возврат (только для влёта, кроме fade)
   *   mode: "in" | "out",
   *   direction: "left" | "right" | "up" | "down"   (только для slide),
   *   duration: 0.6, undoName: "..."
   * }
   * in:  t0 = CTI (за кадром / 0%) -> t1 = CTI + duration (текущее значение)
   * out: t0 = CTI (текущее значение) -> t1 = CTI + duration (за кадром / 0%)
   * Ease — настоящий KeyframeEase: влёт тормозит в конце, улёт разгоняется в начале.
   */
  var KINDS = { slide: 1, fade: 1, scale: 1, rotate: 1 };
  var DIRS = { left: 1, right: 1, up: 1, down: 1 };

  tools["ae.animate"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = comp.selectedLayers;
    if (!layers || layers.length === 0) return fail("NO_SELECTION");
    if (!KINDS[args.kind]) return fail("BAD_ARGS", { field: "kind" });
    if (args.mode !== "in" && args.mode !== "out") return fail("BAD_ARGS", { field: "mode" });
    if (args.kind === "slide" && !DIRS[args.direction]) return fail("BAD_ARGS", { field: "direction" });

    var duration = args.duration > 0 ? args.duration : 0.6;
    var t0 = comp.time;
    var t1 = t0 + duration;
    var isIn = args.mode === "in";
    var changed = 0;
    var skipped = { locked: 0, noPosition: 0, expression: 0 };

    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.locked) { skipped.locked++; continue; }
        if (layer instanceof CameraLayer || layer instanceof LightLayer) { skipped.noPosition++; continue; }
        var tr = layer.property("ADBE Transform Group");
        if (!tr) { skipped.noPosition++; continue; }

        var target = targetFor(args, layer, tr, comp, t0);
        if (!target) { skipped.noPosition++; continue; }
        if (hasExpression(target.prop)) { skipped.expression++; continue; }

        var restVal = target.prop.valueAtTime(t0, true);
        var offVal = target.off(restVal);
        if (args.spring && isIn && args.kind !== "fade") {
          springKeys(target.prop, t0, t1, offVal, restVal, args.kind === "scale" ? 0.12 : 0.07);
        } else {
          keyPair(target.prop, t0, t1, isIn ? offVal : restVal, isIn ? restVal : offVal, isIn ? 15 : 85, isIn ? 85 : 15);
        }
        changed++;
      }
    });

    if (changed === 0) return fail("NOTHING_CHANGED", { skipped: skipped });
    return { ok: true, changed: changed, skipped: skipped, start: t0, end: t1 };
  };

  // Совместимость с панелью 0.1.0
  tools["ae.flyIn"] = function (args) {
    return tools["ae.animate"]({ kind: "slide", mode: "in", direction: args.direction, duration: args.duration, undoName: args.undoName });
  };

  // Пружина: off -> перелёт на amount за rest -> rest. Ease на каждом ключе.
  function lerp(a, b, k) {
    if (!(a instanceof Array)) return a + (b - a) * k;
    var r = [];
    for (var i = 0; i < a.length; i++) r.push(a[i] + (b[i] - a[i]) * k);
    return r;
  }
  function springKeys(prop, t0, t1, off, rest, amount) {
    var tm = t0 + (t1 - t0) * 0.6;
    prop.setValueAtTime(t0, off);
    prop.setValueAtTime(tm, lerp(off, rest, 1 + amount));
    prop.setValueAtTime(t1, rest);
    var n = easeDims(prop), B = KeyframeInterpolationType.BEZIER;
    var k0 = prop.nearestKeyIndex(t0), km = prop.nearestKeyIndex(tm), k1 = prop.nearestKeyIndex(t1);
    prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), B);
    prop.setInterpolationTypeAtKey(km, B, B);
    prop.setInterpolationTypeAtKey(k1, B, prop.keyOutInterpolationType(k1));
    prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), easeList(n, 0, 20));
    prop.setTemporalEaseAtKey(km, easeList(n, 0, 75), easeList(n, 0, 50));
    prop.setTemporalEaseAtKey(k1, easeList(n, 0, 70), prop.keyOutTemporalEase(k1));
  }

  // Моушн-блюр: включить/выключить у выделенных слоёв и в композиции.
  tools["ae.motionBlur"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var on = args.on !== false, changed = 0;
    undoable(args.undoName, function () {
      if (on) comp.motionBlur = true;
      for (var i = 0; i < layers.length; i++) {
        if (layers[i].locked || layers[i] instanceof CameraLayer || layers[i] instanceof LightLayer) continue;
        layers[i].motionBlur = on;
        changed++;
      }
    });
    return { ok: true, changed: changed, on: on };
  };

  // Какое свойство анимировать и как получить «спрятанное» значение из текущего.
  function targetFor(args, layer, tr, comp, t) {
    if (args.kind === "fade") {
      return { prop: tr.property("ADBE Opacity"), off: function () { return 0; } };
    }
    if (args.kind === "rotate") {
      return { prop: tr.property("ADBE Rotate Z"), off: function (v) { return v + (args.mode === "in" ? -90 : 90); } };
    }
    if (args.kind === "scale") {
      return { prop: tr.property("ADBE Scale"), off: function (v) {
        var r = []; for (var d = 0; d < v.length; d++) r.push(0); return r;
      } };
    }
    var pos = tr.property("ADBE Position");
    if (!pos) return null;
    var horizontal = args.direction === "left" || args.direction === "right";
    var axis = horizontal ? 0 : 1;
    var sep = pos.dimensionsSeparated;
    var prop = sep ? tr.property(horizontal ? "ADBE Position_0" : "ADBE Position_1") : pos;
    return { prop: prop, off: function (v) {
      var cur = sep ? v : v[axis];
      var hidden = offscreen(layer, tr, comp, t, args.direction, cur);
      if (sep) return hidden;
      var r = []; for (var d = 0; d < v.length; d++) r.push(v[d]);
      r[axis] = hidden;
      return r;
    } };
  }

  // Координата по оси, при которой слой целиком уходит за край кадра.
  function offscreen(layer, tr, comp, t, dir, cur) {
    var margin = 20;
    var size = dir === "left" || dir === "right" ? comp.width : comp.height;
    var sign = dir === "left" || dir === "up" ? -1 : 1;
    var fallback = cur + sign * (size + margin);
    if (layer.parent !== null || layer.threeDLayer) return fallback;
    try {
      var rot = tr.property("ADBE Rotate Z").valueAtTime(t, false);
      if (rot % 360 !== 0) return fallback;
      var rect = layer.sourceRectAtTime(t, false);
      var anchor = tr.property("ADBE Anchor Point").valueAtTime(t, false);
      var scale = tr.property("ADBE Scale").valueAtTime(t, false);
      var axis = dir === "left" || dir === "right" ? 0 : 1;
      var start = axis === 0 ? rect.left : rect.top;
      var len = axis === 0 ? rect.width : rect.height;
      var k = scale[axis] / 100;
      var a = (start - anchor[axis]) * k;
      var b = (start + len - anchor[axis]) * k;
      var lo = a < b ? a : b;
      var hi = a < b ? b : a;
      var v = sign < 0 ? -margin - hi : size + margin - lo;
      return (sign < 0 ? v < cur : v > cur) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

