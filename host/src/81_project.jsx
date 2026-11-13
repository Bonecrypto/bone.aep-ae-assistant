
  /*
   * «Старт проекта»: папки по шаблону, главная композиция, раскладка элементов по папкам,
   * безопасные зоны (направляющие слои) и порядок слоёв по времени.
   *   ae.projectInfo   — дёшево: число элементов, файл проекта, ревизия (для опроса панелью)
   *   ae.projectStart  — папки + главная композиция + раскладка корня (одна undo-группа, без дублей)
   *   ae.organize      — разложить элементы из корня проекта по папкам
   *   ae.safeZone      — направляющий слой «PA Safe …» (Guide Layer: виден в работе, не рендерится)
   *   ae.safeZoneToggle— скрыть / показать / удалить слои «PA Safe»
   *   ae.orderLayers   — порядок слоёв по времени входа (лесенкой сверху вниз или снизу вверх)
   */
  tools["ae.projectInfo"] = function () {
    if (!app.project) return fail("NO_PROJECT");
    return { ok: true, numItems: app.project.numItems, file: app.project.file ? app.project.file.fsName : null, revision: app.project.revision };
  };

  function lower(s) { return String(s).toLowerCase(); }

  function childFolder(parent, name) {
    for (var i = 1; i <= parent.numItems; i++) {
      var it = parent.item(i);
      if (it instanceof FolderItem && lower(it.name) === lower(name)) return it;
    }
    return null;
  }

  // Путь «A/B/C» -> папка (существующая или новая). created.n — сколько создано.
  function ensurePath(path, created) {
    var parts = String(path).split("/"), cur = app.project.rootFolder;
    for (var i = 0; i < parts.length; i++) {
      var name = parts[i].replace(/^\s+|\s+$/g, "");
      if (!name) continue;
      var f = childFolder(cur, name);
      if (!f) { f = app.project.items.addFolder(name); f.parentFolder = cur; created.n++; }
      cur = f;
    }
    return cur;
  }

  function extOf(item) {
    try { if (item.file) { var m = /\.([a-z0-9]+)$/i.exec(item.file.name); return m ? lower(m[1]) : ""; } } catch (e) {}
    return "";
  }

  var EXT_KIND = {
    mp4: "video", mov: "video", mxf: "video", avi: "video", mkv: "video", webm: "video", m4v: "video",
    jpg: "photo", jpeg: "photo", heic: "photo", tif: "photo", tiff: "photo", webp: "photo",
    png: "png", psd: "png", ai: "vectors", eps: "vectors", svg: "vectors", pdf: "vectors",
    wav: "audio", mp3: "audio", aif: "audio", aiff: "audio", m4a: "audio", flac: "audio", ogg: "audio"
  };
  // слова в имени (русские — через \u, в коде только ASCII): лого, музык/трек, голос/интервью
  var RX_LOGO = /logo|\u043b\u043e\u0433\u043e/i;
  var RX_MUSIC = /music|track|song|\u043c\u0443\u0437\u044b\u043a|\u0442\u0440\u0435\u043a/i;
  var RX_SFX = /sfx|whoosh|swoosh|hit|impact|riser|click/i;
  var RX_VOICE = /(^|[^a-z])vo([^a-z]|$)|voice|interview|dialog|\u0433\u043e\u043b\u043e\u0441|\u0438\u043d\u0442\u0435\u0440\u0432\u044c\u044e/i;

  // В какую папку (ключ из dest) положить элемент корня; null — не трогать.
  function classify(item, mainName) {
    if (item instanceof FolderItem) return lower(item.name) === "solids" ? "solids" : null;
    if (item instanceof CompItem) return lower(item.name) === lower(mainName) ? "main" : "precomps";
    if (!(item instanceof FootageItem)) return null;
    if (item.mainSource instanceof SolidSource) return "solids";
    var kind = EXT_KIND[extOf(item)], name = item.name;
    if (!kind) {
      if (item.hasAudio && !item.hasVideo) kind = "audio"; else return null;
    }
    if ((kind === "png" || kind === "vectors" || kind === "photo") && RX_LOGO.test(name)) return "logos";
    if (kind === "audio") {
      if (RX_VOICE.test(name)) return "voice";
      if (RX_MUSIC.test(name)) return "music";
      if (RX_SFX.test(name)) return "sfx";
      return item.duration > 30 ? "music" : "sfx";
    }
    return kind;
  }

  function organizeRoot(dest, mainName, created) {
    var root = app.project.rootFolder, list = [], i, moved = 0, by = {};
    for (i = 1; i <= root.numItems; i++) list.push(root.item(i)); // сначала список: перенос меняет нумерацию
    for (i = 0; i < list.length; i++) {
      var key = classify(list[i], mainName);
      if (!key || !dest[key]) continue;
      var target = ensurePath(dest[key], created);
      if (list[i] === target) continue;
      list[i].parentFolder = target;
      by[key] = (by[key] || 0) + 1;
      moved++;
    }
    return { moved: moved, by: by };
  }

  function findCompNamed(name) {
    for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && lower(it.name) === lower(name)) return it; }
    return null;
  }

  tools["ae.projectStart"] = function (args) {
    if (!app.project) return fail("NO_PROJECT");
    var created = { n: 0 }, comp = null, made = false, org = { moved: 0, by: {} }, i;
    undoable(args.undoName, function () {
      var folders = args.folders || [];
      for (i = 0; i < folders.length; i++) ensurePath(folders[i], created);
      if (args.comp) {
        comp = findCompNamed(args.comp.name);
        if (!comp) {
          comp = app.project.items.addComp(args.comp.name, args.comp.width, args.comp.height, 1, args.comp.duration, args.comp.fps);
          made = true;
        }
        comp.parentFolder = ensurePath(args.dest.main, created);
      }
      if (args.organize) org = organizeRoot(args.dest, args.comp ? args.comp.name : (args.mainName || ""), created);
    });
    if (made) { try { comp.openInViewer(); } catch (e) {} }
    return { ok: true, folders: created.n, comp: comp ? comp.name : null, compCreated: made,
      width: comp ? comp.width : 0, height: comp ? comp.height : 0, fps: comp ? comp.frameRate : 0, moved: org.moved, by: org.by };
  };

  tools["ae.organize"] = function (args) {
    if (!app.project) return fail("NO_PROJECT");
    var created = { n: 0 }, org = null;
    undoable(args.undoName, function () { org = organizeRoot(args.dest, args.mainName || "", created); });
    return { ok: true, moved: org.moved, by: org.by, folders: created.n };
  };

  // ---------- безопасные зоны ----------
  function rectInto(c, x1, y1, x2, y2) {
    var r = c.addProperty("ADBE Vector Shape - Rect");
    r.property("ADBE Vector Rect Size").setValue([x2 - x1, y2 - y1]);
    r.property("ADBE Vector Rect Position").setValue([(x1 + x2) / 2, (y1 + y2) / 2]);
  }
  function polyInto(c, pts, closed) {
    var p = c.addProperty("ADBE Vector Shape - Group"), s = new Shape();
    s.vertices = pts; s.closed = closed !== false;
    p.property("ADBE Vector Shape").setValue(s);
  }
  function group(layer, name) {
    var g = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    g.name = name;
    return g.property("ADBE Vectors Group");
  }
  function fillInto(c, rgb, opacity) {
    var f = c.addProperty("ADBE Vector Graphic - Fill");
    f.property("ADBE Vector Fill Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
    f.property("ADBE Vector Fill Opacity").setValue(opacity);
  }
  function strokeInto(c, rgb, width, opacity) {
    var s = c.addProperty("ADBE Vector Graphic - Stroke");
    s.property("ADBE Vector Stroke Color").setValue([rgb[0], rgb[1], rgb[2], 1]);
    s.property("ADBE Vector Stroke Width").setValue(width);
    s.property("ADBE Vector Stroke Opacity").setValue(opacity);
  }

  // Вертикальные зоны (база 1080x1920): опасные поля и «колонка кнопок» справа внизу.
  var VERTICAL = {
    reels:  { top: 250, bottom: 420, left: 70, right: 55, colFrom: 1110, col: 193 },
    tiktok: { top: 130, bottom: 400, left: 60, right: 60, colFrom: 1000, col: 180 },
    shorts: { top: 120, bottom: 380, left: 60, right: 60, colFrom: 1050, col: 180 }
  };

  function removeByName(comp, name) {
    for (var i = comp.numLayers; i >= 1; i--) { var l = comp.layer(i); if (l.name === name) { l.locked = false; l.remove(); } }
  }

  tools["ae.safeZone"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var W = comp.width, H = comp.height, k = args.kind, layer = null;
    undoable(args.undoName, function () {
      removeByName(comp, args.name);
      layer = comp.layers.addShape();
      layer.name = args.name;
      var tr = layer.property("ADBE Transform Group");
      tr.property("ADBE Anchor Point").setValue([0, 0]);
      tr.property("ADBE Position").setValue([0, 0]); // координаты фигур = координаты кадра
      var z = VERTICAL[k];
      if (z) {
        var sx = W / 1080, sy = H / 1920;
        var t = z.top * sy, b = H - z.bottom * sy, l = z.left * sx, r = W - z.right * sx, cy = z.colFrom * sy, cr = W - z.col * sx;
        var red = group(layer, "Danger");
        rectInto(red, 0, 0, W, t); rectInto(red, 0, b, W, H); rectInto(red, 0, t, l, b); rectInto(red, r, t, W, cy); rectInto(red, cr, cy, W, b);
        fillInto(red, [1, 0.15, 0.15], 40);
        var green = group(layer, "Safe");
        polyInto(green, [[l, t], [r, t], [r, cy], [cr, cy], [cr, b], [l, b]]);
        strokeInto(green, [0.2, 0.9, 0.4], Math.max(2, Math.round(4 * sx)), 100);
      } else if (k === "title16x9") {
        var a = group(layer, "Action safe 90%");
        rectInto(a, W * 0.05, H * 0.05, W * 0.95, H * 0.95); strokeInto(a, [0.2, 0.9, 0.4], 3, 100);
        var ti = group(layer, "Title safe 80%");
        rectInto(ti, W * 0.1, H * 0.1, W * 0.9, H * 0.9); strokeInto(ti, [1, 0.8, 0.2], 3, 100);
        var cr2 = group(layer, "Center");
        polyInto(cr2, [[W / 2 - 30, H / 2], [W / 2 + 30, H / 2]], false); polyInto(cr2, [[W / 2, H / 2 - 30], [W / 2, H / 2 + 30]], false);
        strokeInto(cr2, [1, 1, 1], 2, 70);
      } else if (k === "grid3") {
        var g = group(layer, "Grid 3x3");
        polyInto(g, [[W / 3, 0], [W / 3, H]], false); polyInto(g, [[W * 2 / 3, 0], [W * 2 / 3, H]], false);
        polyInto(g, [[0, H / 3], [W, H / 3]], false); polyInto(g, [[0, H * 2 / 3], [W, H * 2 / 3]], false);
        strokeInto(g, [1, 1, 1], 2, 60);
      } else { layer.remove(); layer = null; return; }
      layer.startTime = 0;
      layer.guideLayer = true; // виден в работе, в рендер не попадает
      layer.moveToBeginning();
      layer.locked = true;
    });
    if (!layer) return fail("BAD_ARGS", { field: "kind" });
    return { ok: true, layer: layer.name };
  };

  tools["ae.safeZoneToggle"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var n = 0;
    undoable(args.undoName, function () {
      for (var i = comp.numLayers; i >= 1; i--) {
        var l = comp.layer(i);
        if (l.name.indexOf("PA Safe") !== 0) continue; // строка
        var wasLocked = l.locked;
        l.locked = false;
        if (args.action === "delete") { l.remove(); n++; continue; }
        l.enabled = args.action !== "hide";
        l.locked = wasLocked;
        n++;
      }
    });
    if (!n) return fail("NO_SAFE_ZONES");
    return { ok: true, changed: n };
  };

  // ---------- порядок слоёв по времени ----------
  tools["ae.orderLayers"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var pool = args.scope === "selected" ? selectedLayers(comp) : [], i;
    if (args.scope !== "selected") for (i = 1; i <= comp.numLayers; i++) pool.push(comp.layer(i));
    var items = [];
    for (i = 0; i < pool.length; i++) {
      var L = pool[i];
      if (L.locked || L.name.indexOf("PA Safe") === 0) continue; // строка
      var audio = L.hasAudio && !L.hasVideo;
      items.push({ l: L, t: L.inPoint, idx: L.index, audio: audio });
    }
    if (items.length < 2) return fail("NEED_TWO_LAYERS");
    var down = args.direction !== "up";
    items.sort(function (a, b) {
      if (args.audio === "bottom" && a.audio !== b.audio) return a.audio ? 1 : -1;
      if (args.audio === "top" && a.audio !== b.audio) return a.audio ? -1 : 1;
      if (a.t !== b.t) return down ? a.t - b.t : b.t - a.t;
      return a.idx - b.idx;
    });
    var top = items[0].l;
    for (i = 1; i < items.length; i++) if (items[i].l.index < top.index) top = items[i].l;
    undoable(args.undoName, function () {
      // строим блок с места самого верхнего из этих слоёв
      if (items[0].l !== top) items[0].l.moveBefore(top);
      for (var k = 1; k < items.length; k++) items[k].l.moveAfter(items[k - 1].l);
    });
    return { ok: true, changed: items.length };
  };
