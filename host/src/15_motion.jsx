
  /*
   * ae.motion — переход для выделенных слоёв из нескольких свойств сразу (как один пресет).
   * args: {
   *   mode: "in"|"out", duration, stagger (с между слоями), spring (bool),
   *   fade: bool,
   *   move: { dir: откуда приходит слой "left"|"right"|"up"|"down", distance: px (0 = из-за края кадра) } | null,
   *   scaleFrom: % | null,  rotateFrom: deg | null,  blurFrom: px | null,
   *   blurName: "...", undoName,
   *   control: "keys" | "marker",   marker — без ключей: выражения + маркер слоя с длительностью
   *   markerName: "...@@",          текст маркера, @@ -> номер
   *   hidden: "...",                выражение «насколько спрятан» от p (0..1) — кривая из панели
   * }
   * Каждое свойство: «спрятанное» значение <-> текущее, ключи от CTI (+ i * stagger).
   */
  function blurProp(layer, name) {
    var fx = layer.property("ADBE Effect Parade");
    if (!fx) return null;
    for (var i = 1; i <= fx.numProperties; i++) {
      var e = fx.property(i);
      if (e.matchName === "ADBE Gaussian Blur 2" && e.name === name) return e.property(1);
    }
    if (!fx.canAddProperty("ADBE Gaussian Blur 2")) return null;
    var made = fx.addProperty("ADBE Gaussian Blur 2");
    made.name = name;
    return made.property(1); // Blurriness
  }

  function animateProp(prop, t0, t1, off, rest, isIn, spring, amount) {
    if (spring && isIn) springKeys(prop, t0, t1, off, rest, amount);
    else keyPair(prop, t0, t1, isIn ? off : rest, isIn ? rest : off, isIn ? 15 : 85, isIn ? 85 : 15);
  }

  // Режим маркера: те же «спрятанные» значения, но через выражения, от маркера слоя.
  function motionByMarker(layer, tr, comp, t0, duration, args, isIn) {
    var tag = nextTag(layer), name = String(args.markerName || "Anim @@").split("@@").join(tag);
    var head = "var mk = MK(" + str(name) + ");\nif (!mk) return value;\n" +
      "var p = Math.min(1, Math.max(0, (time - mk.time) / Math.max(mk.duration, 0.001)));\n" +
      "var h = " + args.hidden + ";\n";
    var did = false;
    if (args.fade) { chainExpression(tr.property("ADBE Opacity"), head + "return value * Math.max(0, 1 - h);"); did = true; }
    if (args.move) {
      var horizontal = args.move.dir === "left" || args.move.dir === "right", axis = horizontal ? 0 : 1;
      var sign = args.move.dir === "left" || args.move.dir === "up" ? -1 : 1;
      var pos = tr.property("ADBE Position"), sep = pos.dimensionsSeparated;
      var mp = sep ? tr.property(horizontal ? "ADBE Position_0" : "ADBE Position_1") : pos;
      var rest = mp.valueAtTime(t0, false), cur = sep ? rest : rest[axis];
      var hidden = args.move.distance > 0 ? cur + sign * args.move.distance : offscreen(layer, tr, comp, t0, args.move.dir, cur);
      var d = hidden - cur;
      if (sep) chainExpression(mp, head + "return value + " + num(d) + " * h;");
      else {
        var off = []; for (var k = 0; k < rest.length; k++) off.push(k === axis ? d : 0);
        chainExpression(mp, head + "return add(value, mul(" + vec(off) + ", h));");
      }
      did = true;
    }
    if (args.scaleFrom !== null && args.scaleFrom !== undefined) {
      chainExpression(tr.property("ADBE Scale"), head + "return mul(value, 1 + (" + num(args.scaleFrom / 100) + " - 1) * h);"); did = true;
    }
    if (args.rotateFrom) {
      chainExpression(tr.property("ADBE Rotate Z"), head + "return value + " + num(isIn ? args.rotateFrom : -args.rotateFrom) + " * h;"); did = true;
    }
    if (args.blurFrom > 0) {
      var bp = blurProp(layer, args.blurName || "Blur");
      if (bp) { chainExpression(bp, head + "return value + " + num(args.blurFrom) + " * Math.max(0, h);"); did = true; }
    }
    if (did) addLayerMarker(layer, t0, duration, name);
    return did;
  }

  tools["ae.motion"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp).sort(function (a, b) { return a.index - b.index; });
    if (!layers.length) return fail("NO_SELECTION");
    var isIn = args.mode !== "out";
    var duration = args.duration > 0 ? args.duration : 0.6;
    var stagger = args.stagger > 0 ? args.stagger : 0;
    var changed = 0, skipped = { locked: 0, noPosition: 0, expression: 0 };

    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.locked) { skipped.locked++; continue; }
        if (layer instanceof CameraLayer || layer instanceof LightLayer) { skipped.noPosition++; continue; }
        var tr = layer.property("ADBE Transform Group");
        if (!tr) { skipped.noPosition++; continue; }
        var t0 = comp.time + i * stagger, t1 = t0 + duration, did = false;
        if (args.control === "marker") {
          var r = motionByMarker(layer, tr, comp, t0, duration, args, isIn);
          if (r) changed++; else skipped.expression++;
          continue;
        }

        if (args.fade) {
          var op = tr.property("ADBE Opacity");
          if (!hasExpression(op)) { animateProp(op, t0, t1, 0, op.valueAtTime(t0, true), isIn, false); did = true; }
        }
        if (args.move) {
          var horizontal = args.move.dir === "left" || args.move.dir === "right";
          var axis = horizontal ? 0 : 1;
          var sign = args.move.dir === "left" || args.move.dir === "up" ? -1 : 1;
          var pos = tr.property("ADBE Position");
          var sep = pos.dimensionsSeparated;
          var mp = sep ? tr.property(horizontal ? "ADBE Position_0" : "ADBE Position_1") : pos;
          if (!hasExpression(mp)) {
            var rest = mp.valueAtTime(t0, true);
            var cur = sep ? rest : rest[axis];
            var hidden = args.move.distance > 0 ? cur + sign * args.move.distance : offscreen(layer, tr, comp, t0, args.move.dir, cur);
            var off = sep ? hidden : copyArr(rest);
            if (!sep) off[axis] = hidden;
            animateProp(mp, t0, t1, off, rest, isIn, args.spring, 0.07);
            did = true;
          }
        }
        if (args.scaleFrom !== null && args.scaleFrom !== undefined) {
          var sc = tr.property("ADBE Scale");
          if (!hasExpression(sc)) {
            var sRest = sc.valueAtTime(t0, true), sOff = [];
            for (var d = 0; d < sRest.length; d++) sOff.push(sRest[d] * args.scaleFrom / 100);
            animateProp(sc, t0, t1, sOff, sRest, isIn, args.spring, 0.12);
            did = true;
          }
        }
        if (args.rotateFrom) {
          var rot = tr.property("ADBE Rotate Z");
          if (!hasExpression(rot)) {
            var r = rot.valueAtTime(t0, true);
            animateProp(rot, t0, t1, r + (isIn ? args.rotateFrom : -args.rotateFrom), r, isIn, args.spring, 0.12);
            did = true;
          }
        }
        if (args.blurFrom > 0) {
          var bp = blurProp(layer, args.blurName || "Blur");
          if (bp) { animateProp(bp, t0, t1, args.blurFrom, 0, isIn, false); did = true; }
        }
        if (did) changed++; else skipped.expression++;
      }
    });
    if (!changed) return fail("NOTHING_CHANGED", { skipped: skipped });
    return { ok: true, changed: changed, skipped: skipped };
  };
