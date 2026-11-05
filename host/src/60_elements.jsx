
  /*
   * ae.element — шейп-элемент с анимацией прорисовки (Trim Paths).
   * args: { kind: "underline"|"arrow"|"circle"|"frame"|"burst"|"cross", color: [r,g,b], width: 8,
   *         duration: 0.8, name, undoName }
   * Элемент ставится в центр кадра (или в центр выделенных слоёв), размеры — от размера кадра.
   */
  function openPath(points) {
    var s = new Shape();
    s.vertices = points;
    s.closed = false;
    return s;
  }

  function addPath(groupContents, points) {
    var p = groupContents.addProperty("ADBE Vector Shape - Group");
    p.property("ADBE Vector Shape").setValue(openPath(points));
    return p;
  }

  tools["ae.element"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var sel = selectedLayers(comp);
    var color = args.color || [1, 1, 1];
    var width = args.width > 0 ? args.width : 8;
    var duration = args.duration > 0 ? args.duration : 0.8;
    var t0 = comp.time, t1 = t0 + duration;
    var u = Math.min(comp.width, comp.height); // базовая единица размера
    var made = null;

    undoable(args.undoName, function () {
      var layer = comp.layers.addShape();
      layer.name = args.name || "Element";
      var root = layer.property("ADBE Root Vectors Group");
      var group = root.addProperty("ADBE Vector Group");
      var c = group.property("ADBE Vectors Group");
      var k = args.kind, i;

      if (k === "underline") {
        addPath(c, [[-u * 0.3, 0], [u * 0.3, 0]]);
      } else if (k === "arrow") {
        var L = u * 0.22, h = u * 0.06;
        addPath(c, [[-L, 0], [L, 0]]);
        addPath(c, [[L - h, -h], [L, 0], [L - h, h]]);
      } else if (k === "circle") {
        c.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([u * 0.35, u * 0.35]);
      } else if (k === "frame") {
        c.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([u * 0.6, u * 0.34]);
      } else if (k === "cross") {
        var x = u * 0.12;
        addPath(c, [[-x, -x], [x, x]]);
        addPath(c, [[x, -x], [-x, x]]);
      } else if (k === "burst") {
        var r1 = u * 0.08, r2 = u * 0.16;
        for (i = 0; i < 8; i++) {
          var a = i * Math.PI / 4;
          addPath(c, [[Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(a) * r2, Math.sin(a) * r2]]);
        }
      } else {
        layer.remove();
        return;
      }

      var stroke = c.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("ADBE Vector Stroke Color").setValue([color[0], color[1], color[2], 1]);
      stroke.property("ADBE Vector Stroke Width").setValue(width);
      try { stroke.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {} // 2 = круглые концы

      var trim = c.addProperty("ADBE Vector Filter - Trim");
      var tEnd = trim.property("ADBE Vector Trim End");
      var tStart = trim.property("ADBE Vector Trim Start");
      if (k === "burst") {
        // лучи вылетают и исчезают: End 0->100, затем Start 0->100
        keyPair(tEnd, t0, t0 + duration * 0.6, 0, 100, 10, 80);
        keyPair(tStart, t0 + duration * 0.4, t1, 0, 100, 30, 80);
      } else {
        keyPair(tEnd, t0, t1, 0, 100, 20, 80);
      }

      var center = sel.length ? avgPosition(sel, t0) : null;
      if (center) layer.property("ADBE Transform Group").property("ADBE Position").setValue(center);
      layer.startTime = 0;
      made = layer;
    });
    if (!made) return fail("BAD_ARGS", { field: "kind" });
    return { ok: true, layer: made.name };
  };
