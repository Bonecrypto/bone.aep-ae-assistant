
  /*
   * Графики скорости.
   * Кривая задаётся как в CSS: cubic-bezier(x1, y1, x2, y2) на отрезке между двумя ключами.
   * Перевод в KeyframeEase (средняя скорость отрезка avg = dv / dt):
   *   выход из ключа k:   influence = x1*100,      speed = y1/x1 * avg
   *   вход в ключ k+1:    influence = (1-x2)*100,  speed = (1-y2)/(1-x2) * avg
   * Для пространственных свойств avg — длина прямой между ключами (скорость >= 0),
   * для TwoD/ThreeD — по каждому измерению отдельно.
   */

  function segmentAvg(prop, k) {
    var dt = prop.keyTime(k + 1) - prop.keyTime(k);
    var a = prop.keyValue(k), b = prop.keyValue(k + 1);
    var t = prop.propertyValueType;
    if (dt <= 0) return null;
    if (isSpatial(prop)) {
      var s = 0;
      for (var i = 0; i < a.length; i++) s += (b[i] - a[i]) * (b[i] - a[i]);
      return { spatial: true, avg: Math.sqrt(s) / dt };
    }
    if (t === PropertyValueType.OneD) return { avg: (b - a) / dt };
    if (t === PropertyValueType.TwoD || t === PropertyValueType.ThreeD) {
      var r = [];
      for (var d = 0; d < a.length; d++) r.push((b[d] - a[d]) / dt);
      return { avg: r };
    }
    return { avg: 0 }; // цвет и прочее: только influence
  }

  function scaleSpeed(avg, factor, spatial) {
    if (avg instanceof Array) {
      var r = [];
      for (var i = 0; i < avg.length; i++) r.push(avg[i] * factor);
      return r;
    }
    var v = avg * factor;
    return spatial && v < 0 ? 0 : v;
  }

  // Пары соседних выделенных ключей на выделенных свойствах.
  function selectedSegments(layers) {
    var props = selectedProps(layers), segs = [], lonely = 0;
    for (var i = 0; i < props.length; i++) {
      var p = props[i].prop;
      if (!p.canVaryOverTime || p.numKeys < 2) continue;
      var keys = p.selectedKeys, found = false;
      for (var j = 0; j + 1 < keys.length; j++) {
        if (keys[j + 1] === keys[j] + 1) { segs.push({ prop: p, k: keys[j] }); found = true; }
      }
      if (!found && keys.length) lonely++;
    }
    return { segs: segs, lonely: lonely };
  }

  tools["ae.ease"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var found = selectedSegments(layers);
    if (!found.segs.length) return fail("NO_KEY_PAIRS");

    var c = args.curve, m = args.manual;
    if (!c && !m) return fail("BAD_ARGS", { field: "curve" });
    var changed = 0;

    undoable(args.undoName, function () {
      for (var i = 0; i < found.segs.length; i++) {
        var p = found.segs[i].prop, k = found.segs[i].k;
        var info = segmentAvg(p, k);
        if (!info) continue;
        var n = easeDims(p);
        var outInf, inInf, outSpeed, inSpeed;
        if (c) {
          outInf = c[0] * 100;
          inInf = (1 - c[2]) * 100;
          outSpeed = c[0] > 0.001 ? scaleSpeed(info.avg, c[1] / c[0], info.spatial) : scaleSpeed(info.avg, 0, info.spatial);
          inSpeed = c[2] < 0.999 ? scaleSpeed(info.avg, (1 - c[3]) / (1 - c[2]), info.spatial) : scaleSpeed(info.avg, 0, info.spatial);
        } else {
          outInf = m.outInfluence; inInf = m.inInfluence;
          outSpeed = m.outSpeed; inSpeed = m.inSpeed;
        }
        var B = KeyframeInterpolationType.BEZIER;
        p.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), B);
        p.setInterpolationTypeAtKey(k + 1, B, p.keyOutInterpolationType(k + 1));
        p.setTemporalEaseAtKey(k, p.keyInTemporalEase(k), easeList(n, outSpeed, outInf));
        p.setTemporalEaseAtKey(k + 1, easeList(n, inSpeed, inInf), p.keyOutTemporalEase(k + 1));
        changed++;
      }
    });
    return { ok: true, changed: changed, lonely: found.lonely };
  };

  // Обратный перевод: кривая первого выделенного отрезка -> cubic-bezier.
  tools["ae.readEase"] = function () {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var found = selectedSegments(layers);
    if (!found.segs.length) return fail("NO_KEY_PAIRS");
    var p = found.segs[0].prop, k = found.segs[0].k;
    var info = segmentAvg(p, k);
    // для многомерных берём первое измерение, которое реально меняется
    var j = 0, avg = info.avg;
    if (avg instanceof Array) {
      for (var d = 0; d < avg.length; d++) if (Math.abs(avg[d]) > 1e-9) { j = d; break; }
      avg = avg[j];
    }
    var outE = p.keyOutTemporalEase(k), inE = p.keyInTemporalEase(k + 1);
    if (j >= outE.length) j = 0;
    outE = outE[j]; inE = inE[j];
    var x1 = outE.influence / 100, x2 = 1 - inE.influence / 100;
    var moving = Math.abs(avg) > 1e-9;
    var y1 = moving ? outE.speed * x1 / avg : 0;
    var y2 = moving ? 1 - inE.speed * (1 - x2) / avg : 1;
    return {
      ok: true, curve: [x1, y1, x2, y2], property: p.name,
      manual: { outSpeed: outE.speed, outInfluence: outE.influence, inSpeed: inE.speed, inInfluence: inE.influence }
    };
  };
