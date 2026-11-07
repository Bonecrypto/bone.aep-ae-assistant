
  /*
   * ae.makePreview — превью для .ffx: временная композиция с образцом (текст или фигура),
   * пресет применяется к образцу, несколько кадров сохраняются в PNG в _previews рядом с файлом.
   * Использует comp.saveFrameToPng (есть в AE, но не описан в Scripting Guide) — без него честная ошибка.
   * args: { preset, outDir, base, sample: "text"|"shape", frames, sampleText, undoName }
   */
  function maxKeyTime(group, acc) {
    for (var i = 1; i <= group.numProperties; i++) {
      var p = group.property(i);
      if (p.propertyType === PropertyType.PROPERTY) { if (p.numKeys) acc.t = Math.max(acc.t, p.keyTime(p.numKeys)); }
      else maxKeyTime(p, acc);
    }
    return acc;
  }

  tools["ae.makePreview"] = function (args) {
    var file = new File(args.preset);
    if (!file.exists) return fail("FILE_MISSING");
    var w = 480, h = 270, fr = 30, written = [];
    var tmp = app.project.items.addComp("AEA preview", w, h, 1, 5, fr);
    if (typeof tmp.saveFrameToPng !== "function") { tmp.remove(); return fail("NO_FRAME_EXPORT"); }
    var outDir = new Folder(args.outDir);
    if (!outDir.exists) outDir.create();
    try {
      var bg = tmp.layers.addSolid([0.1, 0.1, 0.12], "bg", w, h, 1, 5);
      var sample;
      if (args.sample === "text") {
        sample = tmp.layers.addText(args.sampleText || "Text");
        var td = sample.property("ADBE Text Properties").property("ADBE Text Document"), doc = td.value;
        doc.fontSize = 90; doc.applyFill = true; doc.fillColor = [1, 1, 1];
        try { doc.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (e) {}
        td.setValue(doc);
        var r = sample.sourceRectAtTime(0, false);
        sample.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
      } else {
        sample = tmp.layers.addShape();
        var c = sample.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var rect = c.addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([140, 140]);
        rect.property("ADBE Vector Rect Roundness").setValue(28);
        c.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([0.62, 0.09, 0.93, 1]);
      }
      sample.property("ADBE Transform Group").property("ADBE Position").setValue([w / 2, h / 2]);
      for (var i = 1; i <= tmp.numLayers; i++) tmp.layer(i).selected = false;
      sample.selected = true;
      tmp.time = 0;
      sample.applyPreset(file);
      var T = Math.min(4, Math.max(0.6, maxKeyTime(sample, { t: 0 }).t + 0.3));
      var n = args.frames > 1 ? args.frames : 10;
      for (var f = 0; f < n; f++) {
        var name = args.base + "__" + (f < 9 ? "0" : "") + (f + 1) + ".png";
        var out = new File(outDir.fsName + "/" + name);
        tmp.saveFrameToPng(T * (f + 1) / n, out);
        written.push(out.fsName);
      }
      // обложка: кадр в конце анимации
      var cover = new File(outDir.fsName + "/" + args.base + ".png");
      tmp.saveFrameToPng(T, cover);
      written.push(cover.fsName);
    } catch (e) {
      try { tmp.remove(); } catch (e2) {}
      return fail("EXCEPTION", { message: String(e), line: e.line });
    }
    // кадры могут записываться асинхронно: временную композицию панель удалит после (ae.removeItems)
    var ids = [tmp.id];
    try { if (bg.source) ids.push(bg.source.id); } catch (e3) {}
    return { ok: true, frames: written.length, files: written, dir: outDir.fsName, cleanup: ids };
  };

  tools["ae.removeItems"] = function (args) {
    var n = 0, ids = args.ids || [];
    for (var i = 0; i < ids.length; i++) {
      var it = app.project.itemByID(ids[i]);
      if (it) { it.remove(); n++; }
    }
    return { ok: true, removed: n };
  };

  // Открыть стандартный диалог AE «Save Animation Preset» (свойства или эффекты должны быть выделены).
  tools["ae.savePresetDialog"] = function () {
    var id = 0;
    try { id = app.findMenuCommandId("Save Animation Preset..."); } catch (e) {}
    if (!id) return fail("COMMAND_FAILED", { command: "Save Animation Preset" });
    app.executeCommand(id);
    return { ok: true };
  };

  /*
   * ae.carousel — карусель: выделенные слои по очереди выезжают в центр и стоят hold секунд.
   * args: { mode: "slide"|"cover", hold, move, spacing, undoName }
   * cover — центральный слой крупно, соседние меньше и прозрачнее.
   */
  tools["ae.carousel"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp).sort(function (a, b) { return a.index - b.index; });
    if (layers.length < 2) return fail("NEED_TWO_LAYERS");
    var hold = args.hold >= 0 ? args.hold : 1, move = args.move > 0 ? args.move : 0.6, sp = args.spacing > 0 ? args.spacing : comp.width * 0.6;
    var cx = comp.width / 2, t0 = comp.time, n = layers.length;
    undoable(args.undoName, function () {
      for (var i = 0; i < n; i++) {
        var tr = layers[i].property("ADBE Transform Group"), pos = tr.property("ADBE Position");
        var sep = pos.dimensionsSeparated, px = sep ? tr.property("ADBE Position_0") : pos;
        var base = px.valueAtTime(t0, false), sc = tr.property("ADBE Scale"), op = tr.property("ADBE Opacity");
        var s0 = sc.valueAtTime(t0, false), o0 = op.valueAtTime(t0, false);
        for (var k = 0; k < n; k++) {
          var d = i - k, x = cx + d * sp, ad = Math.abs(d);
          var v = sep ? x : (function () { var r = copyArr(base); r[0] = x; return r; })();
          var times = [t0 + k * (hold + move)];
          if (hold > 0) times.push(times[0] + hold);
          for (var q = 0; q < times.length; q++) {
            px.setValueAtTime(times[q], v);
            if (args.mode === "cover") {
              var f = ad === 0 ? 1 : ad === 1 ? 0.75 : 0.6, sv = [];
              for (var j = 0; j < s0.length; j++) sv.push(s0[j] * f);
              sc.setValueAtTime(times[q], sv);
              op.setValueAtTime(times[q], ad === 0 ? o0 : ad === 1 ? o0 * 0.6 : 0);
            }
          }
        }
        var props = args.mode === "cover" ? [px, sc, op] : [px];
        for (var m = 0; m < props.length; m++) {
          var P = props[m], nd = easeDims(P);
          for (var kk = 1; kk <= P.numKeys; kk++) {
            P.setInterpolationTypeAtKey(kk, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
            P.setTemporalEaseAtKey(kk, easeList(nd, 0, 75), easeList(nd, 0, 75));
          }
        }
      }
    });
    return { ok: true, changed: n, length: n * (hold + move) - move };
  };

  /*
   * ae.mergeShapes — слить выделенные шейп-слои в верхний: содержимое каждого становится группой
   * с трансформацией его слоя (относительно верхнего). Исходные слои выключаются.
   */
  function copyProp(s, d, bad) {
    try {
      if (s.expressionEnabled && s.expression !== "") { d.expression = s.expression; d.expressionEnabled = true; }
      if (s.numKeys > 0) {
        for (var k = 1; k <= s.numKeys; k++) d.setValueAtTime(s.keyTime(k), s.keyValue(k));
        for (k = 1; k <= s.numKeys; k++) {
          d.setInterpolationTypeAtKey(k, s.keyInInterpolationType(k), s.keyOutInterpolationType(k));
          d.setTemporalEaseAtKey(k, s.keyInTemporalEase(k), s.keyOutTemporalEase(k));
        }
      } else if (s.propertyValueType !== PropertyValueType.NO_VALUE) d.setValue(s.value);
    } catch (e) { bad.n++; }
  }
  function copyGroup(src, dst, bad) {
    for (var i = 1; i <= src.numProperties; i++) {
      var s = src.property(i), d = null;
      if (dst.canAddProperty && dst.propertyType === PropertyType.INDEXED_GROUP && dst.canAddProperty(s.matchName)) {
        try { d = dst.addProperty(s.matchName); } catch (e) { d = null; }
      }
      if (!d) d = dst.property(s.matchName);
      if (!d) { bad.n++; continue; }
      try { if (s.propertyType !== PropertyType.PROPERTY && src.propertyType === PropertyType.INDEXED_GROUP) d.name = s.name; } catch (e) {}
      try { if (s.enabled === false) d.enabled = false; } catch (e) {}
      if (s.propertyType === PropertyType.PROPERTY) copyProp(s, d, bad);
      else copyGroup(s, d, bad);
    }
  }

  tools["ae.mergeShapes"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var shapes = [], all = selectedLayers(comp).sort(function (a, b) { return a.index - b.index; }), i;
    for (i = 0; i < all.length; i++) if (all[i] instanceof ShapeLayer && !all[i].locked) shapes.push(all[i]);
    if (shapes.length < 2) return fail("NEED_TWO_SHAPES");
    var target = shapes[0], bad = { n: 0 }, t = comp.time;
    var ttr = target.property("ADBE Transform Group");
    var tPos = ttr.property("ADBE Position").valueAtTime(t, false), tAnc = ttr.property("ADBE Anchor Point").valueAtTime(t, false);
    undoable(args.undoName, function () {
      var root = target.property("ADBE Root Vectors Group");
      for (var k = 1; k < shapes.length; k++) {
        var src = shapes[k], str = src.property("ADBE Transform Group");
        var g = root.addProperty("ADBE Vector Group");
        g.name = src.name;
        copyGroup(src.property("ADBE Root Vectors Group"), g.property("ADBE Vectors Group"), bad);
        var gt = g.property("ADBE Vector Transform Group");
        var p = str.property("ADBE Position").valueAtTime(t, false), a = str.property("ADBE Anchor Point").valueAtTime(t, false);
        var s = str.property("ADBE Scale").valueAtTime(t, false);
        // позиция группы в координатах верхнего слоя (без учёта его масштаба/поворота)
        gt.property("ADBE Vector Position").setValue([p[0] - tPos[0] + tAnc[0], p[1] - tPos[1] + tAnc[1]]);
        gt.property("ADBE Vector Anchor").setValue([a[0], a[1]]);
        gt.property("ADBE Vector Scale").setValue([s[0], s[1]]);
        gt.property("ADBE Vector Rotation").setValue(str.property("ADBE Rotate Z").valueAtTime(t, false));
        gt.property("ADBE Vector Group Opacity").setValue(str.property("ADBE Opacity").valueAtTime(t, false));
        src.enabled = false;
      }
    });
    return { ok: true, changed: shapes.length - 1, target: target.name, failedParams: bad.n };
  };

  /*
   * ae.textCounter — текстовый слой в центре кадра, Source Text считается выражением (код из панели).
   * args: { name, code, controls: [{ name, value }], marker: { name, duration }, fontSize, undoName }
   */
  tools["ae.textCounter"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layer = null;
    undoable(args.undoName, function () {
      layer = comp.layers.addText("0");
      layer.name = args.name || "Counter";
      var td = layer.property("ADBE Text Properties").property("ADBE Text Document"), doc = td.value;
      doc.fontSize = args.fontSize > 0 ? args.fontSize : 120;
      try { doc.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (e) {}
      td.setValue(doc);
      layer.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, comp.height / 2]);
      var tag = nextTag(layer), controls = args.controls || [];
      for (var c = 0; c < controls.length; c++) ensureControl(layer, { type: "slider", name: controls[c].name.split("@@").join(tag), value: controls[c].value });
      td.expression = args.code.split("@@").join(tag);
      td.expressionEnabled = true;
      addLayerMarker(layer, comp.time, args.marker.duration, args.marker.name.split("@@").join(tag));
    });
    return { ok: true, layer: layer.name, expressionError: layer.property("ADBE Text Properties").property("ADBE Text Document").expressionError || "" };
  };
