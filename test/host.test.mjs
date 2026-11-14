import { test } from "node:test";
import assert from "node:assert/strict";
import { makeContext, plain, PVT, KeyframeEase, MarkerValue } from "./ae-mock.mjs";
const h1 = { KE: KeyframeEase };

// Мини-движок выражений AE для проверки сгенерированного кода.
const op = (f) => (a, b) => (Array.isArray(a) ? a.map((x, i) => f(x, Array.isArray(b) ? b[i] : b)) : f(a, b));
function evalExpr(code, env) {
  const all = { add: op((a, b) => a + b), sub: op((a, b) => a - b), mul: op((a, b) => a * b), ...env };
  return new Function(...Object.keys(all), `return eval(${JSON.stringify(code)})`)(...Object.values(all));
}
const markersOf = (layer) => { const m = layer.property("ADBE Marker"); return { numKeys: m.keys.length, key: (k) => ({ time: m.keys[k - 1].t, duration: m.keys[k - 1].v.duration, comment: m.keys[k - 1].v.comment }) }; };

const one = (opts) => {
  const h = makeContext([]);
  const l = h.comp.attach(new h.Layer(opts));
  return { ...h, l, tr: l.property("ADBE Transform Group") };
};

// ---------- общие ----------
test("нет композиции / нет выделения", () => {
  assert.equal(makeContext(null).run("ae.animate", { kind: "fade", mode: "in" }).code, "NO_COMP");
  assert.equal(makeContext([]).run("ae.animate", { kind: "fade", mode: "in" }).code, "NO_SELECTION");
});
test("неизвестный инструмент и исключение — понятный код", () => {
  const h = makeContext([]);
  assert.equal(h.run("ae.nope").code, "UNKNOWN_TOOL");
  assert.equal(h.run("system.ping").ok, true);
});

// ---------- анимации ----------
test("влёт слева: ключи, ease, одна undo-группа", () => {
  const { run, tr, undo } = one();
  const r = run("ae.animate", { kind: "slide", mode: "in", direction: "left", duration: 0.5, undoName: "Ассистент: влёт" });
  assert.equal(r.ok, true);
  const p = tr.property("ADBE Position");
  assert.deepEqual(plain(p.keys.map((k) => k.v)), [[-120, 540], [960, 540]]);
  assert.equal(p.keys[0].outE[0].influence, 15);
  assert.equal(p.keys[1].inE[0].influence, 85);
  assert.deepEqual(undo, ["begin:Ассистент: влёт", "end"]);
});
test("слайд в 4 стороны уводит слой ровно за край", () => {
  const x = (dir, axis) => { const { run, tr } = one(); run("ae.animate", { kind: "slide", mode: "in", direction: dir }); return tr.property("ADBE Position").keys[0].v[axis]; };
  assert.equal(x("right", 0), 1920 + 20 + 100);
  assert.equal(x("up", 1), -20 - 50);
  assert.equal(x("down", 1), 1080 + 20 + 50);
});
test("улёт: ease зеркальный", () => {
  const { run, tr } = one();
  run("ae.animate", { kind: "slide", mode: "out", direction: "left" });
  const k = tr.property("ADBE Position").keys;
  assert.equal(k[0].outE[0].influence, 85); assert.equal(k[1].inE[0].influence, 15);
});
test("scale: 3 объекта ease для ThreeD", () => {
  const { run, tr } = one();
  assert.equal(run("ae.animate", { kind: "scale", mode: "in" }).ok, true);
  assert.equal(tr.property("ADBE Scale").keys[0].outE.length, 3);
});
test("заблокированный слой пропускается, undo закрыта", () => {
  const { run, undo } = one({ locked: true });
  const r = run("ae.animate", { kind: "fade", mode: "in" });
  assert.equal(r.code, "NOTHING_CHANGED"); assert.equal(undo.at(-1), "end");
});
test("ошибка внутри действия не оставляет открытую undo-группу", () => {
  const { run, tr, undo } = one();
  tr.property("ADBE Opacity").setTemporalEaseAtKey = () => { throw new Error("boom"); };
  assert.equal(run("ae.animate", { kind: "fade", mode: "in" }).code, "EXCEPTION");
  assert.deepEqual(undo, ["begin:AE Assistant", "end"]);
});

// ---------- графики скорости ----------
function keyed(type, a, b) {
  const h = one();
  const p = type === "pos" ? h.tr.property("ADBE Position") : h.tr.property("ADBE Opacity");
  p.setValueAtTime(0, a); p.setValueAtTime(2, b);
  p.selectedKeysList = [1, 2];
  h.l.selectedProperties = [p];
  return { ...h, p };
}
test("ease: кривая → speed/influence для 1D", () => {
  const { run, p } = keyed("opacity", 0, 100); // avg = 50/с
  const r = run("ae.ease", { curve: [0.25, 0.5, 0.75, 1] });
  assert.equal(r.ok, true); assert.equal(r.changed, 1);
  assert.equal(p.keys[0].outE[0].influence, 25); assert.equal(p.keys[0].outE[0].speed, 100); // 0.5/0.25*50
  assert.equal(p.keys[1].inE[0].influence, 25); assert.equal(p.keys[1].inE[0].speed, 0);
  assert.equal(p.keys[0].outI, 6613);
});
test("ease: позиция — скорость по длине пути, не отрицательная", () => {
  const { run, p } = keyed("pos", [0, 0], [300, 400]); // 500 px за 2 с = 250/с
  run("ae.ease", { curve: [0.5, -0.2, 0.5, 1] });
  assert.equal(p.keys[0].outE.length, 1);
  assert.equal(p.keys[0].outE[0].speed, 0);
});
test("ease: обратное чтение возвращает ту же кривую", () => {
  const { run } = keyed("opacity", 0, 100);
  run("ae.ease", { curve: [0.3, 0.1, 0.2, 1] });
  const r = run("ae.readEase", {});
  assert.deepEqual(r.curve.map((v) => Math.round(v * 1000) / 1000), [0.3, 0.1, 0.2, 1]);
});
test("ease: без пары выделенных ключей — понятная ошибка", () => {
  const { run, p } = keyed("opacity", 0, 100);
  p.selectedKeysList = [1];
  assert.equal(run("ae.ease", { curve: [0.3, 0, 0.7, 1] }).code, "NO_KEY_PAIRS");
});

// ---------- выражения ----------
test("выражение: на свойство по умолчанию + ползунки без дублей", () => {
  const { run, l, tr } = one();
  const args = { code: "wiggle(1,2)", defaultPath: ["ADBE Transform Group", "ADBE Position"], controls: [{ type: "slider", name: "Частота", value: 2 }] };
  assert.equal(run("ae.expression", args).ok, true);
  run("ae.expression", args);
  assert.equal(tr.property("ADBE Position").expression, "wiggle(1,2)");
  assert.equal(l.property("ADBE Effect Parade").numProperties, 1);
  assert.equal(l.property("ADBE Effect Parade").property(1).property(1).value, 2);
});
test("смотреть на слой: нужен второй слой, контрол указывает на последний", () => {
  const h = makeContext([]);
  const a = h.comp.attach(new h.Layer({ name: "A" })), b = h.comp.attach(new h.Layer({ name: "B" }));
  const r = h.run("ae.expression", { code: "x", defaultPath: ["ADBE Transform Group", "ADBE Rotate Z"], forceDefault: true, lookAtLast: true, controls: [{ type: "layer", name: "Цель" }] });
  assert.equal(r.changed, 1);
  assert.equal(a.property("ADBE Effect Parade").property(1).property(1).value, b.index);
  assert.equal(b.property("ADBE Transform Group").property("ADBE Rotate Z").expression, "");
});
test("убрать выражения", () => {
  const { run, tr } = one();
  tr.property("ADBE Position").expression = "wiggle(1,1)";
  assert.equal(run("ae.clearExpression", {}).changed, 1);
  assert.equal(run("ae.clearExpression", {}).code, "NO_EXPRESSIONS");
});

// ---------- создать ----------
test("solid / корректирующий / камера / виньетка", () => {
  const h = makeContext([]);
  assert.equal(h.run("ae.create", { kind: "solid", name: "Фон", color: [1, 0, 0] }).ok, true);
  const adj = h.run("ae.create", { kind: "adjustment", name: "Корр" });
  assert.equal(h.comp.layer(1).adjustmentLayer, true); assert.equal(adj.layer, "Корр");
  assert.equal(h.run("ae.create", { kind: "camera", name: "Камера" }).ok, true);
  h.run("ae.create", { kind: "vignette", name: "Виньетка" });
  const mask = h.comp.layer(1).property("ADBE Mask Parade").property(1);
  assert.equal(mask.inverted, true); assert.equal(mask.property("ADBE Mask Shape").value.vertices.length, 4);
});
test("null-контроллер: в центре выделенных и становится родителем", () => {
  const h = makeContext([]);
  const a = h.comp.attach(new h.Layer({ pos: [100, 100] })), b = h.comp.attach(new h.Layer({ pos: [300, 500] }));
  const r = h.run("ae.create", { kind: "null", name: "Контроллер", parentSelected: true });
  assert.equal(r.parented, 2); assert.equal(a.parent.nullLayer, true);
  assert.deepEqual(plain(a.parent.property("ADBE Transform Group").property("ADBE Position").value), [200, 300]);
});
test("эффект: на выделенные или на новый корректирующий слой", () => {
  const h = makeContext([]);
  const r = h.run("ae.addEffect", { matchName: "ADBE Glo2", adjustmentName: "Свечение" });
  assert.equal(r.createdAdjustment, true);
  assert.equal(h.comp.layer(1).property("ADBE Effect Parade").property(1).matchName, "ADBE Glo2");
  assert.equal(h.run("ae.addEffect", { matchName: "ADBE Unknown" }).code, "EFFECT_UNAVAILABLE");
});

// ---------- текст ----------
test("стиль текста: копировать → вставить", () => {
  const h = makeContext([]);
  const src = h.comp.attach(h.makeText("Заголовок", { font: "Inter-Bold", fontSize: 120, applyFill: true, fillColor: [1, 0, 0], applyStroke: false, tracking: 50, autoLeading: true, text: "Привет" }));
  const style = h.run("ae.textCopyStyle", {}).style;
  assert.equal(style.font, "Inter-Bold"); assert.equal("strokeColor" in style, false); assert.equal("leading" in style, false);
  src.selected = false;
  const dst = h.comp.attach(h.makeText("Подпись", { font: "Arial", fontSize: 20, applyFill: true, fillColor: [0, 0, 0], text: "Мир" }));
  assert.equal(h.run("ae.textPasteStyle", { style }).changed, 1);
  const doc = dst.property("ADBE Text Properties").property("ADBE Text Document").value;
  assert.equal(doc.font, "Inter-Bold"); assert.equal(doc.fontSize, 120); assert.equal(doc.text, "Мир");
});
test("анимация по буквам: аниматор, селектор, ключи Start", () => {
  const h = makeContext([]);
  const t = h.comp.attach(h.makeText("T", { text: "abc" }));
  assert.equal(h.run("ae.textAnimate", { preset: "rise", mode: "in", duration: 1, animatorName: "Ассистент" }).ok, true);
  const anim = t.property("ADBE Text Properties").property("ADBE Text Animators").property(1);
  assert.equal(anim.name, "Ассистент");
  const start = anim.property("ADBE Text Selectors").property(1).property("ADBE Text Percent Start");
  assert.deepEqual(start.keys.map((k) => k.v), [0, 100]);
  assert.equal(anim.property("ADBE Text Animator Properties").numProperties, 2);
  assert.equal(makeContext([]).run("ae.textAnimate", {}).code, "NO_TEXT_LAYER");
});

// ---------- элементы ----------
test("элементы: стрелка из двух путей + обводка + Trim Paths с ключами", () => {
  const h = makeContext([]);
  assert.equal(h.run("ae.element", { kind: "arrow", color: [1, 1, 0], width: 6, name: "Стрелка" }).ok, true);
  const c = h.comp.layer(1).property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
  const kinds = c.children.map((g) => g.matchName);
  assert.deepEqual(kinds, ["ADBE Vector Shape - Group", "ADBE Vector Shape - Group", "ADBE Vector Graphic - Stroke", "ADBE Vector Filter - Trim"]);
  assert.deepEqual(c.property(4).property("ADBE Vector Trim End").keys.map((k) => k.v), [0, 100]);
  assert.deepEqual(plain(c.property(3).property("ADBE Vector Stroke Color").value), [1, 1, 0, 1]);
  for (const kind of ["underline", "circle", "frame", "cross", "burst"]) assert.equal(h.run("ae.element", { kind }).ok, true, kind);
});

// ---------- сервис ----------
test("по очереди: шаг в кадрах, сверху вниз", () => {
  const h = makeContext([]);
  const ls = [0, 1, 2].map(() => h.comp.attach(new h.Layer()));
  assert.equal(h.run("ae.sequence", { mode: "time", stepFrames: 5 }).changed, 3);
  assert.deepEqual(ls.map((l) => Math.round(l.startTime * 100) / 100), [0, 0.2, 0.4]);
});
test("по маркерам", () => {
  const h = makeContext([]);
  const ls = [0, 1].map(() => h.comp.attach(new h.Layer()));
  assert.equal(h.run("ae.sequence", { mode: "markers" }).code, "NO_MARKERS");
  h.comp.markerProperty.setValueAtTime(1.5, null); h.comp.markerProperty.setValueAtTime(3, null);
  h.run("ae.sequence", { mode: "markers" });
  assert.deepEqual(ls.map((l) => l.startTime), [1.5, 3]);
});
test("цвет по типу, прекомпоз, очистка, сводка", () => {
  const h = makeContext([]);
  const t = h.comp.attach(h.makeText("T", { text: "a" }));
  const n = h.comp.attach(new h.Layer()); n.nullLayer = true;
  assert.equal(h.run("ae.labelByType", {}).changed, 2);
  assert.equal(t.label, 1); assert.equal(n.label, 4);
  assert.equal(h.run("ae.precompose", { name: "Пре" }).ok, true);
  assert.deepEqual(h.comp.precomposed.idx, [1, 2]);
  assert.equal(h.run("ae.removeUnused", {}).changed, 2);
  const info = h.run("ae.compInfo", {});
  assert.equal(info.comp.layers.length, 2); assert.equal(info.comp.layers[0].kind, "text"); assert.equal(info.comp.layers[0].text, "a");
});

test("пружина: 3 ключа с перелётом; поворот; моушн-блюр", () => {
  const { run, tr, l, comp } = one();
  run("ae.animate", { kind: "scale", mode: "in", spring: true, duration: 1 });
  const k = tr.property("ADBE Scale").keys;
  assert.equal(k.length, 3);
  assert.deepEqual(plain(k.map((x) => Math.round(x.v[0]))), [0, 112, 100]);
  run("ae.animate", { kind: "rotate", mode: "in" });
  assert.deepEqual(tr.property("ADBE Rotate Z").keys.map((x) => x.v), [-90, 0]);
  assert.equal(run("ae.motionBlur", { on: true }).changed, 1);
  assert.equal(l.motionBlur, true); assert.equal(comp.motionBlur, true);
});
test("выражение-цикл без выделенного свойства — подсказка выделить", () => {
  const { run } = one();
  assert.equal(run("ae.expression", { code: 'loopOut("cycle")' }).code, "NO_TARGET_PROPS");
});

test("отскок: вход в ключи становится линейным (кроме первого), выход не трогаем", () => {
  const { run, tr, l } = one();
  const p = tr.property("ADBE Position");
  p.setValueAtTime(0, [0, 0]); p.setValueAtTime(1, [100, 0]); p.setValueAtTime(2, [100, 0]);
  p.keys.forEach((k) => { k.inI = 6613; k.outI = 6613; });
  l.selectedProperties = [p];
  run("ae.expression", { code: "x", linearIn: true });
  assert.deepEqual(p.keys.map((k) => [k.inI, k.outI]), [[6613, 6613], [6612, 6613], [6612, 6613]]);
});

// ---------- 0.5: переходы, текст, тряска, стили ----------
test("ae.motion: несколько свойств, сдвиг между слоями, размытие эффектом", () => {
  const h = makeContext([]);
  const a = h.comp.attach(new h.Layer()), b = h.comp.attach(new h.Layer());
  const r = h.run("ae.motion", { mode: "in", duration: 0.5, stagger: 0.1, fade: true, move: { dir: "down", distance: 80 }, scaleFrom: 60, blurFrom: 20, blurName: "Размытие" });
  assert.equal(r.changed, 2);
  const ta = a.property("ADBE Transform Group"), tb = b.property("ADBE Transform Group");
  assert.deepEqual(plain(ta.property("ADBE Position").keys.map((k) => k.v)), [[960, 620], [960, 540]]);
  assert.deepEqual(plain(ta.property("ADBE Scale").keys[0].v), [60, 60, 60]);
  assert.equal(tb.property("ADBE Opacity").keys[0].t, 1.1);
  const blur = a.property("ADBE Effect Parade").property(1);
  assert.equal(blur.name, "Размытие"); assert.deepEqual(blur.property(1).keys.map((k) => k.v), [20, 0]);
  h.run("ae.motion", { mode: "in", blurFrom: 10, blurName: "Размытие" });
  assert.equal(a.property("ADBE Effect Parade").numProperties, 1, "эффект размытия не дублируется");
});

test("ae.textFx: аниматор, expression selector по словам, ползунки с номером", () => {
  const h = makeContext([]);
  const t = h.comp.attach(h.makeText("T", { text: "раз два" })); t.inPoint = 0.4;
  const r = h.run("ae.textFx", { unit: "words", props: { opacity: 0, position: [0, 40], scale: 60, blur: 10 }, code: 'effect("Текст@@ · старт")(1)',
    controls: [{ name: "Текст@@ · старт", value: 0 }, { name: "Текст@@ · шаг", value: 0.05 }], startSlider: "Текст@@ · старт", animatorName: "Подъём" });
  assert.equal(r.ok, true); assert.equal(r.unitSet, true);
  const anim = t.property("ADBE Text Properties").property("ADBE Text Animators").property(1);
  assert.equal(anim.name, "Подъём #1");
  const sel = anim.property("ADBE Text Selectors").property(1);
  assert.equal(sel.property("ADBE Text Range Type2").value, 3);
  assert.equal(sel.property("ADBE Text Expressible Amount").expression, 'effect("Текст1 · старт")(1)');
  const fx = t.property("ADBE Effect Parade");
  assert.equal(fx.property(1).name, "Текст1 · старт");
  assert.ok(Math.abs(fx.property(1).property(1).value - 0.6) < 1e-9, "старт = CTI - inPoint");
  assert.equal(anim.property("ADBE Text Animator Properties").numProperties, 4);
});

test("ae.expressions: тряска на несколько свойств одним действием", () => {
  const { run, tr, undo } = one();
  const r = run("ae.expressions", { items: [{ path: ["ADBE Transform Group", "ADBE Position"], code: "p@@" }, { path: ["ADBE Transform Group", "ADBE Rotate Z"], code: "r@@" }],
    controls: [{ name: "Тряска@@ · сила", value: 40 }] });
  assert.equal(r.changed, 1);
  assert.equal(tr.property("ADBE Position").expression, "p1"); assert.equal(tr.property("ADBE Rotate Z").expression, "r1");
  assert.equal(undo.filter((x) => x.startsWith("begin")).length, 1);
});

test("ae.style: эффект с параметрами и анимированным параметром", () => {
  const { run, l } = one();
  const r = run("ae.style", { matchName: "ADBE Drop Shadow", name: "Мягкая тень", params: [{ index: 2, value: 76 }, { index: 4, value: 12 }, { index: 5, value: 35 }], keys: [{ index: 3, from: 0, to: 90, duration: 1 }] });
  assert.equal(r.ok, true); assert.equal(r.failedParams, 0);
  const e = l.property("ADBE Effect Parade").property(1);
  assert.equal(e.name, "Мягкая тень"); assert.equal(e.property(4).value, 12); assert.deepEqual(e.property(3).keys.map((k) => k.v), [0, 90]);
});

test("ae.selectionInfo", () => {
  const h = makeContext([]);
  h.comp.attach(h.makeText("T", { text: "a" })); h.comp.attach(new h.Layer());
  const r = h.run("ae.selectionInfo", {});
  assert.equal(r.comp, "Comp 1"); assert.equal(r.selected, 2); assert.equal(r.text, 1);
});

test("тряска на позиции с раздельными измерениями — понятная ошибка", () => {
  const { run, tr } = one();
  tr.property("ADBE Position").dimensionsSeparated = true;
  assert.equal(run("ae.expressions", { items: [{ path: ["ADBE Transform Group", "ADBE Position"], code: "x" }], controls: [] }).code, "SEPARATED_DIMENSIONS");
});

// ---------- библиотека и переходы между сценами ----------
test("библиотека: шаблон .aep — импорт, главная композиция, маркер на текущее время, без повторного импорта", () => {
  const h = makeContext([]);
  h.files.add("C:/Lib/Переходы/Зум.aep");
  const r = h.run("ae.libImport", { path: "C:/Lib/Переходы/Зум.aep", kind: "template", base: "Зум", binName: "Библиотека" });
  assert.equal(r.ok, true); assert.equal(r.source, "Зум"); assert.equal(r.alignedToMarker, true);
  const layer = h.comp.layer(1);
  assert.ok(Math.abs(layer.startTime - 0.5) < 1e-9, "маркер 0,5 с встал на время 1 с");
  h.run("ae.libImport", { path: "C:/Lib/Переходы/Зум.aep", kind: "template", base: "Зум", binName: "Библиотека" });
  assert.equal(h.ctx.imports, 1, "второй раз берём из проекта");
  assert.equal(h.root.list.filter((x) => x.name === "Библиотека").length, 1);
});
test("библиотека: звук/видео в текущее время; нет файла — понятная ошибка", () => {
  const h = makeContext([]);
  h.files.add("C:/Lib/Звуки/whoosh.wav");
  const r = h.run("ae.libImport", { path: "C:/Lib/Звуки/whoosh.wav", kind: "footage", binName: "Библиотека" });
  assert.equal(r.added, true); assert.equal(h.comp.layer(1).startTime, 1);
  assert.equal(h.run("ae.libImport", { path: "C:/нет.wav", kind: "footage" }).code, "FILE_MISSING");
  assert.equal(h.run("ae.pickFolder", {}).path, "C:/Библиотека");
});
test("переход на склейке: слой по центру склейки, ключи с рывком на склейке", () => {
  const h = makeContext([]);
  const r = h.run("ae.sceneTransition", { kind: "zoomIn", duration: 0.6, amount: 100, name: "Зум" });
  assert.equal(r.ok, true); assert.equal(r.failedParams, 0);
  const l = h.comp.layer(1);
  assert.equal(l.adjustmentLayer, true); assert.ok(Math.abs(l.inPoint - 0.7) < 1e-9 && Math.abs(l.outPoint - 1.3) < 1e-9);
  const tf = l.property("ADBE Effect Parade").property(2);
  assert.equal(tf.property(4).keys.length, 0, "без ключей — от краёв слоя");
  const sc = (time) => evalExpr(tf.property(4).expression, { time, inPoint: l.inPoint, outPoint: l.outPoint, value: 100 });
  assert.equal(Math.round(sc(0.7)), 100); assert.ok(sc(0.99) > 250, "к склейке разгоняется до 300"); assert.ok(sc(1.0) < 40, "после склейки с 33"); assert.equal(Math.round(sc(1.3)), 100);
  for (const kind of ["dip", "flash", "blur", "zoomOut", "spin", "whip"]) assert.equal(h.run("ae.sceneTransition", { kind, side: "left" }).ok, true, kind);
});


test("маркер: переход слоя без ключей, длительность = маркер; появление + исчезание складываются в цепочку", () => {
  const { run, l, tr } = one();
  const hidden = "(1 - (1 - Math.pow(1 - p, 3)))";
  run("ae.motion", { mode: "in", duration: 0.5, fade: true, scaleFrom: 0, control: "marker", markerName: "Появление · Выпрыгивание @@", hidden });
  l.property("ADBE Marker"); // маркер стоит в текущем времени (1 с)
  const ms = l.property("ADBE Marker").keys;
  assert.equal(ms.length, 1); assert.equal(ms[0].t, 1); assert.equal(ms[0].v.duration, 0.5); assert.equal(ms[0].v.comment, "Появление · Выпрыгивание 1");
  assert.equal(tr.property("ADBE Scale").keys.length, 0);
  const comp = l.comp; comp.time = 3;
  run("ae.motion", { mode: "out", duration: 1, fade: true, control: "marker", markerName: "Исчезание · Затухание @@", hidden: "(function (p) { return 1 - (1 - Math.pow(1 - p, 3)); })(1 - p)" });
  const op = tr.property("ADBE Opacity").expression;
  assert.match(op, /A_2\(A_1\(value\)\)$/);
  const opac = (time) => evalExpr(op, { time, value: 100, thisLayer: { marker: markersOf(l) } });
  assert.equal(opac(0.5), 0, "до появления спрятан, как с ключами"); assert.equal(opac(1), 0, "в начале появления спрятан");
  assert.equal(opac(2), 100, "между анимациями виден"); assert.ok(opac(3.5) < 100 && opac(3.5) > 0); assert.equal(Math.round(opac(4.2)), 0, "после исчезания спрятан");
  // тянем конец маркера — меняется длительность
  ms[0].v.duration = 2;
  assert.ok(opac(2) < 100, "маркер растянули — появление ещё идёт");
  // удалили маркер — анимации нет
  l.property("ADBE Marker").keys.splice(0, 1);
  assert.equal(opac(1), 100);
});

test("TR In / TR Out: точка в конце появления и в начале исчезания, один маркер на все анимации слоя", () => {
  const { run, l, tr } = one();
  l.inPoint = 2; l.outPoint = 8;
  const hidden = "(1 - p)";
  run("ae.motion", { mode: "in", duration: 0.5, fade: true, control: "marker", markerStyle: "tr", markerName: "П @@", hidden });
  run("ae.motion", { mode: "in", duration: 0.5, scaleFrom: 0, control: "marker", markerStyle: "tr", markerName: "П @@", hidden });
  run("ae.motion", { mode: "out", duration: 1, fade: true, control: "marker", markerStyle: "tr", markerName: "И @@", hidden: "p" });
  const ms = l.property("ADBE Marker").keys;
  assert.deepEqual(ms.map((k) => [k.t, k.v.comment]), [[2.5, "TR In"], [7, "TR Out"]], "TR In не дублируется");
  assert.equal(tr.property("ADBE Opacity").keys.length, 0);
  const opac = (time) => evalExpr(tr.property("ADBE Opacity").expression, { time, value: 100, inPoint: l.inPoint, outPoint: l.outPoint, thisLayer: { marker: markersOf(l) } });
  assert.equal(opac(2), 0, "в начале слоя спрятан"); assert.ok(opac(2.25) > 0 && opac(2.25) < 100); assert.equal(opac(2.5), 100);
  assert.equal(opac(5), 100); assert.ok(opac(7.5) > 0 && opac(7.5) < 100); assert.equal(opac(8), 0, "к концу слоя спрятан");
  ms[0].t = 3; // двигаем TR In — появление длиннее
  assert.ok(opac(2.5) < 100 && opac(3) === 100);
  const sc = (time) => evalExpr(tr.property("ADBE Scale").expression, { time, value: [100, 100, 100], inPoint: l.inPoint, outPoint: l.outPoint, thisLayer: { marker: markersOf(l) } });
  assert.ok(sc(2.5)[0] < 100, "масштаб тоже слушает тот же TR In");
});

test("TR In для текста: точка на inPoint + длительность", () => {
  const h = makeContext([]);
  const t = h.comp.attach(h.makeText("T", { text: "ab" }));
  t.inPoint = 1;
  h.run("ae.textFx", { unit: "chars", props: { opacity: 0 }, code: 'MK("TR In")', controls: [], marker: { name: "П @@", duration: 1.5, style: "tr" }, animatorName: "X" });
  h.run("ae.textFx", { unit: "chars", props: { opacity: 0 }, code: 'MK("TR Out")', controls: [], marker: { name: "И @@", duration: 0.5, style: "tr" }, mode: "out", animatorName: "Y" });
  assert.deepEqual(t.property("ADBE Marker").keys.map((k) => [k.t, k.v.comment]), [[2.5, "TR In"], [t.outPoint - 0.5, "TR Out"]]);
});

test("маркер: текст и тряска ставят маркер с длительностью", () => {
  const h = makeContext([]);
  const t = h.comp.attach(h.makeText("T", { text: "ab" }));
  h.run("ae.textFx", { unit: "chars", props: { opacity: 0 }, code: 'MK("Появление · X @@")', controls: [{ name: "Текст@@ · плавность", value: 40 }], marker: { name: "Появление · X @@", duration: 1.5 }, animatorName: "X" });
  const m = t.property("ADBE Marker").keys[0];
  assert.equal(m.v.comment, "Появление · X 1"); assert.equal(m.v.duration, 1.5);
  const sel = t.property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").property(1);
  assert.equal(sel.property("ADBE Text Expressible Amount").expression, 'MK("Появление · X 1")');
  const r = h.run("ae.expressions", { chain: true, marker: { name: "Удар @@", duration: 0.8 }, items: [{ path: ["ADBE Transform Group", "ADBE Position"], code: "return value;" }], controls: [] });
  assert.equal(r.ok, true);
});

test("стекло: плашка + корректирующий слой под ней с маской, привязан к плашке", () => {
  const h = makeContext([]);
  const r = h.run("ae.glass", { width: 600, height: 300, radius: 60, frost: 30, tint: 12, stroke: 1.5, shadow: 30, name: "Стекло", blurName: "Стекло · размытие" });
  assert.equal(r.ok, true); assert.equal(r.failedParams, 0);
  const plate = h.comp.layer(1), adj = h.comp.layer(2);
  assert.equal(plate.name, "Стекло"); assert.equal(adj.adjustmentLayer, true); assert.equal(adj.parent, plate);
  assert.equal(adj.name, "Стекло · размытие");
  const verts = adj.property("ADBE Mask Parade").property(1).property("ADBE Mask Shape").value.vertices;
  assert.equal(verts.length, 8); assert.deepEqual(plain(verts[0]), [960 - 300 + 60, 540 - 150]);
  const c = plate.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
  assert.deepEqual(c.children.map((x) => x.matchName), ["ADBE Vector Shape - Rect", "ADBE Vector Graphic - Fill", "ADBE Vector Graphic - Stroke"]);
});


// ---------- 0.9: края слоя, чужие выражения, раскладка, ключи, разбивка текста ----------
test("маркер по краям слоя: появление от начала слоя, исчезание к концу", () => {
  const { run, l } = one();
  l.inPoint = 2; l.outPoint = 8;
  run("ae.motion", { mode: "in", duration: 0.5, fade: true, control: "marker", markerName: "П @@", hidden: "(1 - p)", at: "layer" });
  run("ae.motion", { mode: "out", duration: 1, fade: true, control: "marker", markerName: "И @@", hidden: "p", at: "layer" });
  assert.deepEqual(l.property("ADBE Marker").keys.map((k) => k.t), [2, 7]);
});

test("своё выражение пользователя не затирается — понятная ошибка", () => {
  const { run, tr } = one();
  tr.property("ADBE Opacity").expression = "wiggle(1, 10)"; tr.property("ADBE Opacity").expressionEnabled = true;
  const r = run("ae.motion", { mode: "in", fade: true, control: "marker", markerName: "П @@", hidden: "(1 - p)" });
  assert.equal(r.code, "FOREIGN_EXPRESSION");
  assert.equal(tr.property("ADBE Opacity").expression, "wiggle(1, 10)");
  const r2 = run("ae.motion", { mode: "in", fade: true, scaleFrom: 0, control: "marker", markerName: "П @@", hidden: "(1 - p)" });
  assert.equal(r2.ok, true); assert.equal(r2.foreign, 1);
});

test("точка привязки по сетке: слой не сдвигается", () => {
  const { run, tr } = one(); // прямоугольник 200x100 с центром в якоре 0,0; позиция 960,540
  tr.property("ADBE Scale").value = [200, 200, 100];
  run("ae.anchor", { x: 0, y: 0 });
  assert.deepEqual(plain(tr.property("ADBE Anchor Point").value), [-100, -50]);
  assert.deepEqual(plain(tr.property("ADBE Position").value), [960 - 200, 540 - 100], "сдвиг позиции с учётом масштаба");
  tr.property("ADBE Anchor Point").setValueAtTime(0, [0, 0]);
  assert.equal(run("ae.anchor", { x: 1, y: 1 }).code, "ANCHOR_KEYED");
});

test("выравнивание по кадру и распределение; ключи позиции едут вместе", () => {
  const h = makeContext([]);
  const a = h.comp.attach(new h.Layer({ pos: [300, 300] })), b = h.comp.attach(new h.Layer({ pos: [500, 700] })), c = h.comp.attach(new h.Layer({ pos: [1500, 400] }));
  b.property("ADBE Transform Group").property("ADBE Position").setValueAtTime(0, [500, 700]);
  b.property("ADBE Transform Group").property("ADBE Position").setValueAtTime(1, [600, 700]);
  h.run("ae.align", { mode: "left", to: "comp" });
  assert.equal(a.property("ADBE Transform Group").property("ADBE Position").value[0], 100, "левый край слоя на 0");
  assert.deepEqual(plain(b.property("ADBE Transform Group").property("ADBE Position").keys.map((k) => k.v[0])), [0, 100], "в 1 с ключ на 600, левый край 500 -> 0");
  const d = makeContext([]);
  const ls = [[100, 0], [250, 0], [900, 0]].map((p) => d.comp.attach(new d.Layer({ pos: p })));
  d.run("ae.distribute", { axis: "x" });
  assert.equal(ls[1].property("ADBE Transform Group").property("ADBE Position").value[0], 500);
  assert.equal(makeContext([]).run("ae.distribute", { axis: "x" }).code, "NEED_THREE_LAYERS");
});

test("развернуть ключи: значения и ease меняются местами во времени", () => {
  const { run, tr, l } = one();
  const p = tr.property("ADBE Opacity");
  p.setValueAtTime(1, 0); p.setValueAtTime(3, 100);
  p.setTemporalEaseAtKey(1, [new h1.KE(0, 10)], [new h1.KE(0, 90)]);
  l.selectedProperties = [p];
  run("ae.reverseKeys", {});
  assert.deepEqual(p.keys.map((k) => [k.t, k.v]), [[1, 100], [3, 0]]);
  assert.equal(p.keys[1].inE[0].influence, 90); assert.equal(p.keys[1].outE[0].influence, 10);
});

test("разбить текст по словам: слой на слово, остальные части спрятаны, исходный выключен", () => {
  const h = makeContext([]);
  const t = h.comp.attach(h.makeText("Фраза", { text: "раз два  три" }));
  const r = h.run("ae.splitText", { unit: "words" });
  assert.equal(r.changed, 3);
  assert.deepEqual(h.comp.list.slice(0, 3).map((l) => l.name), ["раз", "два", "три"]);
  const sel = h.comp.layer(2).property("ADBE Text Properties").property("ADBE Text Animators").property(1).property("ADBE Text Selectors").property(1);
  assert.equal(sel.property("ADBE Text Range Type2").value, 3);
  assert.match(sel.property("ADBE Text Expressible Amount").expression, /textIndex == 2/);
  assert.equal(t.enabled, false);
});


// ---------- 0.10: инструменты в духе Motion Tools ----------
test("быстрый ease: на одиночный ключ, только вход", () => {
  const { run, tr, l } = one();
  const p = tr.property("ADBE Opacity");
  p.setValueAtTime(0, 0); p.setValueAtTime(1, 100); p.selectedKeysList = [2]; l.selectedProperties = [p];
  assert.equal(run("ae.quickEase", { inInfluence: 80, outInfluence: 20, which: "in" }).changed, 1);
  assert.equal(p.keys[1].inE[0].influence, 80); assert.equal(p.keys[1].outE[0].influence, 16.666);
  p.selectedKeysList = [];
  assert.equal(run("ae.quickEase", { inInfluence: 50, outInfluence: 50 }).code, "NO_KEYS_SELECTED");
});

test("клонировать ключи: копия на указателе с теми же интервалами", () => {
  const { run, tr, l, comp } = one();
  const p = tr.property("ADBE Opacity");
  p.setValueAtTime(0.2, 0); p.setValueAtTime(0.7, 100); p.selectedKeysList = [1, 2]; l.selectedProperties = [p];
  comp.time = 3;
  run("ae.cloneKeys", {});
  assert.deepEqual(p.keys.map((k) => [Math.round(k.t * 10) / 10, k.v]), [[0.2, 0], [0.7, 100], [3, 0], [3.5, 100]]);
});

test("достать из прекомпа: слои в композиции, со сдвигом времени, под null, прекомп выключен", () => {
  const h = makeContext([]);
  const inner = new h.ctx.CompItem([]); inner.name = "Пре";
  inner.attach(new h.Layer({ name: "Лого" })); inner.attach(new h.Layer({ name: "Фон" }));
  const pre = h.comp.attach(new h.Layer({ name: "Пре" })); pre.source = inner; pre.startTime = 2;
  const r = h.run("ae.extract", {});
  assert.equal(r.changed, 2); assert.equal(pre.enabled, false);
  const names = h.comp.list.map((l) => l.name);
  assert.deepEqual(names.slice(0, 2), ["Лого", "Фон"], "порядок как в прекомпе");
  assert.match(names[2], /Пре$/, "null с именем прекомпа");
  assert.equal(names[3], "Пре", "прекомп остался (выключен)");
  assert.equal(h.comp.layer(1).startTime, 2); assert.equal(h.comp.layer(1).parent.nullLayer, true);
  assert.equal(makeContext([]).run("ae.extract", {}).code, "NO_PRECOMP");
});

test("в шейпы: команда меню AE, для текста — своя", () => {
  const h = makeContext([]);
  h.comp.attach(h.makeText("T", { text: "a" }));
  assert.equal(h.run("ae.toShapes", {}).ok, true); assert.equal(h.ctx.lastCommand, 3781);
});

test("по очереди группами и с отступом", () => {
  const h = makeContext([]);
  const ls = [0, 1, 2, 3].map(() => h.comp.attach(new h.Layer()));
  h.run("ae.sequence", { mode: "time", stepFrames: 5, groupSize: 2, offsetFrames: 10 });
  assert.deepEqual(ls.map((l) => Math.round(l.startTime * 100) / 100), [0.4, 0.4, 0.6, 0.6]);
});


// ---------- 0.11: превью пресетов, карусель, слияние шейпов, счётчики ----------
test("превью .ffx: временная композиция, пресет на образец, 10 кадров + обложка, уборка по id", () => {
  const h = makeContext([]);
  h.files.add("C:/Lib/01_Text/gold.ffx");
  const r = h.run("ae.makePreview", { preset: "C:/Lib/01_Text/gold.ffx", outDir: "C:/Lib/01_Text/_previews", base: "gold", sample: "text" });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.frames, 11);
  assert.equal(h.ctx.savedFrames.length, 11); assert.match(h.ctx.savedFrames[0].file, /gold__01\.png$/); assert.match(h.ctx.savedFrames[10].file, /gold\.png$/);
  assert.equal(r.cleanup.length, 2);
  assert.equal(h.run("ae.removeItems", { ids: r.cleanup }).removed, 2);
});

test("карусель: каждый слой по очереди в центре кадра", () => {
  const h = makeContext([]);
  const ls = [0, 1, 2].map(() => h.comp.attach(new h.Layer()));
  const r = h.run("ae.carousel", { mode: "cover", hold: 1, move: 0.5, spacing: 600 });
  assert.equal(r.ok, true); assert.equal(r.length, 4);
  const xAt = (l, t) => { const k = l.property("ADBE Transform Group").property("ADBE Position").keys.find((q) => Math.abs(q.t - t) < 1e-9); return k.v[0]; };
  assert.equal(xAt(ls[0], 1), 960); assert.equal(xAt(ls[1], 1), 1560);
  assert.equal(xAt(ls[1], 2.5), 960); assert.equal(xAt(ls[2], 4), 960);
  const op = ls[2].property("ADBE Transform Group").property("ADBE Opacity").keys[0].v;
  assert.equal(op, 0, "далёкий слой в обложках прозрачный");
});

test("слить шейпы: содержимое нижних — группами в верхний, нижние выключены", () => {
  const h = makeContext([]);
  h.run("ae.element", { kind: "circle" }); h.run("ae.element", { kind: "frame" });
  const [top, bottom] = [h.comp.layer(1), h.comp.layer(2)];
  [top, bottom].forEach((l) => { l.selected = true; });
  bottom.property("ADBE Transform Group").property("ADBE Position").value = [1000, 600];
  const r = h.run("ae.mergeShapes", {});
  assert.equal(r.ok, true, JSON.stringify(r));
  const groups = top.property("ADBE Root Vectors Group").children;
  assert.equal(groups.length, 2); assert.equal(groups[1].name, bottom.name);
  const inner = groups[1].property("ADBE Vectors Group").children.map((c) => c.matchName);
  assert.deepEqual(inner, ["ADBE Vector Group"]);
  assert.deepEqual(plain(groups[1].property("ADBE Vector Transform Group").property("ADBE Vector Position").value), [40, 60]);
  assert.equal(bottom.enabled, false);
});

test("счётчик: текстовый слой, выражение на Source Text, ползунки и маркер", () => {
  const h = makeContext([]);
  const r = h.run("ae.textCounter", { name: "Деньги", code: 'effect("Счётчик@@ · от")(1)', controls: [{ name: "Счётчик@@ · от", value: 5 }], marker: { name: "Деньги @@", duration: 2 } });
  assert.equal(r.ok, true);
  const l = h.comp.layer(1);
  assert.equal(l.name, "Деньги");
  assert.equal(l.property("ADBE Text Properties").property("ADBE Text Document").expression, 'effect("Счётчик1 · от")(1)');
  assert.equal(l.property("ADBE Marker").keys[0].v.duration, 2);
});


// ---------- 0.12: биты, субтитры, морфинг ----------
test("звук: находит слой со звуком и путь к файлу; маркеры битов с заменой старых", () => {
  const h = makeContext([]);
  const a = h.comp.attach(new h.Layer({ name: "music.mp3" })); a.hasAudio = true; a.hasVideo = false; a.source = { file: { fsName: "C:/music.mp3" } }; a.stretch = 100; a.startTime = 2;
  const info = h.run("ae.audioInfo", {});
  assert.equal(info.path, "C:/music.mp3"); assert.equal(info.startTime, 2);
  const mp = h.comp.markerProperty;
  mp.setValueAtTime(0.1, new h.ctx.MarkerValue("Мой маркер"));
  h.run("ae.addMarkers", { times: [2.5, 3, 3.5], comment: "Бит", target: "comp", replace: true });
  h.run("ae.addMarkers", { times: [4, 4.5], comment: "Бит", target: "comp", replace: true });
  assert.deepEqual(mp.keys.map((k) => [k.t, k.v.comment]), [[0.1, "Мой маркер"], [4, "Бит 1"], [4.5, "Бит 2"]], "свои маркеры не трогаем, прошлые биты заменены");
});

test("субтитры: слой на фразу со своим временем, внизу кадра, стиль из «Копировать стиль»", () => {
  const h = makeContext([]);
  const r = h.run("ae.subtitles", { segments: [{ start: 1, end: 2.5, text: "Привет" }, { start: 2.5, end: 4, text: "мир" }], position: "bottom", style: { font: "Inter-Bold", fontSize: 70 } });
  assert.equal(r.changed, 2);
  const [first, second] = [h.comp.layer(1), h.comp.layer(2)];
  assert.equal(first.name, "Привет"); assert.equal(first.inPoint, 1); assert.equal(first.outPoint, 2.5);
  assert.equal(second.inPoint, 2.5);
  const doc = first.property("ADBE Text Properties").property("ADBE Text Document").value;
  assert.equal(doc.font, "Inter-Bold"); assert.equal(doc.fontSize, 70);
  assert.equal(first.property("ADBE Transform Group").property("ADBE Position").value[1], 1080 * 0.82);
});

test("морфинг: прямоугольник перетекает в эллипс — путь с двумя ключами, вторая фигура выключена", () => {
  const h = makeContext([]);
  h.run("ae.element", { kind: "frame" }); h.run("ae.element", { kind: "circle" });
  const [circle, frame] = [h.comp.layer(1), h.comp.layer(2)];
  // порядок выделения в AE = порядок в selectedLayers: «из» — рамка, «в» — круг
  h.comp.list = [frame, circle, ...h.comp.list.slice(2)];
  const r = h.run("ae.morph", { duration: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const c = frame.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
  const path = c.children.find((x) => x.matchName === "ADBE Vector Shape - Group").property("ADBE Vector Shape");
  assert.equal(path.keys.length, 2); assert.equal(path.keys[0].v.vertices.length, 8); assert.equal(path.keys[1].v.vertices.length, 4);
  assert.equal(c.children.find((x) => x.matchName === "ADBE Vector Shape - Rect").enabled, false);
  assert.equal(circle.enabled, false);
});


// ---------- распаковка прекомпов ----------
function precompScene() {
  const h = makeContext([]);
  const inner = new h.ctx.CompItem([]); inner.name = "Текст из Premiere";
  const t1 = inner.attach(new h.Layer({ name: "Заголовок" })); t1.selected = false; Object.assign(t1, { startTime: 0, inPoint: 0, outPoint: 3 });
  const t2 = inner.attach(new h.Layer({ name: "Подпись" })); t2.selected = false; Object.assign(t2, { startTime: 0, inPoint: 3.5, outPoint: 10 });
  const pre = h.comp.attach(new h.Layer({ name: "Текст из Premiere" }));
  Object.assign(pre, { source: inner, startTime: 2, inPoint: 2.5, outPoint: 6 });
  const tr = pre.property("ADBE Transform Group");
  tr.property("ADBE Anchor Point").value = [960, 540]; // как из Premiere: прекомп во весь кадр, по центру
  return { h, inner, pre, tr, t1, t2 };
}

test("распаковка как из Premiere: без лишнего null, время с учётом обрезки, прекомп и композиция удалены", () => {
  const { h, inner } = precompScene();
  const r = h.run("ae.unprecompose", { scope: "all", recursive: true, removeLayer: true, removeComps: true, holderName: "Прекомп" });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.precomps, 1); assert.equal(r.layers, 2); assert.equal(r.removedComps, 1);
  const names = h.comp.list.map((l) => l.name);
  assert.deepEqual(names, ["Заголовок", "Подпись"], "ни null, ни слоя прекомпа");
  const [a, b] = h.comp.list;
  assert.deepEqual([a.startTime, a.inPoint, a.outPoint], [2, 2.5, 5], "обрезано по началу прекомпа");
  assert.deepEqual([b.inPoint, b.outPoint], [5.5, 6], "обрезано по концу прекомпа");
  assert.equal(h.ctx.app.project.itemByID(inner.id), null);
});

test("распаковка: затухание прекомпа переходит выражением, масштаб — через null", () => {
  const { h, tr } = precompScene();
  tr.property("ADBE Opacity").setValueAtTime(2.5, 0); tr.property("ADBE Opacity").setValueAtTime(3, 100);
  tr.property("ADBE Scale").value = [50, 50, 100];
  const r = h.run("ae.unprecompose", { scope: "all", holderName: "Прекомп" });
  assert.equal(r.ok, true);
  const holder = h.comp.list.find((l) => l.nullLayer);
  assert.ok(holder, "есть null"); assert.match(holder.name, /^Прекомп 1: /);
  assert.deepEqual(holder.property("ADBE Transform Group").property("ADBE Opacity").keys.map((k) => k.v), [0, 100]);
  assert.deepEqual(plain(holder.property("ADBE Transform Group").property("ADBE Scale").value), [50, 50, 100]);
  const title = h.comp.list.find((l) => l.name === "Заголовок");
  assert.equal(title.parent, holder);
  assert.match(title.property("ADBE Transform Group").property("ADBE Opacity").expression, /thisComp\.layer\(.*\)\.transform\.opacity/);
});

test("распаковка: родители внутри прекомпа сохраняются, вложенные прекомпы тоже распаковываются", () => {
  const { h, inner, t1, t2 } = precompScene();
  t2.parent = t1;
  const deep = new h.ctx.CompItem([]); deep.name = "Вложенный";
  const d1 = deep.attach(new h.Layer({ name: "Глубоко" })); d1.selected = false; Object.assign(d1, { startTime: 0, inPoint: 0, outPoint: 20 });
  const nested = inner.attach(new h.Layer({ name: "Вложенный" })); nested.selected = false;
  Object.assign(nested, { source: deep, startTime: 0, inPoint: 0, outPoint: 20 });
  nested.property("ADBE Transform Group").property("ADBE Anchor Point").value = [960, 540];
  const r = h.run("ae.unprecompose", { scope: "all", recursive: true });
  assert.equal(r.precomps, 2);
  const names = h.comp.list.map((l) => l.name);
  assert.ok(names.includes("Глубоко") && !names.includes("Вложенный"), names.join(", "));
  const sub = h.comp.list.find((l) => l.name === "Подпись"), head = h.comp.list.find((l) => l.name === "Заголовок");
  assert.equal(sub.parent, head);
});

test("распаковка: Time Remap и эффекты — пропуск с понятной причиной; только выделенные", () => {
  const { h, pre } = precompScene();
  pre.timeRemapEnabled = true;
  const r = h.run("ae.unprecompose", { scope: "all" });
  assert.equal(r.code, "NOTHING_UNPACKED"); assert.equal(r.skipped.remap, 1);
  pre.timeRemapEnabled = false; pre.selected = false;
  assert.equal(h.run("ae.unprecompose", { scope: "selected" }).code, "NO_PRECOMP");
});


// ---------- старт проекта ----------
const TEMPLATE = ["01 Comps", "01 Comps/Main", "01 Comps/Precomps", "02 Footage", "02 Footage/Video", "02 Footage/Photo", "03 Audio", "03 Audio/Music", "03 Audio/SFX", "03 Audio/Voice",
  "04 Graphics", "04 Graphics/Logos", "04 Graphics/PNG", "04 Graphics/Vectors", "05 Solids & Nulls", "06 Renders", "07 Archive"];
const DEST = { main: "01 Comps/Main", precomps: "01 Comps/Precomps", video: "02 Footage/Video", photo: "02 Footage/Photo", png: "04 Graphics/PNG", vectors: "04 Graphics/Vectors",
  music: "03 Audio/Music", sfx: "03 Audio/SFX", voice: "03 Audio/Voice", logos: "04 Graphics/Logos", solids: "05 Solids & Nulls" };
const pathOf = (it) => { const p = []; let f = it.parentFolder; while (f && f.name !== "root") { p.unshift(f.name); f = f.parentFolder; } return p.join("/"); };

test("старт проекта: папки, главная композиция в Main; повторно — без дублей", () => {
  const h = makeContext(null);
  const args = { folders: TEMPLATE, dest: DEST, organize: true, comp: { name: "Main Edit v01", width: 1080, height: 1920, fps: 30, duration: 30 }, mainName: "Main Edit v01" };
  const r = h.run("ae.projectStart", args);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.folders, 17); assert.equal(r.compCreated, true);
  const main = h.ctx.app.project.item(h.ctx.app.project.numItems);
  const comp = [...Array(h.ctx.app.project.numItems)].map((_, i) => h.ctx.app.project.item(i + 1)).find((x) => x.name === "Main Edit v01");
  assert.equal(pathOf(comp), "01 Comps/Main");
  const n = h.ctx.app.project.numItems;
  const r2 = h.run("ae.projectStart", args);
  assert.equal(r2.folders, 0); assert.equal(r2.compCreated, false); assert.equal(h.ctx.app.project.numItems, n, "ничего не задвоилось");
  assert.equal(h.undo.filter((x) => x.startsWith("begin")).length, 2, "по одной undo-группе на нажатие");
  void main;
});

test("разложить: по типу и словам в имени; свои папки и вложенное не трогаем; папку Solids — в Solids & Nulls", () => {
  const h = makeContext(null);
  h.run("ae.projectStart", { folders: TEMPLATE, dest: DEST, organize: false, comp: null });
  const items = {
    clip: h.footage("drone_shot", "mp4"), photo: h.footage("IMG_2041", "jpg"), png: h.footage("arrow", "png"), logo: h.footage("Logo white", "png"),
    ai: h.footage("icons", "ai"), music: h.footage("bg track", "mp3", { hasVideo: false, hasAudio: true, duration: 120 }),
    whoosh: h.footage("whoosh 03", "wav", { hasVideo: false, hasAudio: true, duration: 1 }), vo: h.footage("VO take 2", "wav", { hasVideo: false, hasAudio: true, duration: 40 }),
    long: h.footage("ambience", "wav", { hasVideo: false, hasAudio: true, duration: 90 }), short: h.footage("pop", "wav", { hasVideo: false, hasAudio: true, duration: 2 }),
  };
  const solid = new h.ctx.FootageItem("Black Solid 1"); solid.mainSource = new h.ctx.SolidSourceCls(); solid.parentFolder = h.root;
  const solidsFolder = new h.FolderItem("Solids"); solidsFolder.parentFolder = h.root;
  const mine = new h.FolderItem("Мои исходники"); mine.parentFolder = h.root;
  const inside = h.footage("keep_me", "mp4"); inside.parentFolder = mine;
  const pre = h.ctx.app.project.items.addComp("Title", 100, 100, 1, 5, 25);
  const r = h.run("ae.organize", { dest: DEST, mainName: "Main Edit v01" });
  assert.equal(r.ok, true);
  const exp = { clip: "02 Footage/Video", photo: "02 Footage/Photo", png: "04 Graphics/PNG", logo: "04 Graphics/Logos", ai: "04 Graphics/Vectors",
    music: "03 Audio/Music", whoosh: "03 Audio/SFX", vo: "03 Audio/Voice", long: "03 Audio/Music", short: "03 Audio/SFX" };
  for (const [k, path] of Object.entries(exp)) assert.equal(pathOf(items[k]), path, k);
  assert.equal(pathOf(solid), "05 Solids & Nulls"); assert.equal(pathOf(solidsFolder), "05 Solids & Nulls");
  assert.equal(pathOf(pre), "01 Comps/Precomps");
  assert.equal(pathOf(mine), "", "своя папка осталась в корне"); assert.equal(pathOf(inside), "Мои исходники");
});

test("безопасная зона Reels: направляющий, залоченный, наверху; повторно — заменяется; скрыть/удалить", () => {
  const h = makeContext([]);
  h.comp.width = 1080; h.comp.height = 1920;
  h.comp.attach(new h.Layer({ name: "клип" }));
  h.run("ae.safeZone", { kind: "reels", name: "PA Safe Reels" });
  h.run("ae.safeZone", { kind: "reels", name: "PA Safe Reels" });
  const zones = h.comp.list.filter((l) => l.name === "PA Safe Reels");
  assert.equal(zones.length, 1); const z = zones[0];
  assert.equal(z.guideLayer, true); assert.equal(z.locked, true); assert.equal(h.comp.layer(1), z);
  const danger = z.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group");
  const rects = danger.children.filter((c) => c.matchName === "ADBE Vector Shape - Rect");
  assert.equal(rects.length, 5);
  assert.deepEqual(plain(rects[0].property("ADBE Vector Rect Size").value), [1080, 250]);
  h.run("ae.safeZoneToggle", { action: "hide" }); assert.equal(z.enabled, false); assert.equal(z.locked, true);
  h.run("ae.safeZoneToggle", { action: "delete" }); assert.equal(h.comp.list.some((l) => l.name.startsWith("PA Safe")), false);
  assert.equal(h.run("ae.safeZoneToggle", { action: "show" }).code, "NO_SAFE_ZONES");
});

test("порядок слоёв: лесенкой по времени, звук отдельным блоком снизу, залоченный слой на месте", () => {
  const h = makeContext([]);
  const guide = h.comp.attach(new h.Layer({ name: "PA Safe Reels" })); guide.locked = true;
  const mk = (name, t, audio) => { const l = h.comp.attach(new h.Layer({ name })); l.inPoint = t; if (audio) { l.hasAudio = true; l.hasVideo = false; } return l; };
  mk("v3", 6); mk("a1", 0, true); mk("v1", 0); mk("v2", 3); mk("a3", 6, true); mk("a2", 3, true);
  h.run("ae.orderLayers", { direction: "down", scope: "all", audio: "bottom" });
  assert.deepEqual(h.comp.list.map((l) => l.name), ["PA Safe Reels", "v1", "v2", "v3", "a1", "a2", "a3"]);
  h.run("ae.orderLayers", { direction: "up", scope: "all", audio: "together" });
  assert.deepEqual(h.comp.list.slice(1).map((l) => l.name.slice(1)), ["3", "3", "2", "2", "1", "1"]);
});

test("дубли эффектов: копии с номером уходят, первый остаётся; блокированные не трогаются", () => {
  const h = makeContext([]);
  const mk = (name, fx, locked = false) => {
    const l = h.comp.attach(new h.Layer({ name, locked }));
    const p = l.property("ADBE Effect Parade");
    for (const [m, n] of fx) { const e = p.addProperty(m); e.name = n; }
    return l;
  };
  const a = mk("A", [["CC Light Sweep", "CC Light Sweep"], ["ADBE Glo2", "Glow"], ["CC Light Sweep", "CC Light Sweep 2"], ["ADBE Glo2", "Glow 2"], ["ADBE Tint", "Tint"]]);
  const b = mk("B", [["ADBE Glo2", "Glow"], ["ADBE Glo2", "Glow 2"]], true);
  const c = mk("C", [["ADBE Glo2", "Glow"], ["ADBE Glo2", "Свечение"]]);
  const names = (l) => l.property("ADBE Effect Parade").children.map((e) => e.name);
  const r = h.run("ae.dedupeEffects", { scope: "all", mode: "copies" });
  assert.equal(r.ok, true); assert.equal(r.changed, 2); assert.equal(r.layers, 1); assert.equal(r.locked, 1);
  assert.deepEqual(names(a), ["CC Light Sweep", "Glow", "Tint"]);
  assert.deepEqual(names(b), ["Glow", "Glow 2"], "заблокированный слой не трогаем");
  assert.deepEqual(names(c), ["Glow", "Свечение"], "переименованный вручную — не копия");
  a.selected = false; b.selected = false; c.selected = true;
  const r2 = h.run("ae.dedupeEffects", { scope: "selected", mode: "all" });
  assert.equal(r2.changed, 2); assert.deepEqual(names(c), []); assert.equal(names(a).length, 3);
});

test("мои анимации: снять со слоя и наложить на другие — ключи от начала слоя, позиция смещением, эффекты, текст, TR In", () => {
  const h = makeContext([]);
  const src = h.comp.attach(h.makeText("Источник", { text: "ab" }));
  src.inPoint = 2;
  const tr = src.property("ADBE Transform Group");
  tr.property("ADBE Position").setValueAtTime(2, [100, 500]); tr.property("ADBE Position").setValueAtTime(3, [300, 500]);
  tr.property("ADBE Opacity").expression = "wiggle(1, 5)"; tr.property("ADBE Opacity").expressionEnabled = true;
  const glow = src.property("ADBE Effect Parade").addProperty("ADBE Glo2"); glow.name = "Свечение"; glow.property(1).value = 42;
  const anim = src.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
  anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").value = 0;
  const se = anim.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
  se.property("ADBE Text Expressible Amount").expression = 'MK("TR In")';
  src.property("ADBE Marker").setValueAtTime(2.6, new MarkerValue("TR In"));
  h.comp.list.forEach((l) => { l.selected = l === src; });
  const cap = h.run("ae.animCapture", {});
  assert.equal(cap.ok, true);
  assert.equal(cap.anim.stats.keys, 2); assert.equal(cap.anim.stats.effects, 1); assert.equal(cap.anim.stats.animators, 1);
  const anim2 = JSON.parse(JSON.stringify(cap.anim)); // как через localStorage

  const a = h.comp.attach(h.makeText("A", { text: "xyz" })); a.inPoint = 5;
  a.property("ADBE Transform Group").property("ADBE Position").value = [900, 200];
  const b = h.comp.attach(new h.Layer({ name: "B" })); b.inPoint = 1;
  h.comp.list.forEach((l) => { l.selected = l === a || l === b; });
  const r = h.run("ae.animApply", { anim: anim2, at: "layer", relative: true });
  assert.equal(r.ok, true); assert.equal(r.changed, 2); assert.equal(r.notText, 1); assert.equal(r.fails, 0);
  const pa = a.property("ADBE Transform Group").property("ADBE Position");
  assert.deepEqual(pa.keys.map((k) => [k.t, k.v]), [[5, [900, 200]], [6, [1100, 200]]], "от начала слоя и от его места");
  assert.equal(a.property("ADBE Transform Group").property("ADBE Opacity").expression, "wiggle(1, 5)");
  const g = a.property("ADBE Effect Parade").property(1);
  assert.equal(g.name, "Свечение"); assert.equal(g.property(1).value, 42);
  const an = a.property("ADBE Text Properties").property("ADBE Text Animators").property(1);
  assert.equal(an.property("ADBE Text Animator Properties").property(1).value, 0);
  assert.equal(an.property("ADBE Text Selectors").property(1).property("ADBE Text Expressible Amount").expression, 'MK("TR In")');
  assert.deepEqual(a.property("ADBE Marker").keys.map((k) => [k.t, k.v.comment]), [[5.6, "TR In"]]);
  assert.equal(b.property("ADBE Transform Group").property("ADBE Position").keys[0].t, 1, "не текст — трансформация и эффекты всё равно");
  assert.equal(b.property("ADBE Effect Parade").numProperties, 1);
  assert.equal(a.property("ADBE Text Properties").property("ADBE Text Document").value.text, "xyz", "текст не тронут");

  h.comp.time = 4;
  const c = h.comp.attach(new h.Layer({ name: "C" })); h.comp.list.forEach((l) => { l.selected = l === c; });
  h.run("ae.animApply", { anim: anim2, at: "playhead", relative: false });
  assert.deepEqual(c.property("ADBE Transform Group").property("ADBE Position").keys.map((k) => [k.t, k.v]), [[4, [100, 500]], [5, [300, 500]]]);
});

test("мои анимации: пустой слой — понятная ошибка", () => {
  const h = makeContext([]);
  h.comp.attach(new h.Layer({ name: "X" }));
  assert.equal(h.run("ae.animCapture", {}).code, "NOTHING_TO_SAVE");
});

test("TR на коротком слое: TR Out не встаёт раньше TR In, исчезание доходит до конца", () => {
  const { run, l, tr } = one();
  l.inPoint = 0; l.outPoint = 2;
  run("ae.motion", { mode: "in", duration: 1.3, fade: true, control: "marker", markerStyle: "tr", markerName: "П @@", hidden: "(1 - p)" });
  const r = run("ae.motion", { mode: "out", duration: 1.3, fade: true, control: "marker", markerStyle: "tr", markerName: "И @@", hidden: "p" });
  assert.equal(r.squeezed, 1);
  const ms = l.property("ADBE Marker").keys;
  assert.deepEqual(ms.map((k) => [Math.round(k.t * 100) / 100, k.v.comment]), [[1.3, "TR In"], [1.34, "TR Out"]], "кадр между маркерами — иначе AE заменит один другим");
  const opac = (time) => evalExpr(tr.property("ADBE Opacity").expression, { time, value: 100, inPoint: 0, outPoint: 2, thisLayer: { marker: markersOf(l) } });
  assert.equal(opac(0), 0); assert.equal(opac(1.32), 100, "полностью виден между анимациями"); assert.ok(opac(1.99) < 5, "к концу слоя исчез");
  // пользователь перетащил TR Out левее TR In — исчезание всё равно начинается после появления
  ms.find((k) => k.v.comment === "TR Out").t = 0.8;
  assert.equal(opac(1.3), 100); assert.ok(opac(1.99) < 5);
});
