
  /*
   * ae.reverseKeys — развернуть ключи во времени (как Reverse Keyframes): выделенные ключи
   * (минимум 2 на свойстве), иначе все ключи выделенных свойств. Ease и касательные меняются местами.
   */
  tools["ae.reverseKeys"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) return fail("NO_SELECTION");
    var props = selectedProps(layers), changed = 0;
    undoable(args.undoName, function () {
      for (var i = 0; i < props.length; i++) {
        var p = props[i].prop;
        if (!p.canVaryOverTime || p.numKeys < 2) continue;
        var idx = p.selectedKeys, j, k;
        if (idx.length < 2) { idx = []; for (k = 1; k <= p.numKeys; k++) idx.push(k); }
        var spatial = isSpatial(p), keys = [];
        for (j = 0; j < idx.length; j++) {
          k = idx[j];
          keys.push({
            t: p.keyTime(k), v: p.keyValue(k), inI: p.keyInInterpolationType(k), outI: p.keyOutInterpolationType(k),
            inE: p.keyInTemporalEase(k), outE: p.keyOutTemporalEase(k),
            inS: spatial ? p.keyInSpatialTangent(k) : null, outS: spatial ? p.keyOutSpatialTangent(k) : null
          });
        }
        var t0 = keys[0].t, t1 = keys[keys.length - 1].t;
        for (j = idx.length - 1; j >= 0; j--) p.removeKey(idx[j]);
        for (j = 0; j < keys.length; j++) p.setValueAtTime(t0 + t1 - keys[j].t, keys[j].v);
        for (j = 0; j < keys.length; j++) {
          var n = p.nearestKeyIndex(t0 + t1 - keys[j].t), K = keys[j];
          // сначала ease (он может переключить ключ в Безье), потом исходные типы интерполяции
          p.setTemporalEaseAtKey(n, K.outE, K.inE);
          p.setInterpolationTypeAtKey(n, K.outI, K.inI);
          if (spatial) p.setSpatialTangentsAtKey(n, K.outS, K.inS);
        }
        changed++;
      }
    });
    if (!changed) return fail("NO_KEY_PAIRS");
    return { ok: true, changed: changed };
  };
