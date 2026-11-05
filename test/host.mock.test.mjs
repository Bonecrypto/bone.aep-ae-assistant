// Прогон host/index.jsx на имитации объектной модели AE (node --test).
// Не заменяет проверку в настоящем AE, но ловит ошибки логики и undo-групп.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class KeyframeEase { constructor(speed, influence) { this.speed = speed; this.influence = influence; } }
class Prop {
  constructor(value) { this.value = value; this.keys = []; this.expression = ""; this.expressionEnabled = false; }
  valueAtTime(t) {
    if (!this.keys.length) return this.value;
    // ступенчатая интерполяция достаточна для теста
    let v = this.keys[0].v; for (const k of this.keys) if (k.t <= t) v = k.v; return v;
  }
  setValueAtTime(t, v) {
    const i = this.keys.findIndex((k) => k.t === t);
    const key = { t, v, inI: 6612, outI: 6612, inE: [new KeyframeEase(0, 16.7)], outE: [new KeyframeEase(0, 16.7)] };
    if (i >= 0) this.keys[i] = key; else { this.keys.push(key); this.keys.sort((a, b) => a.t - b.t); }
  }
  nearestKeyIndex(t) { let best = 0; this.keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(this.keys[best].t - t)) best = i; }); return best + 1; }
  key(i) { if (i < 1 || i > this.keys.length) throw new Error("bad key index " + i); return this.keys[i - 1]; }
  keyInInterpolationType(i) { return this.key(i).inI; }
  keyOutInterpolationType(i) { return this.key(i).outI; }
  setInterpolationTypeAtKey(i, a, b) { Object.assign(this.key(i), { inI: a, outI: b }); }
  keyInTemporalEase(i) { return this.key(i).inE; }
  keyOutTemporalEase(i) { return this.key(i).outE; }
  setTemporalEaseAtKey(i, a, b) { if (a.length !== 1 || b.length !== 1) throw new Error("ease dims"); Object.assign(this.key(i), { inE: a, outE: b }); }
}
class Group { constructor(map) { this.map = map; } property(n) { return this.map[n] ?? null; } }
class AVLayer {
  constructor({ pos = [960, 540], sep = false, locked = false, rect = { left: -100, top: -50, width: 200, height: 100 } } = {}) {
    this.locked = locked; this.parent = null; this.threeDLayer = false; this.rect = rect;
    const p = new Prop([...pos]); p.dimensionsSeparated = sep;
    this.tr = new Group({
      "ADBE Position": p, "ADBE Position_0": new Prop(pos[0]), "ADBE Position_1": new Prop(pos[1]),
      "ADBE Anchor Point": new Prop([0, 0]), "ADBE Scale": new Prop([100, 100]), "ADBE Rotate Z": new Prop(0),
    });
  }
  property(n) { return n === "ADBE Transform Group" ? this.tr : null; }
  sourceRectAtTime() { return this.rect; }
}
class CompItem { constructor(layers) { this.width = 1920; this.height = 1080; this.time = 1; this.selectedLayers = layers; } }

function load(activeItem) {
  const undo = [];
  const ctx = {
    CompItem, KeyframeEase, CameraLayer: class {}, LightLayer: class {},
    KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613, HOLD: 6614 },
    app: { version: "26.5", project: { activeItem }, beginUndoGroup: (n) => undo.push("begin:" + n), endUndoGroup: () => undo.push("end") },
  };
  ctx.$ = { global: ctx };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync("host/index.jsx", "utf8"), ctx);
  return { run: (name, args) => JSON.parse(ctx.AEA.run(name, args)), undo };
}

test("нет композиции", () => assert.equal(load(null).run("ae.flyIn", { direction: "left" }).code, "NO_COMP"));
test("нет выделения", () => assert.equal(load(new CompItem([])).run("ae.flyIn", { direction: "left" }).code, "NO_SELECTION"));

test("влёт слева: ключи, ease и одна undo-группа", () => {
  const l = new AVLayer();
  const h = load(new CompItem([l]));
  const r = h.run("ae.flyIn", { direction: "left", duration: 0.5, undoName: "Ассистент: влёт слева" });
  assert.equal(r.ok, true); assert.equal(r.changed, 1);
  const p = l.tr.property("ADBE Position");
  assert.equal(p.keys.length, 2);
  assert.deepEqual(p.keys[1].v, [960, 540]);
  assert.equal(p.keys[0].v[0], -20 - 100); // правый край (100 px) уходит за кадр + отступ 20
  assert.equal(p.keys[0].v[1], 540);
  assert.equal(p.keys[0].t, 1); assert.equal(p.keys[1].t, 1.5);
  assert.equal(p.keys[0].outE[0].influence, 15);
  assert.equal(p.keys[1].inE[0].influence, 85);
  assert.equal(p.keys[1].inI, 6613);
  assert.deepEqual(h.undo, ["begin:Ассистент: влёт слева", "end"]);
});

test("раздельные измерения: анимируется только X Position", () => {
  const l = new AVLayer({ sep: true });
  load(new CompItem([l])).run("ae.flyIn", { direction: "left" });
  assert.equal(l.tr.property("ADBE Position_0").keys.length, 2);
  assert.equal(l.tr.property("ADBE Position").keys.length, 0);
});

test("заблокированные пропускаются, undo-группа закрыта", () => {
  const h = load(new CompItem([new AVLayer({ locked: true })]));
  const r = h.run("ae.flyIn", { direction: "left" });
  assert.equal(r.code, "NOTHING_CHANGED"); assert.equal(r.skipped.locked, 1);
  assert.deepEqual(h.undo.at(-1), "end");
});

test("исключение внутри действия не оставляет открытую undo-группу", () => {
  const l = new AVLayer(); l.sourceRectAtTime = undefined; // ловится как fallback
  const l2 = new AVLayer(); l2.tr.map["ADBE Position"].setTemporalEaseAtKey = () => { throw new Error("boom"); };
  const h = load(new CompItem([l, l2]));
  const r = h.run("ae.flyIn", { direction: "left" });
  assert.equal(r.code, "EXCEPTION");
  assert.deepEqual(h.undo, ["begin:AE Assistant", "end"]);
});
