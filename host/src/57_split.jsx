
  /*
   * ae.splitText — разбить текст на буквы/слова/строки отдельными слоями (как TextExploder).
   * Каждый новый слой — копия исходного, где видна только своя часть (Expression Selector прячет остальные),
   * поэтому всё стоит ровно на своих местах. Исходный слой выключается (глазик).
   * args: { unit: "chars"|"words"|"lines", undoName }
   */
  function splitPieces(text, unit) {
    var r = [], i, s = String(text);
    if (unit === "lines") { var ls = s.split(/\r\n|\r|\n|\u0003/); for (i = 0; i < ls.length; i++) if (ls[i] !== "") r.push(ls[i]); return r; }
    if (unit === "words") { var ws = s.split(/\s+/); for (i = 0; i < ws.length; i++) if (ws[i] !== "") r.push(ws[i]); return r; }
    for (i = 0; i < s.length; i++) { var c = s.charAt(i); if (!/\s/.test(c)) r.push(c); }
    return r;
  }

  tools["ae.splitText"] = function (args) {
    var comp = activeComp();
    if (!comp) return fail("NO_COMP");
    var texts = textLayers(selectedLayers(comp));
    if (!texts.length) return fail("NO_TEXT_LAYER");
    var made = 0, tooMany = 0, unitType = args.unit === "words" ? "words" : args.unit === "lines" ? "lines" : "chars_no_spaces";
    undoable(args.undoName, function () {
      for (var i = 0; i < texts.length; i++) {
        var src = texts[i];
        if (src.locked) continue;
        var pieces = splitPieces(sourceTextProp(src).valueAtTime(comp.time, false).text, args.unit);
        if (pieces.length > 300) { tooMany++; continue; }
        // с конца, чтобы порядок слоёв в таймлайне совпал с порядком текста
        for (var k = pieces.length; k >= 1; k--) {
          var d = src.duplicate();
          d.name = pieces[k - 1];
          var anim = d.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
          anim.name = "Split";
          anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
          var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
          setBasedOn(sel, unitType);
          var amount = findByMatch(sel, /Amount/);
          amount.expression = "var a = textIndex == " + k + " ? 0 : 100; [a, a, a]";
          amount.expressionEnabled = true;
          d.moveBefore(src);
          made++;
        }
        src.enabled = false;
      }
    });
    if (!made) return fail(tooMany ? "TOO_MANY_PIECES" : "NOTHING_CHANGED", { skipped: { other: tooMany } });
    return { ok: true, changed: made, tooMany: tooMany };
  };
