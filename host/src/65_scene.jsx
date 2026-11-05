
  /*
   * ae.sceneTransition — переход между сценами на склейке (склейка = текущее время).
   * Новый слой сверху длиной duration, по центру склейки. Без ключей: время перехода = края слоя.
   * args: { kind: "dip"|"flash"|"blur"|"zoomIn"|"zoomOut"|"whip"|"spin", duration, side, amount, motionBlur, name, undoName }
   * Номера параметров эффектов: Motion Tile (4 ширина, 5 высота, 6 зеркальные края),
   * Transform (2 позиция, 4 масштаб, 8 поворот, 10 «угол затвора композиции», 11 угол затвора).
   */
  // Время перехода — сам слой: p = 0 на входе слоя, 0,5 на склейке, 1 на выходе.
  // Тянешь края слоя — меняется длительность, двигаешь слой — сдвигается переход.
  var LP = "var p = Math.min(1, Math.max(0, (time - inPoint) / Math.max(outPoint - inPoint, 0.001)));\n";

  function lit(v) { return v instanceof Array ? vec(v) : num(v); }

  // Разгон к склейке (a -> b), на склейке перескок, торможение (c -> d).
  // Смешивание from -> to по e: для чисел — обычная арифметика, для массивов — add/mul/sub.
  function lerpExpr(from, to) {
    if (!(from instanceof Array)) return num(from) + " + (" + num(to) + " - " + num(from) + ") * e";
    return "add(" + lit(from) + ", mul(sub(" + lit(to) + ", " + lit(from) + "), e))";
  }

  function throughCut(prop, a, b, c, d) {
    prop.expression = "// AE Assistant: transition\n" + LP +
      "if (p < 0.5) { var q = p * 2, e = q * q * q; " + lerpExpr(a, b) + "; }\n" +
      "else { var q = (p - 0.5) * 2, e = 1 - Math.pow(1 - q, 3); " + lerpExpr(c, d) + "; }";
    prop.expressionEnabled = true;
  }

  // Подъём к склейке и спад: 0 -> peak -> 0 (sharp — для вспышки).
  function bump(prop, peak, sharp) {
    prop.expression = "// AE Assistant: transition\n" + LP +
      "var s = p < 0.5 ? p * 2 : (1 - p) * 2; s = s * s * (3 - 2 * s);\n" + (sharp ? "s = s * s * s;\n" : "") + num(peak) + " * s";
    prop.expressionEnabled = true;
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
    var k = args.kind, amount = args.amount > 0 ? args.amount : 100;
    var bad = { n: 0 }, made = null;

    undoable(args.undoName, function () {
      var L = comp.layers, w = comp.width, h = comp.height;
      if (k === "dip" || k === "flash") {
        made = L.addSolid(k === "dip" ? [0, 0, 0] : [1, 1, 1], args.name || "Transition", w, h, comp.pixelAspect, d);
        bump(made.property("ADBE Transform Group").property("ADBE Opacity"), Math.min(100, amount), k === "flash");
      } else {
        made = L.addSolid([1, 1, 1], args.name || "Transition", w, h, comp.pixelAspect, d);
        made.adjustmentLayer = true;
        if (k === "blur") {
          var gb = addFx(made, "ADBE Gaussian Blur 2");
          trySet(gb, 3, 1, bad); // повторять краевые пиксели
          bump(gb.property(1), amount, false);
        } else {
          // зеркальные края, чтобы при сдвиге/повороте не было чёрных полей
          var tile = addFx(made, "ADBE Tile");
          if (tile) { trySet(tile, 4, 300, bad); trySet(tile, 5, 300, bad); trySet(tile, 6, 1, bad); }
          var tf = addFx(made, "ADBE Geometry2");
          if (args.motionBlur !== false) { trySet(tf, 10, 0, bad); trySet(tf, 11, 240, bad); }
          var c = [w / 2, h / 2];
          if (k === "zoomIn") throughCut(tf.property(4), 100, amount * 3, 10000 / (amount * 3), 100);
          if (k === "zoomOut") throughCut(tf.property(4), 100, 10000 / (amount * 3), amount * 3, 100);
          if (k === "spin") throughCut(tf.property(8), 0, amount * 1.8, -amount * 1.8, 0);
          if (k === "whip") {
            var horiz = args.side === "left" || args.side === "right";
            var sign = args.side === "left" || args.side === "up" ? -1 : 1;
            var D = (horiz ? w : h) * amount / 100;
            var off = horiz ? [sign * D, 0] : [0, sign * D];
            throughCut(tf.property(2), c, [c[0] + off[0], c[1] + off[1]], [c[0] - off[0], c[1] - off[1]], c);
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
