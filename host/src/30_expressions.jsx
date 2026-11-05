
  /*
   * ae.expression — ставит выражение.
   * args: {
   *   code: "...",                         текст выражения (готовый пресет из панели или подтверждённый пользователем)
   *   defaultPath: ["ADBE Transform Group", "ADBE Position"],   если на слое не выделено свойство
   *   forceDefault: false,                 true — всегда defaultPath (например, «смотреть на слой» -> Rotation)
   *   controls: [{ type: "slider"|"checkbox"|"layer", name: "...", value: 1 }],   эффекты-ползунки на слое
   *   lookAtLast: false,                   слой-контрол указывает на последний выделенный слой (он сам не меняется)
   *   linearIn: false,                     сделать вход в ключи линейным (для отскока/инерции нужна скорость прилёта):
   *                                        выделенные ключи, а если их нет — все ключи кроме первого
   *   undoName
   * }
   */
  var CONTROL_MATCH = { slider: "ADBE Slider Control", checkbox: "ADBE Checkbox Control", layer: "ADBE Layer Control", angle: "ADBE Angle Control" };

  function ensureControl(layer, c) {
    var fx = layer.property("ADBE Effect Parade");
    if (!fx) return null;
    for (var i = 1; i <= fx.numProperties; i++) {
      var e = fx.property(i);
      if (e.name === c.name && e.matchName === CONTROL_MATCH[c.type]) return e;
    }
    if (!fx.canAddProperty(CONTROL_MATCH[c.type])) return null;
    var made = fx.addProperty(CONTROL_MATCH[c.type]);
    made.name = c.name;
    if (c.value !== undefined && c.value !== null) made.property(1).setValue(c.value);
    return made;
  }

  function linearizeIn(prop) {
    if (!prop.canVaryOverTime || prop.numKeys < 2) return;
    var keys = prop.selectedKeys, L = KeyframeInterpolationType.LINEAR;
    if (!keys.length) { keys = []; for (var k = 2; k <= prop.numKeys; k++) keys.push(k); }
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] < 2) continue;
      prop.setInterpolationTypeAtKey(keys[i], L, prop.keyOutInterpolationType(keys[i]));
    }
  }

  tools["ae.expression"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    if (!args.code) return fail("BAD_ARGS", { field: "code" });

    var targetLayer = null;
    if (args.lookAtLast) {
      if (layers.length < 2) return fail("NEED_TWO_LAYERS");
      targetLayer = layers[layers.length - 1];
      layers = layers.slice(0, layers.length - 1);
    }

    var changed = 0, skipped = 0, noTarget = 0, errors = [];
    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.locked) { skipped++; continue; }
        var targets = [];
        if (!args.forceDefault) {
          var ps = layer.selectedProperties;
          for (var j = 0; j < ps.length; j++) if (ps[j].propertyType === PropertyType.PROPERTY && ps[j].canSetExpression) targets.push(ps[j]);
        }
        if (!targets.length && args.defaultPath) {
          var d = propByPath(layer, args.defaultPath);
          if (d && d.canSetExpression) targets.push(d);
        }
        if (!targets.length) { noTarget++; continue; }

        var controls = args.controls || [];
        for (var c = 0; c < controls.length; c++) {
          var made = ensureControl(layer, controls[c]);
          if (made && controls[c].type === "layer" && targetLayer) made.property(1).setValue(targetLayer.index);
        }
        for (var t = 0; t < targets.length; t++) {
          if (args.linearIn) linearizeIn(targets[t]);
          targets[t].expression = args.code;
          targets[t].expressionEnabled = true;
          if (targets[t].expressionError) errors.push(targets[t].expressionError);
          changed++;
        }
      }
    });
    if (!changed && noTarget) return fail("NO_TARGET_PROPS");
    if (!changed) return fail("NOTHING_CHANGED", { skipped: { other: skipped } });
    return { ok: true, changed: changed, skipped: { other: skipped }, expressionError: errors.length ? errors[0] : "" };
  };

  // Убрать выражения с выделенных свойств (или со всех свойств трансформации, если ничего не выделено).
  tools["ae.clearExpression"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var changed = 0;
    undoable(args.undoName, function () {
      var props = selectedProps(layers);
      if (!props.length) {
        for (var i = 0; i < layers.length; i++) {
          var tr = layers[i].property("ADBE Transform Group");
          if (!tr) continue;
          for (var j = 1; j <= tr.numProperties; j++) props.push({ layer: layers[i], prop: tr.property(j) });
        }
      }
      for (var k = 0; k < props.length; k++) {
        var p = props[k].prop;
        if (p.canSetExpression && p.expression !== "") { p.expression = ""; changed++; }
      }
    });
    if (!changed) return fail("NO_EXPRESSIONS");
    return { ok: true, changed: changed };
  };

  /*
   * ae.expressions — несколько выражений за одно действие (например, тряска: позиция + поворот + масштаб).
   * args: { items: [{ path: [...], code }], controls: [{ type, name, value }], startSlider, undoName,
   *         chain: true — code это тело функции (с return), добавляется в цепочку выражений свойства,
   *         marker: { name, duration } — маркер слоя с длительностью от текущего времени }
   * В именах и коде "@@" заменяется на номер, чтобы повторное применение не путало ползунки.
   */
  tools["ae.expressions"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var changed = 0, errors = [], separated = 0;
    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.locked) continue;
        var fx = layer.property("ADBE Effect Parade");
        var tag = args.marker ? nextTag(layer) : String(fx ? fx.numProperties + 1 : 1);
        var controls = args.controls || [];
        for (var c = 0; c < controls.length; c++) {
          var value = controls[c].name === args.startSlider ? comp.time - layer.inPoint : controls[c].value;
          ensureControl(layer, { type: controls[c].type || "slider", name: controls[c].name.split("@@").join(tag), value: value });
        }
        var did = false;
        for (var k = 0; k < args.items.length; k++) {
          var p = propByPath(layer, args.items[k].path);
          if (!p || !p.canSetExpression) continue;
          if (p.dimensionsSeparated) { separated++; continue; }
          var code = args.items[k].code.split("@@").join(tag);
          if (args.chain) {
            var err = chainExpression(p, code);
            if (err) errors.push(err);
          } else {
            p.expression = code;
            p.expressionEnabled = true;
            if (p.expressionError) errors.push(p.expressionError);
          }
          did = true;
        }
        if (did && args.marker) addLayerMarker(layer, comp.time, args.marker.duration, args.marker.name.split("@@").join(tag));
        if (did) changed++;
      }
    });
    if (!changed && separated) return fail("SEPARATED_DIMENSIONS");
    if (!changed) return fail("NOTHING_CHANGED", { skipped: { other: layers.length } });
    return { ok: true, changed: changed, separated: separated, expressionError: errors.length ? errors[0] : "" };
  };
