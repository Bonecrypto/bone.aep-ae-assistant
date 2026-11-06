
  /*
   * ae.glass — стеклянная плашка (Liquid Glass) в центре композиции.
   *   1. Шейп-слой «плашка»: скруглённый прямоугольник, лёгкая заливка, светлая обводка, мягкая тень.
   *   2. Под ним корректирующий слой с такой же маской: матовое размытие и осветление того, что ниже.
   *      Он привязан к плашке (parent) — двигаешь/масштабируешь плашку, стекло едет вместе с ней.
   * args: { width, height, radius, frost, tint, color: [r,g,b], stroke, shadow, name, blurName, undoName }
   */
  function roundRect(w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    var k = 0.5523 * r, x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    var s = new Shape();
    // по часовой стрелке, начиная с верхнего края; у каждой вершины касательная к дуге угла
    s.vertices = [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]];
    s.inTangents = [[-k, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]];
    s.outTangents = [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]];
    s.closed = true;
    return s;
  }

  tools["ae.glass"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var w = args.width > 0 ? args.width : 600, h = args.height > 0 ? args.height : 300, r = args.radius >= 0 ? args.radius : 60;
    var color = args.color || [1, 1, 1], bad = { n: 0 }, plate = null;
    var cx = comp.width / 2, cy = comp.height / 2;

    undoable(args.undoName, function () {
      // корректирующий слой: размытие того, что под стеклом
      var adj = comp.layers.addSolid([1, 1, 1], args.blurName || "Glass blur", comp.width, comp.height, comp.pixelAspect, comp.duration);
      adj.adjustmentLayer = true;
      adj.startTime = 0;
      var mask = adj.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
      var rr = roundRect(w, h, r), v = rr.vertices, i;
      for (i = 0; i < v.length; i++) v[i] = [v[i][0] + cx, v[i][1] + cy];
      rr.vertices = v;
      mask.property("ADBE Mask Shape").setValue(rr);
      var gb = addFx(adj, "ADBE Gaussian Blur 2");
      if (gb) { trySet(gb, 1, args.frost >= 0 ? args.frost : 30, bad); trySet(gb, 3, 1, bad); }
      var bc = addFx(adj, "ADBE Brightness & Contrast 2");
      if (bc) trySet(bc, 1, 8, bad); // чуть светлее, как матовое стекло

      // плашка: заливка + обводка + тень
      plate = comp.layers.addShape();
      plate.name = args.name || "Glass";
      plate.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);
      var g = plate.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
      var c = g.property("ADBE Vectors Group");
      var rect = c.addProperty("ADBE Vector Shape - Rect");
      rect.property("ADBE Vector Rect Size").setValue([w, h]);
      rect.property("ADBE Vector Rect Roundness").setValue(r);
      var fill = c.addProperty("ADBE Vector Graphic - Fill");
      fill.property("ADBE Vector Fill Color").setValue([color[0], color[1], color[2], 1]);
      fill.property("ADBE Vector Fill Opacity").setValue(args.tint >= 0 ? args.tint : 12);
      if (args.stroke > 0) {
        var st = c.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue([1, 1, 1, 1]);
        st.property("ADBE Vector Stroke Width").setValue(args.stroke);
        st.property("ADBE Vector Stroke Opacity").setValue(45);
      }
      if (args.shadow > 0) {
        var ds = addFx(plate, "ADBE Drop Shadow");
        if (ds) { trySet(ds, 2, Math.round(args.shadow * 2.55), bad); trySet(ds, 3, 180, bad); trySet(ds, 4, 18, bad); trySet(ds, 5, 60, bad); }
      }
      plate.startTime = 0;
      adj.moveAfter(plate);
      // стекло следует за плашкой
      adj.setParentWithJump(plate);
    });
    return { ok: true, layer: plate.name, failedParams: bad.n };
  };
