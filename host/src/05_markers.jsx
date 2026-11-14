
  /*
   * Анимации, управляемые маркером слоя с длительностью.
   * Маркер — это «ручка» на таймлайне: двигаешь — анимация сдвигается, тянешь конец — меняется длительность,
   * удаляешь — анимация пропадает. Выражения находят свой маркер по тексту (comment).
   *
   * Несколько анимаций на одном свойстве (появление + исчезание + тряска) складываются в цепочку:
   *   // AE Assistant chain
   *   function A_1(value) { ... }
   *   function A_2(value) { ... }
   *   A_2(A_1(value))
   */
  var CHAIN_HEAD = "// AE Assistant chain";
  var MK_FN = "function MK(n) { var m = thisLayer.marker; for (var k = m.numKeys; k >= 1; k--) { if (m.key(k).comment == n) return m.key(k); } return null; }";
  var MARKER_LABEL = 10; // цвет метки маркера (фиолетовый в стандартной палитре)

  function addLayerMarker(layer, t, duration, comment) {
    var mv = new MarkerValue(comment);
    mv.duration = duration > 0 ? duration : 0;
    try { mv.label = MARKER_LABEL; } catch (e) {}
    layer.property("ADBE Marker").setValueAtTime(t, mv);
  }

  /*
   * Стиль Animation Composer: точечные маркеры «TR In» и «TR Out».
   *   появление — от начала слоя до «TR In», исчезание — от «TR Out» до конца слоя;
   *   все анимации появления на слое слушают один «TR In» (одна ручка на всё).
   * Маркер уже есть — не дублируем (его положение — выбор пользователя).
   */
  function ensurePointMarker(layer, t, comment) {
    var mp = layer.property("ADBE Marker");
    for (var k = 1; k <= mp.numKeys; k++) if (mp.keyValue(k).comment === comment) return false;
    mp.setValueAtTime(t, new MarkerValue(comment));
    return true;
  }

  function findMarker(layer, comment) {
    var mp = layer.property("ADBE Marker");
    for (var k = mp.numKeys; k >= 1; k--) if (mp.keyValue(k).comment === comment) return mp.keyTime(k);
    return null;
  }

  // TR In / TR Out for a short layer: never let them cross. Returns true when the
  // animation had to be squeezed (layer shorter than in + out).
  // Shared slider "TR Out duration": created once per layer, set to the latest applied value.
  function trOutControl(layer, name, duration) {
    if (!name) return;
    var c = ensureControl(layer, { type: "slider", name: name, value: duration });
    try { if (c && c.property(1).numKeys === 0) c.property(1).setValue(duration); } catch (e) {}
  }

  function placeTR(layer, isIn, duration) {
    // a marker set at the time of another one replaces it - keep them a frame apart
    var t, other, fr = 1 / 25;
    try { fr = layer.containingComp.frameDuration; } catch (e) {}
    if (isIn) {
      t = layer.inPoint + duration; other = findMarker(layer, "TR Out");
      if (other !== null && t > other - fr) t = Math.max(layer.inPoint, other - fr);
      if (t > layer.outPoint) t = layer.outPoint;
    } else {
      t = layer.outPoint - duration; other = findMarker(layer, "TR In");
      if (other !== null && t < other + fr) t = Math.min(layer.outPoint, other + fr);
      if (t < layer.inPoint) t = layer.inPoint;
    }
    ensurePointMarker(layer, t, isIn ? "TR In" : "TR Out");
    var now = findMarker(layer, isIn ? "TR In" : "TR Out");
    return now !== null && Math.abs((isIn ? now - layer.inPoint : layer.outPoint - now) - duration) > 0.0005;
  }

  // Start (s) and length (d) of the animation in the expression. TR Out never starts
  // before TR In (and vice versa), even when the user drags the markers across.
  // outSlider: name of the "TR Out duration" slider - the out animation starts at TR Out
  // and lasts that long (not up to the layer end), so dragging TR Out moves it.
  function trTiming(isIn, outSlider) {
    var lim = outSlider ? "try { var D = effect(" + str(outSlider) + ")(1); if (D > 0 && D < d) d = D; } catch (err) {}\n" : "";
    return isIn
      ? "var mk = MK(\"TR In\");\nif (!mk) return value;\nvar mo = MK(\"TR Out\"), e = mk.time;\nif (mo && mo.time < e) e = mo.time;\nvar s = inPoint, d = Math.max(e - inPoint, 0.001);\n"
      : "var mk = MK(\"TR Out\");\nif (!mk) return value;\nvar mi = MK(\"TR In\"), s = mk.time;\nif (mi && mi.time > s) s = mi.time;\nvar d = outPoint - s;\n" + lim + "d = Math.max(d, 0.001);\n";
  }

  // Номер для новой анимации на слое: маркеры слоя + 1 (чтобы имена не совпадали).
  function nextTag(layer) {
    return String(layer.property("ADBE Marker").numKeys + 1);
  }

  function countOf(s, sub) {
    var n = 0, i = s.indexOf(sub); // строка
    while (i >= 0) { n++; i = s.indexOf(sub, i + sub.length); } // строка
    return n;
  }

  // Можно ли добавить звено: свойство без выражения или с нашей цепочкой. Чужое выражение не трогаем.
  function canChain(prop) {
    if (!prop || !prop.canSetExpression) return false;
    if (!prop.expressionEnabled || prop.expression === "") return true;
    return prop.expression.indexOf(CHAIN_HEAD) === 0; // строка
  }

  // Добавить звено в цепочку выражений свойства. body — тело функции от value, с return.
  function chainExpression(prop, body) {
    var old = prop.expressionEnabled ? prop.expression : "";
    var head, call;
    if (old.indexOf(CHAIN_HEAD) === 0) { // строка
      var cut = old.lastIndexOf("\n"); // строка
      head = old.substring(0, cut);
      call = old.substring(cut + 1);
    } else {
      head = CHAIN_HEAD + "\n" + MK_FN;
      call = "value";
    }
    var n = countOf(head, "function A_") + 1;
    prop.expression = head + "\nfunction A_" + n + "(value) {\n" + body + "\n}\n" + "A_" + n + "(" + call + ")";
    prop.expressionEnabled = true;
    return prop.expressionError || "";
  }

  function num(v) { return String(Math.round(v * 1000) / 1000); }
  function vec(a) { var r = []; for (var i = 0; i < a.length; i++) r.push(num(a[i])); return "[" + r.join(", ") + "]"; }
  function str(s) { return quote(s); }
