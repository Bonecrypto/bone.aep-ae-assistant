
  /*
   * Звук, субтитры, морфинг.
   *   ae.audioInfo  — путь к файлу и время выделенного (или первого) слоя со звуком
   *   ae.addMarkers — маркеры по списку времён (биты): на композицию или на слой
   *   ae.subtitles  — текстовые слои по фразам (у каждого своё время), внизу или по центру
   *   ae.morph      — первая выделенная фигура перетекает во вторую
   */
  function audioLayer(comp) {
    var sel = selectedLayers(comp), i;
    for (i = 0; i < sel.length; i++) if (sel[i].hasAudio && sel[i].source && sel[i].source.file) return sel[i];
    for (i = 1; i <= comp.numLayers; i++) { var l = comp.layer(i); if (l.hasAudio && l.source && l.source.file) return l; }
    return null;
  }

  tools["ae.audioInfo"] = function () {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var l = audioLayer(comp);
    if (!l) return fail("NO_AUDIO");
    return { ok: true, path: l.source.file.fsName, name: l.name, index: l.index, startTime: l.startTime, inPoint: l.inPoint, outPoint: l.outPoint,
      stretch: l.stretch, duration: comp.duration };
  };

  tools["ae.addMarkers"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var mp = comp.markerProperty, layer = null;
    if (args.target === "layer" && args.layerIndex) { layer = comp.layer(args.layerIndex); mp = layer.property("ADBE Marker"); }
    var times = args.times || [], added = 0, removed = 0;
    undoable(args.undoName, function () {
      if (args.replace) {
        for (var k = mp.numKeys; k >= 1; k--) {
          var c = mp.keyValue(k).comment;
          if (c.indexOf(args.comment) === 0) { mp.removeKey(k); removed++; } // строка
        }
      }
      for (var i = 0; i < times.length; i++) {
        var mv = new MarkerValue(args.comment + " " + (i + 1));
        try { mv.label = 10; } catch (e) {}
        mp.setValueAtTime(times[i], mv);
        added++;
      }
    });
    return { ok: true, changed: added, removed: removed };
  };

  tools["ae.subtitles"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var segs = args.segments || [], made = 0, style = args.style || null;
    var w = Math.round(comp.width * 0.8), h = Math.round(comp.height * 0.25);
    undoable(args.undoName, function () {
      for (var i = segs.length - 1; i >= 0; i--) {
        var s = segs[i];
        var l = comp.layers.addBoxText([w, h]);
        var td = l.property("ADBE Text Properties").property("ADBE Text Document"), doc = td.value;
        doc.text = s.text;
        doc.fontSize = args.fontSize > 0 ? args.fontSize : Math.round(comp.height / 18);
        doc.applyFill = true; doc.fillColor = [1, 1, 1];
        try { doc.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (e) {}
        if (style) for (var j = 0; j < STYLE_FIELDS.length; j++) {
          var f = STYLE_FIELDS[j];
          if (style.hasOwnProperty(f) && f !== "justification") { try { doc[f] = style[f]; } catch (e2) {} }
        }
        td.setValue(doc);
        l.name = String(s.text).substring(0, 40);
        var y = args.position === "center" ? comp.height / 2 : comp.height * 0.82;
        l.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width / 2, y]);
        l.startTime = 0;
        l.inPoint = s.start;
        l.outPoint = Math.max(s.end, s.start + comp.frameDuration);
        made++;
      }
    });
    return { ok: true, changed: made };
  };

  // Первая фигура (Shape) на шейп-слое: путь, прямоугольник или эллипс -> значение Shape в координатах слоя.
  function firstShape(group) {
    for (var i = 1; i <= group.numProperties; i++) {
      var p = group.property(i), mn = p.matchName;
      if (mn === "ADBE Vector Shape - Group") return { prop: p.property("ADBE Vector Shape"), owner: group, item: p };
      if (mn === "ADBE Vector Shape - Rect") {
        var sz = p.property("ADBE Vector Rect Size").value, ps = p.property("ADBE Vector Rect Position").value, rr = roundRect(sz[0], sz[1], p.property("ADBE Vector Rect Roundness").value);
        var v = rr.vertices; for (var a = 0; a < v.length; a++) v[a] = [v[a][0] + ps[0], v[a][1] + ps[1]]; rr.vertices = v;
        return { shape: rr, owner: group, item: p };
      }
      if (mn === "ADBE Vector Shape - Ellipse") {
        var es = p.property("ADBE Vector Ellipse Size").value, ep = p.property("ADBE Vector Ellipse Position").value;
        return { shape: ellipseShape(ep[0], ep[1], es[0] / 2, es[1] / 2), owner: group, item: p };
      }
      if (p.propertyType !== PropertyType.PROPERTY) { var r = firstShape(p); if (r) return r; }
    }
    return null;
  }

  tools["ae.morph"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var sel = selectedLayers(comp), shapes = [], i;
    for (i = 0; i < sel.length; i++) if (sel[i] instanceof ShapeLayer) shapes.push(sel[i]);
    if (shapes.length !== 2) return fail("NEED_TWO_SHAPES");
    // порядок выделения: сначала «из», потом «в»
    var A = shapes[0], B = shapes[1], t0 = comp.time, t1 = t0 + (args.duration > 0 ? args.duration : 1);
    var fa = firstShape(A.property("ADBE Root Vectors Group")), fb = firstShape(B.property("ADBE Root Vectors Group"));
    if (!fa || !fb) return fail("NO_PATH");
    undoable(args.undoName, function () {
      var target = fa.prop;
      if (!target) {
        // у A параметрическая фигура: добавляем путь с её формой, а саму фигуру выключаем
        var pg = fa.owner.addProperty("ADBE Vector Shape - Group");
        pg.moveTo(fa.item.propertyIndex);
        target = pg.property("ADBE Vector Shape");
        target.setValue(fa.shape);
        fa.item.enabled = false;
      }
      var from = target.valueAtTime(t0, false);
      var to = fb.prop ? fb.prop.valueAtTime(t0, false) : fb.shape;
      // переводим форму B в координаты слоя A (по разнице позиций слоёв)
      var pa = A.property("ADBE Transform Group").property("ADBE Position").valueAtTime(t0, false);
      var pb = B.property("ADBE Transform Group").property("ADBE Position").valueAtTime(t0, false);
      var shifted = new Shape(), vv = to.vertices;
      for (var k = 0; k < vv.length; k++) vv[k] = [vv[k][0] + pb[0] - pa[0], vv[k][1] + pb[1] - pa[1]];
      shifted.vertices = vv; shifted.inTangents = to.inTangents; shifted.outTangents = to.outTangents; shifted.closed = to.closed;
      keyPair(target, t0, t1, from, shifted, 50, 50);
      B.enabled = false;
    });
    return { ok: true, from: A.name, to: B.name };
  };
