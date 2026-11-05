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
  if (global.AEA && global.AEA.__version === "0.1.0") return;

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
   * ae.flyIn — влёт выделенных слоёв из-за края кадра.
   * args: { direction: "left", duration: 0.6, undoName: "..." }
   * Ключи ставятся от текущего времени (CTI): t0 = за кадром, t1 = текущая позиция.
   * Ease — настоящий KeyframeEase (быстрый старт, мягкая остановка).
   */
  tools["ae.flyIn"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = comp.selectedLayers;
    if (!layers || layers.length === 0) return fail("NO_SELECTION");
    if (args.direction !== "left") return fail("BAD_ARGS", { field: "direction" });

    var duration = args.duration > 0 ? args.duration : 0.6;
    var margin = 20;
    var t0 = comp.time;
    var t1 = t0 + duration;
    var changed = 0;
    var skipped = { locked: 0, noPosition: 0, expression: 0 };

    app.beginUndoGroup(args.undoName || "AE Assistant");
    try {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.locked) { skipped.locked++; continue; }
        if (layer instanceof CameraLayer || layer instanceof LightLayer) { skipped.noPosition++; continue; }

        var tr = layer.property("ADBE Transform Group");
        var pos = tr ? tr.property("ADBE Position") : null;
        if (!pos) { skipped.noPosition++; continue; }

        var sep = pos.dimensionsSeparated;
        var xProp = sep ? tr.property("ADBE Position_0") : pos;
        if (xProp.expressionEnabled && xProp.expression !== "") { skipped.expression++; continue; }

        var endVal = xProp.valueAtTime(t0, true);
        var endX = sep ? endVal : endVal[0];
        var startX = offscreenLeftX(layer, tr, comp, t0, endX, margin);

        var startVal;
        if (sep) {
          startVal = startX;
        } else {
          startVal = [];
          for (var d = 0; d < endVal.length; d++) startVal.push(endVal[d]);
          startVal[0] = startX;
        }

        xProp.setValueAtTime(t0, startVal);
        xProp.setValueAtTime(t1, endVal);

        var k0 = xProp.nearestKeyIndex(t0);
        var k1 = xProp.nearestKeyIndex(t1);
        var B = KeyframeInterpolationType.BEZIER;
        xProp.setInterpolationTypeAtKey(k0, xProp.keyInInterpolationType(k0), B);
        xProp.setInterpolationTypeAtKey(k1, B, xProp.keyOutInterpolationType(k1));
        // Позиция (и X Position) — одна KeyframeEase на ключ.
        xProp.setTemporalEaseAtKey(k0, xProp.keyInTemporalEase(k0), [new KeyframeEase(0, 15)]);
        xProp.setTemporalEaseAtKey(k1, [new KeyframeEase(0, 85)], xProp.keyOutTemporalEase(k1));
        changed++;
      }
    } finally {
      app.endUndoGroup();
    }

    if (changed === 0) return fail("NOTHING_CHANGED", { skipped: skipped });
    return { ok: true, changed: changed, skipped: skipped, start: t0, end: t1 };
  };

  // X позиции, при которой правый край слоя оказывается левее кадра.
  function offscreenLeftX(layer, tr, comp, t, endX, margin) {
    var fallback = endX - (comp.width + margin);
    if (layer.parent !== null || layer.threeDLayer) return fallback;
    try {
      var rect = layer.sourceRectAtTime(t, false);
      var anchor = tr.property("ADBE Anchor Point").valueAtTime(t, false);
      var scale = tr.property("ADBE Scale").valueAtTime(t, false);
      var rot = tr.property("ADBE Rotate Z").valueAtTime(t, false);
      if (rot % 360 !== 0) return fallback;
      var sx = scale[0] / 100;
      var a = (rect.left - anchor[0]) * sx;
      var b = (rect.left + rect.width - anchor[0]) * sx;
      var right = a > b ? a : b;
      var x = -margin - right;
      return x < endX ? x : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // ---------- Точка входа ----------
  global.AEA = {
    __version: "0.1.0",
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
