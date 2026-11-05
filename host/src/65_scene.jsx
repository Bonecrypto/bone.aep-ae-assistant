
  /*
   * ae.sceneTransition — переход между сценами на склейке (склейка = текущее время).
   * Новый слой сверху длиной duration, по центру склейки.
   * args: { kind: "dip"|"flash"|"blur"|"zoomIn"|"zoomOut"|"whip"|"spin", duration, side, amount, motionBlur, name, undoName }
   * Номера параметров эффектов: Motion Tile (4 ширина, 5 высота, 6 зеркальные края),
   * Transform (2 позиция, 4 масштаб, 8 поворот, 10 «угол затвора композиции», 11 угол затвора).
   */
  function setKeys(prop, keys) {
    var i, n = easeDims(prop), B = KeyframeInterpolationType.BEZIER;
    for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i].t, keys[i].v);
    for (i = 0; i < keys.length; i++) {
      var k = prop.nearestKeyIndex(keys[i].t);
      prop.setInterpolationTypeAtKey(k, B, B);
      prop.setTemporalEaseAtKey(k, easeList(n, 0, keys[i].inf || 33), easeList(n, 0, keys[i].outf || 33));
    }
  }

  // «Разгон к склейке — рывок — торможение»: 4 ключа, на склейке значение перескакивает.
  function throughCut(prop, t0, t, t1, eps, a, b, c, d) {
    setKeys(prop, [
      { t: t0, v: a, outf: 75 }, { t: t - eps, v: b, inf: 8 },
      { t: t, v: c, outf: 8 }, { t: t1, v: d, inf: 75 }
    ]);
    // на самой склейке скорость не обнуляем: вход и выход линейные
    prop.setInterpolationTypeAtKey(prop.nearestKeyIndex(t - eps), KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.BEZIER);
    prop.setInterpolationTypeAtKey(prop.nearestKeyIndex(t), KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.LINEAR);
  }

  function addFx(layer, match) {
    var fx = layer.property("ADBE Effect Parade");
    return fx.canAddProperty(match) ? fx.addProperty(match) : null;
  }

  function trySet(e, idx, v, bad) { try { e.property(idx).setValue(v); } catch (err) { bad.n++; } }

  tools["ae.sceneTransition"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var d = args.duration > 0 ? args.duration : 0.6, t = comp.time, t0 = t - d / 2, t1 = t + d / 2;
    if (t0 < 0) { t0 = 0; }
    var eps = comp.frameDuration, k = args.kind, amount = args.amount > 0 ? args.amount : 100;
    var bad = { n: 0 }, made = null;

    undoable(args.undoName, function () {
      var L = comp.layers, w = comp.width, h = comp.height;
      if (k === "dip" || k === "flash") {
        made = L.addSolid(k === "dip" ? [0, 0, 0] : [1, 1, 1], args.name || "Transition", w, h, comp.pixelAspect, d);
        setKeys(made.property("ADBE Transform Group").property("ADBE Opacity"), [
          { t: t0, v: 0, outf: 60 }, { t: t, v: Math.min(100, amount), inf: k === "flash" ? 10 : 60, outf: k === "flash" ? 10 : 60 }, { t: t1, v: 0, inf: 60 }
        ]);
      } else {
        made = L.addSolid([1, 1, 1], args.name || "Transition", w, h, comp.pixelAspect, d);
        made.adjustmentLayer = true;
        if (k === "blur") {
          var gb = addFx(made, "ADBE Gaussian Blur 2");
          trySet(gb, 3, 1, bad); // повторять краевые пиксели
          setKeys(gb.property(1), [{ t: t0, v: 0, outf: 70 }, { t: t, v: amount, inf: 30, outf: 30 }, { t: t1, v: 0, inf: 70 }]);
        } else {
          // зеркальные края, чтобы при сдвиге/повороте не было чёрных полей
          var tile = addFx(made, "ADBE Tile");
          if (tile) { trySet(tile, 4, 300, bad); trySet(tile, 5, 300, bad); trySet(tile, 6, 1, bad); }
          var tf = addFx(made, "ADBE Geometry2");
          if (args.motionBlur !== false) { trySet(tf, 10, 0, bad); trySet(tf, 11, 240, bad); }
          var c = [w / 2, h / 2];
          if (k === "zoomIn") throughCut(tf.property(4), t0, t, t1, eps, 100, amount * 3, 10000 / (amount * 3), 100);
          if (k === "zoomOut") throughCut(tf.property(4), t0, t, t1, eps, 100, 10000 / (amount * 3), amount * 3, 100);
          if (k === "spin") throughCut(tf.property(8), t0, t, t1, eps, 0, amount * 1.8, -amount * 1.8, 0);
          if (k === "whip") {
            var horiz = args.side === "left" || args.side === "right";
            var sign = args.side === "left" || args.side === "up" ? -1 : 1;
            var D = (horiz ? w : h) * amount / 100;
            var off = horiz ? [sign * D, 0] : [0, sign * D];
            throughCut(tf.property(2), t0, t, t1, eps, c, [c[0] + off[0], c[1] + off[1]], [c[0] - off[0], c[1] - off[1]], c);
          }
        }
      }
      made.startTime = t0;
      made.inPoint = t0;
      made.outPoint = t1;
      made.moveToBeginning();
    });
    if (!made) return fail("BAD_ARGS", { field: "kind" });
    return { ok: true, layer: made.name, failedParams: bad.n, start: t0, end: t1 };
  };
