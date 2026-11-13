
  /*
   * Сервис.
   */
  function byIndex(a, b) { return a.index - b.index; }

  // Прекомпоз выделенных слоёв со всеми атрибутами.
  tools["ae.precompose"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp).sort(byIndex);
    if (!layers.length) return fail("NO_SELECTION");
    var made = null;
    undoable(args.undoName, function () {
      var idx = [];
      for (var i = 0; i < layers.length; i++) idx.push(layers[i].index);
      made = comp.layers.precompose(idx, args.name || "Precomp", true);
    });
    return { ok: true, comp: made.name, changed: layers.length };
  };

  /*
   * Разложить слои по очереди: каждый следующий начинается через stepFrames кадров
   * (mode "time") или на следующем маркере композиции (mode "markers").
   * Порядок — по номеру слоя в таймлайне (сверху вниз), args.reverse — снизу вверх.
   */
  tools["ae.sequence"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp).sort(byIndex);
    if (layers.length < 2 && args.mode !== "markers") return fail("NEED_TWO_LAYERS");
    if (!layers.length) return fail("NO_SELECTION");
    if (args.reverse) layers.reverse();

    var times = [];
    if (args.mode === "markers") {
      var m = comp.markerProperty;
      if (!m || m.numKeys === 0) return fail("NO_MARKERS");
      for (var k = 1; k <= m.numKeys; k++) times.push(m.keyTime(k));
    } else {
      var step = (args.stepFrames > 0 ? args.stepFrames : 5) * comp.frameDuration;
      var first = layers[0].inPoint;
      // groupSize > 1: слои стартуют пачками (1-2-3 вместе, потом 4-5-6...)
      var group = args.groupSize > 1 ? Math.round(args.groupSize) : 1;
      var offset = (args.offsetFrames || 0) * comp.frameDuration;
      for (var i = 0; i < layers.length; i++) times.push(first + offset + Math.floor(i / group) * step);
    }

    var changed = 0;
    undoable(args.undoName, function () {
      for (var j = 0; j < layers.length && j < times.length; j++) {
        if (layers[j].locked) continue;
        layers[j].startTime += times[j] - layers[j].inPoint;
        changed++;
      }
    });
    return { ok: true, changed: changed, extraLayers: Math.max(0, layers.length - times.length) };
  };

  // Покрасить слои по типу (номера меток AE 1..16). Все слои, если ничего не выделено.
  var LABEL_BY_KIND = { text: 1, shape: 2, precomp: 3, "null": 4, adjustment: 5, solid: 6, camera: 7, light: 7, video: 8, image: 9, audio: 12 };

  tools["ae.labelByType"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = selectedLayers(comp);
    if (!layers.length) for (var i = 1; i <= comp.numLayers; i++) layers.push(comp.layer(i));
    var changed = 0, counts = {};
    undoable(args.undoName, function () {
      for (var j = 0; j < layers.length; j++) {
        var kind = layerKind(layers[j]);
        var label = LABEL_BY_KIND[kind];
        if (!label) continue;
        layers[j].label = label;
        counts[kind] = (counts[kind] || 0) + 1;
        changed++;
      }
    });
    return { ok: true, changed: changed, counts: counts };
  };

  // Удалить из проекта неиспользуемые исходники (файлы на диске не трогаются).
  tools["ae.removeUnused"] = function (args) {
    if (!app.project) return fail("NO_PROJECT");
    var removed = 0;
    undoable(args.undoName, function () { removed = app.project.removeUnusedFootage(); });
    return { ok: true, changed: removed };
  };

  /*
   * Remove duplicated effects. mode "copies": an effect is a copy when an earlier
   * effect on the same layer has the same matchName and the same name without the
   * trailing number ("Deep Glow" / "Deep Glow 2"). mode "all": every effect.
   * scope "selected" or "all" (all layers of the active comp). Locked layers are skipped.
   */
  tools["ae.dedupeEffects"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var layers = [];
    if (args.scope === "selected") layers = selectedLayers(comp);
    else for (var i = 1; i <= comp.numLayers; i++) layers.push(comp.layer(i));
    if (!layers.length) return fail("NO_SELECTION");
    var removed = 0, touched = 0, locked = 0;
    function base(n) { return String(n).replace(/\s+\d+$/, ""); } // строка
    undoable(args.undoName, function () {
      for (var j = 0; j < layers.length; j++) {
        var fx = layers[j].property("ADBE Effect Parade");
        if (!fx || fx.numProperties === 0) continue;
        if (layers[j].locked) { locked++; continue; }
        var kill = [], seen = {};
        for (var k = 1; k <= fx.numProperties; k++) {
          var e = fx.property(k), key = e.matchName + "|" + base(e.name);
          if (args.mode === "all" || seen[key]) kill.push(k);
          else seen[key] = true;
        }
        for (var q = kill.length - 1; q >= 0; q--) fx.property(kill[q]).remove();
        if (kill.length) { removed += kill.length; touched++; }
      }
    });
    return { ok: true, changed: removed, layers: touched, locked: locked };
  };
