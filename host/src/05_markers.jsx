
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

  // Номер для новой анимации на слое: маркеры слоя + 1 (чтобы имена не совпадали).
  function nextTag(layer) {
    return String(layer.property("ADBE Marker").numKeys + 1);
  }

  function countOf(s, sub) {
    var n = 0, i = s.indexOf(sub); // строка
    while (i >= 0) { n++; i = s.indexOf(sub, i + sub.length); } // строка
    return n;
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
