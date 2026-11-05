
  /*
   * ae.compInfo — сводка по активной композиции для чата (только чтение).
   */
  function round(v) {
    if (v instanceof Array) { var r = []; for (var i = 0; i < v.length; i++) r.push(round(v[i])); return r; }
    return typeof v === "number" ? Math.round(v * 100) / 100 : v;
  }

  tools["ae.compInfo"] = function (args) {
    var comp = activeComp();
    if (!comp) return { ok: true, comp: null, projectItems: app.project ? app.project.numItems : 0 };
    var max = args.maxLayers > 0 ? args.maxLayers : 40;
    var layers = [];
    for (var i = 1; i <= comp.numLayers && layers.length < max; i++) {
      var l = comp.layer(i);
      var info = { index: l.index, name: l.name, kind: layerKind(l), selected: l.selected, locked: l.locked,
        inPoint: round(l.inPoint), outPoint: round(l.outPoint) };
      if (l.parent) info.parent = l.parent.index;
      if (l instanceof TextLayer) {
        try { info.text = String(l.property("ADBE Text Properties").property("ADBE Text Document").value.text).substring(0, 80); } catch (e) {}
      }
      if (l.selected) {
        var sp = l.selectedProperties, props = [];
        for (var j = 0; j < sp.length; j++) {
          if (sp[j].propertyType !== PropertyType.PROPERTY) continue;
          props.push({ name: sp[j].name, keys: sp[j].numKeys, selectedKeys: sp[j].selectedKeys.length, expression: sp[j].canSetExpression ? sp[j].expression : "" });
        }
        if (props.length) info.selectedProperties = props;
      }
      layers.push(info);
    }
    var markers = [];
    var m = comp.markerProperty;
    if (m) for (var k = 1; k <= m.numKeys && k <= 50; k++) markers.push(round(m.keyTime(k)));
    return { ok: true, comp: {
      name: comp.name, width: comp.width, height: comp.height, fps: round(comp.frameRate),
      duration: round(comp.duration), time: round(comp.time), numLayers: comp.numLayers,
      selectedCount: comp.selectedLayers.length, markers: markers, layers: layers, truncated: comp.numLayers > layers.length
    } };
  };

  tools["system.ping"] = function () {
    return { ok: true, appVersion: app.version, hostVersion: VERSION, hasComp: activeComp() !== null };
  };
