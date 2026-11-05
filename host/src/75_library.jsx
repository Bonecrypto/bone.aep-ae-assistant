
  /*
   * Библиотека пользователя: файлы из его папки.
   *   ae.pickFolder  — системный диалог выбора папки
   *   ae.libImport   — шаблон .aep / пресет .ffx / видео, картинка, звук -> в проект и в активную композицию
   *   ae.reveal      — показать файл/папку в Проводнике
   * Импортированное складывается в папку проекта args.binName и переиспользуется (без дублей).
   */
  tools["ae.pickFolder"] = function (args) {
    var f = Folder.selectDialog(args.prompt || "");
    return { ok: true, path: f ? f.fsName : null };
  };

  tools["ae.reveal"] = function (args) {
    var dir = new Folder(args.path);
    if (!dir.exists) dir = new File(args.path).parent;
    if (!dir || !dir.exists) return fail("FILE_MISSING");
    dir.execute();
    return { ok: true };
  };

  function libraryBin(name) {
    var root = app.project.rootFolder;
    for (var i = 1; i <= root.numItems; i++) {
      var it = root.item(i);
      if (it instanceof FolderItem && it.name === name) return it;
    }
    return app.project.items.addFolder(name);
  }

  function collectComps(folder, out) {
    for (var i = 1; i <= folder.numItems; i++) {
      var it = folder.item(i);
      if (it instanceof CompItem) out.push(it);
      else if (it instanceof FolderItem) collectComps(it, out);
    }
    return out;
  }

  // Главная композиция шаблона: с именем файла, иначе та, что не вложена в другие.
  function mainComp(folder, base) {
    var comps = collectComps(folder, []), lower = String(base).toLowerCase(), i;
    for (i = 0; i < comps.length; i++) if (comps[i].name.toLowerCase() === lower) return comps[i];
    for (i = 0; i < comps.length; i++) if (comps[i].usedIn.length === 0) return comps[i];
    return comps.length ? comps[0] : null;
  }

  function findByComment(bin, comment) {
    for (var i = 1; i <= bin.numItems; i++) if (bin.item(i).comment === comment) return bin.item(i);
    return null;
  }

  function topSelected(comp) {
    var sel = comp.selectedLayers, top = null;
    for (var i = 0; i < sel.length; i++) if (!top || sel[i].index < top.index) top = sel[i];
    return top;
  }

  tools["ae.libImport"] = function (args) {
    if (!app.project) return fail("NO_PROJECT");
    var file = new File(args.path);
    if (!file.exists) return fail("FILE_MISSING");
    var comp = activeComp();
    var result = { ok: true, added: false, reused: false };

    if (args.kind === "preset") {
      if (!comp) return fail("NO_COMP");
      undoable(args.undoName, function () {
        var sel = comp.selectedLayers;
        if (!sel.length) {
          // нет выделения — кладём пресет на корректирующий слой от текущего времени (удобно для переходов)
          var adj = comp.layers.addSolid([1, 1, 1], args.name || "Preset", comp.width, comp.height, comp.pixelAspect, comp.duration);
          adj.adjustmentLayer = true;
          adj.startTime = 0;
          adj.inPoint = comp.time;
          adj.selected = true;
          result.createdAdjustment = true;
        }
        comp.layer(1).applyPreset(file);
        result.changed = Math.max(1, comp.selectedLayers.length);
      });
      return result;
    }

    undoable(args.undoName, function () {
      var bin = libraryBin(args.binName || "Library");
      var item = findByComment(bin, file.fsName);
      if (item) result.reused = true;
      if (!item) {
        var io = new ImportOptions(file);
        if (args.kind === "template") {
          if (!io.canImportAs(ImportAsType.PROJECT)) { result = fail("CANNOT_IMPORT"); return; }
          io.importAs = ImportAsType.PROJECT;
        }
        item = app.project.importFile(io);
        item.parentFolder = bin;
        item.comment = file.fsName;
      }
      var source = args.kind === "template" ? mainComp(item, args.base || "") : item;
      if (!source) { result = fail("NO_TEMPLATE_COMP"); return; }
      result.source = source.name;
      if (!comp || source === comp) return;

      var top = topSelected(comp);
      var layer = comp.layers.add(source);
      // маркер в шаблоне = момент, который ставится на текущее время (например, склейка у перехода)
      var offset = source instanceof CompItem && source.markerProperty.numKeys > 0 ? source.markerProperty.keyTime(1) : 0;
      layer.startTime = comp.time - offset;
      if (top) layer.moveBefore(top);
      result.added = true;
      result.layer = layer.name;
      result.alignedToMarker = offset > 0;
    });
    return result;
  };
