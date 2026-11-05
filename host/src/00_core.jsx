/*
 * AE Assistant — ExtendScript-часть (выполняется внутри After Effects).
 * Файлы host/src/*.jsx склеиваются по порядку имён в один dist/.../host/index.jsx.
 * Синтаксис ES3: только var, без стрелочных функций, без JSON.
 * В коде — только ASCII. Русские тексты (undo, имена слоёв) приходят из панели.
 *
 * Вызов: AEA.run("<tool>", {...}) -> JSON-строка { ok: true, ... } | { ok: false, code: "..." }
 */
(function (global) {
  var VERSION = "__AEA_VERSION__";
  if (global.AEA && global.AEA.__version === VERSION) return;

  var tools = {};

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

  // ---------- Общие помощники ----------
  function fail(code, extra) {
    var r = { ok: false, code: code };
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) r[k] = extra[k];
    return r;
  }

  function activeComp() {
    var item = app.project ? app.project.activeItem : null;
    return item && item instanceof CompItem ? item : null;
  }

  function selectedLayers(comp) {
    var r = [], s = comp.selectedLayers;
    for (var i = 0; i < s.length; i++) r.push(s[i]);
    return r;
  }

  // Одно действие = одна undo-группа, закрывается даже при ошибке.
  function undoable(name, fn) {
    app.beginUndoGroup(name || "AE Assistant");
    try { return fn(); } finally { app.endUndoGroup(); }
  }

  function copyArr(v) {
    if (!(v instanceof Array)) return v;
    var r = [];
    for (var i = 0; i < v.length; i++) r.push(v[i]);
    return r;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function isSpatial(prop) {
    var t = prop.propertyValueType;
    return t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL;
  }

  // Число объектов KeyframeEase для ключа: 2/3 для TwoD/ThreeD, иначе 1.
  function easeDims(prop) {
    var t = prop.propertyValueType;
    if (t === PropertyValueType.TwoD) return 2;
    if (t === PropertyValueType.ThreeD) return 3;
    return 1;
  }

  function easeList(n, speed, influence) {
    var r = [];
    for (var d = 0; d < n; d++) r.push(new KeyframeEase(speed instanceof Array ? speed[d] : speed, clamp(influence, 0.1, 100)));
    return r;
  }

  // Два ключа t0 -> t1 с ease: startInf — вылет из первого, endInf — вход во второй.
  function easeBetween(prop, t0, t1, startInf, endInf) {
    var k0 = prop.nearestKeyIndex(t0);
    var k1 = prop.nearestKeyIndex(t1);
    var n = easeDims(prop);
    var B = KeyframeInterpolationType.BEZIER;
    prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), B);
    prop.setInterpolationTypeAtKey(k1, B, prop.keyOutInterpolationType(k1));
    prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), easeList(n, 0, startInf));
    prop.setTemporalEaseAtKey(k1, easeList(n, 0, endInf), prop.keyOutTemporalEase(k1));
  }

  // Ключи from -> to от t0 на duration с плавным торможением.
  function keyPair(prop, t0, t1, from, to, startInf, endInf) {
    prop.setValueAtTime(t0, from);
    prop.setValueAtTime(t1, to);
    easeBetween(prop, t0, t1, startInf === undefined ? 15 : startInf, endInf === undefined ? 85 : endInf);
  }

  function hasExpression(prop) {
    return prop.canSetExpression && prop.expressionEnabled && prop.expression !== "";
  }

  // Выделенные свойства (не группы) на выделенных слоях.
  function selectedProps(layers) {
    var r = [];
    for (var i = 0; i < layers.length; i++) {
      var ps = layers[i].selectedProperties;
      for (var j = 0; j < ps.length; j++) {
        if (ps[j].propertyType === PropertyType.PROPERTY) r.push({ layer: layers[i], prop: ps[j] });
      }
    }
    return r;
  }

  function propByPath(layer, path) {
    var p = layer;
    for (var i = 0; i < path.length && p; i++) p = p.property(path[i]);
    return p || null;
  }

  function layerKind(layer) {
    if (layer instanceof TextLayer) return "text";
    if (layer instanceof ShapeLayer) return "shape";
    if (layer instanceof CameraLayer) return "camera";
    if (layer instanceof LightLayer) return "light";
    if (layer.nullLayer) return "null";
    if (layer.adjustmentLayer) return "adjustment";
    var src = layer.source;
    if (src instanceof CompItem) return "precomp";
    if (src && src.mainSource instanceof SolidSource) return "solid";
    if (src && !layer.hasVideo && layer.hasAudio) return "audio";
    if (src && src.mainSource && src.mainSource.isStill) return "image";
    return "video";
  }
