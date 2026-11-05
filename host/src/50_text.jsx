
  /*
   * Текст: копировать/вставить стиль (TextDocument) и анимация по буквам (text animators).
   */
  var STYLE_FIELDS = ["font", "fontSize", "applyFill", "fillColor", "applyStroke", "strokeColor", "strokeWidth",
    "strokeOverFill", "tracking", "justification", "autoLeading", "leading", "fauxBold", "fauxItalic", "allCaps", "smallCaps"];

  function sourceTextProp(layer) {
    var t = layer.property("ADBE Text Properties");
    return t ? t.property("ADBE Text Document") : null;
  }

  function textLayers(layers) {
    var r = [];
    for (var i = 0; i < layers.length; i++) if (layers[i] instanceof TextLayer) r.push(layers[i]);
    return r;
  }

  tools["ae.textCopyStyle"] = function () {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var texts = textLayers(selectedLayers(comp));
    if (!texts.length) return fail("NO_TEXT_LAYER");
    var doc = sourceTextProp(texts[0]).valueAtTime(comp.time, false);
    var style = {};
    for (var i = 0; i < STYLE_FIELDS.length; i++) {
      var f = STYLE_FIELDS[i];
      // fillColor/strokeColor/leading читаются только когда включены — пропускаем ошибки по одному полю
      try {
        if ((f === "fillColor" && !doc.applyFill) || (f === "strokeColor" && !doc.applyStroke) || (f === "leading" && doc.autoLeading)) continue;
        var v = doc[f];
        if (v !== undefined) style[f] = v;
      } catch (e) {}
    }
    return { ok: true, style: style, from: texts[0].name };
  };

  tools["ae.textPasteStyle"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var texts = textLayers(selectedLayers(comp));
    if (!texts.length) return fail("NO_TEXT_LAYER");
    var style = args.style;
    if (!style) return fail("NO_STYLE");
    var changed = 0, failedFields = [];
    undoable(args.undoName, function () {
      for (var i = 0; i < texts.length; i++) {
        if (texts[i].locked) continue;
        var prop = sourceTextProp(texts[i]);
        var doc = prop.valueAtTime(comp.time, false);
        // порядок важен: сначала включить заливку/обводку, потом цвет
        for (var j = 0; j < STYLE_FIELDS.length; j++) {
          var f = STYLE_FIELDS[j];
          if (!style.hasOwnProperty(f)) continue;
          try { doc[f] = style[f]; } catch (e) { failedFields.push(f); }
        }
        if (prop.numKeys > 0) prop.setValueAtTime(comp.time, doc); else prop.setValue(doc);
        changed++;
      }
    });
    if (!changed) return fail("NOTHING_CHANGED", { skipped: { locked: texts.length } });
    return { ok: true, changed: changed, failedFields: failedFields };
  };

  /*
   * ae.textAnimate — анимация по буквам.
   * args: { preset: "fade"|"rise"|"scale"|"blur", mode: "in"|"out", duration, animatorName, undoName }
   * Аниматор задаёт «спрятанное» состояние, Range Selector со Smoothness открывает буквы по одной:
   *   in:  Start 0 -> 100 (буквы выходят из диапазона и проявляются)
   *   out: End   0 -> 100 (буквы попадают в диапазон и прячутся)
   */
  tools["ae.textAnimate"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var texts = textLayers(selectedLayers(comp));
    if (!texts.length) return fail("NO_TEXT_LAYER");
    var duration = args.duration > 0 ? args.duration : 1;
    var t0 = comp.time, t1 = t0 + duration, isIn = args.mode !== "out";
    var changed = 0;

    undoable(args.undoName, function () {
      for (var i = 0; i < texts.length; i++) {
        var layer = texts[i];
        if (layer.locked) continue;
        var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var anim = animators.addProperty("ADBE Text Animator");
        if (args.animatorName) anim.name = args.animatorName;
        var props = anim.property("ADBE Text Animator Properties");
        props.addProperty("ADBE Text Opacity").setValue(0);
        if (args.preset === "rise") props.addProperty("ADBE Text Position 3D").setValue([0, 40, 0]);
        if (args.preset === "scale") props.addProperty("ADBE Text Scale 3D").setValue([0, 0, 0]);
        if (args.preset === "blur") props.addProperty("ADBE Text Blur").setValue([30, 30]);

        var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        var start = sel.property("ADBE Text Percent Start");
        var end = sel.property("ADBE Text Percent End");
        if (isIn) {
          keyPair(start, t0, t1, 0, 100, 33, 33);
        } else {
          keyPair(end, t0, t1, 0, 100, 33, 33);
        }
        changed++;
      }
    });
    if (!changed) return fail("NOTHING_CHANGED", { skipped: { locked: texts.length } });
    return { ok: true, changed: changed };
  };
