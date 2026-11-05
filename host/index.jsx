/*
 * AE Assistant — ExtendScript-часть (выполняется внутри After Effects).
 * Синтаксис ES3: только var, без стрелочных функций, без JSON.
 * В этом файле — только ASCII. Русские тексты приходят из панели,
 * чтобы не зависеть от кодировки, в которой AE прочитает .jsx.
 *
 * Каждое действие: AEA.run("<tool>", {...}) -> JSON-строка
 *   { ok: true, ... } или { ok: false, code: "NO_COMP", ... }
 */
(function (global) {
  if (global.AEA && global.AEA.__version === "0.2.0") return;

  // ---------- JSON.stringify для ES3 ----------
  function quote(s) {
    return '"' + String(s).replace(/[\\"\u0000-\u001f\u007f-\uffff]/g, function (c) {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      var h = c.charCodeAt(0).toString(16);
      return "\\u" + "0000".substring(h.length) + h;
    }) + '"';
  }
  function stringify(v) {
    var i, out, k;
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(v) : "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return quote(v);
    if (v instanceof Array) {
      out = [];
      for (i = 0; i < v.length; i++) out.push(stringify(v[i]));
      return "[" + out.join(",") + "]";
    }
    out = [];
    for (k in v) if (v.hasOwnProperty(k)) out.push(quote(k) + ":" + stringify(v[k]));
    return "{" + out.join(",") + "}";
  }

  function fail(code, extra) {
    var r = { ok: false, code: code };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) r[k] = extra[k];
    return r;
  }

  function activeComp() {
    var item = app.project ? app.project.activeItem : null;
    return item && item instanceof CompItem ? item : null;
  }

  // ---------- Инструменты ----------
  var tools = {};

  tools["system.ping"] = function () {
    return { ok: true, appVersion: app.version, hasComp: activeComp() !== null };
  };

  /*
   * ae.animate — влёт/улёт выделенных слоёв.
   * args: {
   *   kind: "slide" | "fade" | "scale",
   *   mode: "in" | "out",
   *   direction: "left" | "right" | "up" | "down"   (только для slide),
   *   duration: 0.6, undoName: "..."
   * }
   * in:  t0 = CTI (за кадром / 0%) -> t1 = CTI + duration (текущее значение)
   * out: t0 = CTI (текущее значение) -> t1 = CTI + duration (за кадром / 0%)
   * Ease — настоящий KeyframeEase: влёт тормозит в конце, улёт разгоняется в начале.
   */
  var KINDS = { slide: 1, fade: 1, scale: 1 };
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

    app.beginUndoGroup(args.undoName || "AE Assistant");
    try {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.locked) { skipped.locked++; continue; }
        if (layer instanceof CameraLayer || layer instanceof LightLayer) { skipped.noPosition++; continue; }
        var tr = layer.property("ADBE Transform Group");
        if (!tr) { skipped.noPosition++; continue; }

        var target = targetFor(args, layer, tr, comp, t0);
        if (!target) { skipped.noPosition++; continue; }
        if (target.prop.expressionEnabled && target.prop.expression !== "") { skipped.expression++; continue; }

        var restVal = target.prop.valueAtTime(t0, true);
        var offVal = target.off(restVal);
        target.prop.setValueAtTime(t0, isIn ? offVal : restVal);
        target.prop.setValueAtTime(t1, isIn ? restVal : offVal);
        applyEase(target.prop, t0, t1, isIn);
        changed++;
      }
    } finally {
      app.endUndoGroup();
    }

    if (changed === 0) return fail("NOTHING_CHANGED", { skipped: skipped });
    return { ok: true, changed: changed, skipped: skipped, start: t0, end: t1 };
  };

  // Совместимость с панелью 0.1.0
  tools["ae.flyIn"] = function (args) {
    return tools["ae.animate"]({ kind: "slide", mode: "in", direction: args.direction, duration: args.duration, undoName: args.undoName });
  };

  // Какое свойство анимировать и как получить «спрятанное» значение из текущего.
  function targetFor(args, layer, tr, comp, t) {
    if (args.kind === "fade") {
      return { prop: tr.property("ADBE Opacity"), off: function () { return 0; } };
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

  // Bezier + KeyframeEase. Количество объектов ease берём из самого ключа
  // (1 для пространственных и 1D, 2/3 для TwoD/ThreeD — см. setTemporalEaseAtKey).
  function easeList(prop, k, influence) {
    var n = prop.keyInTemporalEase(k).length;
    var r = [];
    for (var d = 0; d < n; d++) r.push(new KeyframeEase(0, influence));
    return r;
  }
  function applyEase(prop, t0, t1, isIn) {
    var k0 = prop.nearestKeyIndex(t0);
    var k1 = prop.nearestKeyIndex(t1);
    var B = KeyframeInterpolationType.BEZIER;
    var startInf = isIn ? 15 : 85;
    var endInf = isIn ? 85 : 15;
    prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), B);
    prop.setInterpolationTypeAtKey(k1, B, prop.keyOutInterpolationType(k1));
    prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), easeList(prop, k0, startInf));
    prop.setTemporalEaseAtKey(k1, easeList(prop, k1, endInf), prop.keyOutTemporalEase(k1));
  }

  // ---------- Точка входа ----------
  global.AEA = {
    __version: "0.2.0",
    run: function (name, args) {
      try {
        var fn = tools[name];
        if (!fn) return stringify(fail("UNKNOWN_TOOL", { tool: name }));
        return stringify(fn(args || {}));
      } catch (e) {
        return stringify(fail("EXCEPTION", { message: String(e), line: e.line }));
      }
    }
  };
})($.global);
