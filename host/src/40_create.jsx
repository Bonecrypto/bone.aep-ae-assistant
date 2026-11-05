
  /*
   * ae.create — новые слои.
   * args: { kind: "solid"|"adjustment"|"null"|"camera"|"vignette", name, color: [r,g,b] (0..1),
   *         parentSelected: true (для null), undoName }
   */
  // Эллипс с центром (cx, cy) и радиусами rx, ry — 4 вершины Безье.
  function ellipseShape(cx, cy, rx, ry) {
    var k = 0.5523;
    var s = new Shape();
    s.vertices = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
    s.inTangents = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
    s.outTangents = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
    s.closed = true;
    return s;
  }

  function avgPosition(layers, t) {
    var x = 0, y = 0, n = 0;
    for (var i = 0; i < layers.length; i++) {
      var tr = layers[i].property("ADBE Transform Group");
      var p = tr ? tr.property("ADBE Position") : null;
      if (!p) continue;
      var v = p.valueAtTime(t, false);
      x += v[0]; y += v[1]; n++;
    }
    return n ? [x / n, y / n] : null;
  }

  tools["ae.create"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var sel = selectedLayers(comp);
    var color = args.color || [0, 0, 0];
    var name = args.name || "Layer";
    var made = null, parented = 0;

    undoable(args.undoName, function () {
      var L = comp.layers;
      if (args.kind === "solid") {
        made = L.addSolid(color, name, comp.width, comp.height, comp.pixelAspect, comp.duration);
      } else if (args.kind === "adjustment") {
        made = L.addSolid([1, 1, 1], name, comp.width, comp.height, comp.pixelAspect, comp.duration);
        made.adjustmentLayer = true;
      } else if (args.kind === "null") {
        made = L.addNull(comp.duration);
        made.name = name;
        var center = avgPosition(sel, comp.time);
        if (center) made.property("ADBE Transform Group").property("ADBE Position").setValue(center);
        if (args.parentSelected) {
          for (var i = 0; i < sel.length; i++) {
            if (sel[i].locked) continue;
            sel[i].setParentWithJump(made);
            parented++;
          }
        }
      } else if (args.kind === "camera") {
        made = L.addCamera(name, [comp.width / 2, comp.height / 2]);
      } else if (args.kind === "vignette") {
        made = L.addSolid([0, 0, 0], name, comp.width, comp.height, comp.pixelAspect, comp.duration);
        var mask = made.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
        mask.property("ADBE Mask Shape").setValue(ellipseShape(comp.width / 2, comp.height / 2, comp.width * 0.55, comp.height * 0.6));
        var f = Math.round(Math.min(comp.width, comp.height) * 0.45);
        mask.property("ADBE Mask Feather").setValue([f, f]);
        mask.inverted = true;
        made.property("ADBE Transform Group").property("ADBE Opacity").setValue(70);
      }
      if (made) {
        made.startTime = 0;
        // новый слой — над самым верхним выделенным (или наверх композиции)
        var top = null;
        for (var j = 0; j < sel.length; j++) if (!top || sel[j].index < top.index) top = sel[j];
        if (top && args.kind !== "null" && top !== made) made.moveBefore(top);
      }
    });
    if (!made) return fail("BAD_ARGS", { field: "kind" });
    return { ok: true, layer: made.name, index: made.index, parented: parented };
  };

  /*
   * ae.addEffect — эффект на выделенные слои; если ничего не выделено — на новый корректирующий слой.
   * args: { matchName, adjustmentName, undoName }
   */
  tools["ae.addEffect"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp), applied = 0, created = false;
    undoable(args.undoName, function () {
      if (!layers.length) {
        var adj = comp.layers.addSolid([1, 1, 1], args.adjustmentName || "Adjustment", comp.width, comp.height, comp.pixelAspect, comp.duration);
        adj.adjustmentLayer = true;
        adj.startTime = 0;
        layers = [adj];
        created = true;
      }
      for (var i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (!fx || layers[i].locked || !fx.canAddProperty(args.matchName)) continue;
        fx.addProperty(args.matchName);
        applied++;
      }
    });
    if (!applied) return fail("EFFECT_UNAVAILABLE");
    return { ok: true, changed: applied, createdAdjustment: created };
  };
