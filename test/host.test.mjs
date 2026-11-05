import { test } from "node:test";
import assert from "node:assert/strict";
import { makeContext, plain, PVT } from "./ae-mock.mjs";

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
