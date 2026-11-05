
  /*
   * ae.style — эффект с заданными параметрами (по номеру параметра) на выделенные слои.
   * args: { matchName, name, params: [{ index, value }], keys: [{ index, from, to, duration, sweep }], undoName }
   * sweep: true — ключи точки от левого края слоя до правого (для бликов).
   * Номера параметров не зависят от языка AE (имена — зависят).
   */
  tools["ae.style"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var changed = 0, failed = 0;
    undoable(args.undoName, function () {
      for (var i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (!fx || layers[i].locked || !fx.canAddProperty(args.matchName)) continue;
        var e = fx.addProperty(args.matchName);
        if (args.name) e.name = args.name;
        var ps = args.params || [];
        for (var j = 0; j < ps.length; j++) {
          try { e.property(ps[j].index).setValue(ps[j].value); } catch (err) { failed++; }
        }
        var ks = args.keys || [];
        for (var k = 0; k < ks.length; k++) {
          var from = ks[k].from, to = ks[k].to;
          if (ks[k].sweep) {
            // проход по ширине слоя: от левого края до правого (с запасом), по середине высоты
            var r = layers[i].sourceRectAtTime(comp.time, false), y = r.top + r.height / 2;
            from = [r.left - r.width * 0.3, y]; to = [r.left + r.width * 1.3, y];
          }
          try { keyPair(e.property(ks[k].index), comp.time, comp.time + ks[k].duration, from, to, 33, 33); } catch (err2) { failed++; }
        }
        changed++;
      }
    });
    if (!changed) return fail("EFFECT_UNAVAILABLE");
    return { ok: true, changed: changed, failedParams: failed };
  };
