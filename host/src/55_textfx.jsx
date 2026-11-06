
  /*
   * ae.textFx — анимация текста по буквам/словам/строкам через Expression Selector.
   * Время и кривая каждой единицы считаются выражением (код и имена ползунков — из панели),
   * поэтому возможны пружина, перелёт и любой порядок.
   * args: {
   *   unit: "chars"|"words"|"lines",
   *   props: { opacity, position: [x, y], scale: %, rotation, blur, skew, tracking },   «спрятанное» состояние
   *   code: "...",  controls: [{ name, value }],   в коде и именах "@@" заменяется на номер аниматора
   *   startSlider: "...",                          имя ползунка старта: ставится = CTI - inPoint
   *   marker: { name, duration },                  маркер слоя с длительностью: начало и длина всей анимации
   *   animatorName, undoName
   * }
   */
  var UNIT_TYPE = { chars: 1, chars_no_spaces: 2, words: 3, lines: 4 };

  // Based On: 1 буквы, 2 буквы без пробелов, 3 слова, 4 строки. Ищем в селекторе и его подгруппах.
  function setBasedOn(group, unit) {
    for (var i = 1; i <= group.numProperties; i++) {
      var p = group.property(i);
      if (p.matchName === "ADBE Text Range Type2") {
        try { p.setValue(UNIT_TYPE[unit] || 1); return true; } catch (e) { return false; }
      }
      if (p.propertyType !== PropertyType.PROPERTY && setBasedOn(p, unit)) return true;
    }
    return false;
  }

  function findByMatch(group, re) {
    for (var i = 1; i <= group.numProperties; i++) {
      var p = group.property(i);
      if (re.test(p.matchName)) return p;
    }
    return null;
  }

  tools["ae.textFx"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var texts = textLayers(selectedLayers(comp));
    if (!texts.length) return fail("NO_TEXT_LAYER");
    var changed = 0, unitSet = true;

    undoable(args.undoName, function () {
      for (var i = 0; i < texts.length; i++) {
        var layer = texts[i];
        if (layer.locked) continue;
        var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var tag = args.marker ? nextTag(layer) : String(animators.numProperties + 1);
        var anim = animators.addProperty("ADBE Text Animator");
        if (args.animatorName) anim.name = args.animatorName + " #" + tag;

        var P = anim.property("ADBE Text Animator Properties"), s = args.props || {};
        if (s.opacity !== undefined) P.addProperty("ADBE Text Opacity").setValue(s.opacity);
        if (s.position) P.addProperty("ADBE Text Position 3D").setValue([s.position[0], s.position[1], 0]);
        if (s.scale !== undefined) P.addProperty("ADBE Text Scale 3D").setValue([s.scale, s.scale, 100]);
        if (s.rotation) P.addProperty("ADBE Text Rotation").setValue(s.rotation);
        if (s.blur) P.addProperty("ADBE Text Blur").setValue([s.blur, s.blur]);
        if (s.skew) P.addProperty("ADBE Text Skew").setValue(s.skew);
        if (s.tracking) P.addProperty("ADBE Text Tracking Amount").setValue(s.tracking);

        var controls = args.controls || [];
        for (var c = 0; c < controls.length; c++) {
          var name = controls[c].name.split("@@").join(tag);
          var value = controls[c].name === args.startSlider ? comp.time - layer.inPoint : controls[c].value;
          ensureControl(layer, { type: "slider", name: name, value: value });
        }

        var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
        if (!setBasedOn(sel, args.unit)) unitSet = args.unit === "chars";
        var mt = comp.time;
        if (args.at === "layer") mt = args.mode === "out" ? layer.outPoint - args.marker.duration : layer.inPoint;
        if (args.marker) addLayerMarker(layer, mt, args.marker.duration, args.marker.name.split("@@").join(tag));
        var amount = findByMatch(sel, /Amount/);
        if (amount) {
          amount.expression = args.code.split("@@").join(tag);
          amount.expressionEnabled = true;
        }
        changed++;
      }
    });
    if (!changed) return fail("NOTHING_CHANGED", { skipped: { locked: texts.length } });
    return { ok: true, changed: changed, unitSet: unitSet };
  };
