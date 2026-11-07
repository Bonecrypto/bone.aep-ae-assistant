// Код выражений из пресетов (текст, тряска, выражения) — на имитации движка выражений AE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "test/.cache/presets.mjs");
buildSync({ entryPoints: [path.join(root, "src/presets/all.ts")], bundle: true, format: "esm", platform: "node", outfile: out, jsx: "automatic", logLevel: "error",
  define: { __APP_VERSION__: '"test"', __BUILD__: '"0"' } });
globalThis.window = { location: { href: "file:///x" } };
const { TABS_PRESETS } = await import(pathToFileURL(out).href);
const { defaults } = await import(pathToFileURL(out).href).then(() => ({ defaults: (p) => Object.fromEntries(p.controls.map((c) => [c.key, c.value])) }));

const op = (f) => (a, b) => (Array.isArray(a) ? a.map((x, i) => f(x, Array.isArray(b) ? b[i] : b)) : f(a, b));
function evalExpr(code, env) {
  const base = {
    add: op((a, b) => a + b), sub: op((a, b) => a - b), mul: op((a, b) => a * b), length: (v) => Math.hypot(...v),
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)), noise: (x) => Math.sin(x * 1.7) * 0.8, linear: (t, t0, t1, a, b) => a + (b - a) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0))),
    seedRandom: () => {}, random: (n) => (n ?? 1) * 0.37, thisComp: { frameDuration: 0.04 },
  };
  const all = { ...base, ...env };
  return new Function(...Object.keys(all), `return eval(${JSON.stringify(code)})`)(...Object.values(all));
}
const sliders = (controls, tag = "1") => Object.fromEntries(controls.map((c) => [c.name.split("@@").join(tag), c.value]));

const MKDEF = "function MK(n) { var m = thisLayer.marker; for (var k = m.numKeys; k >= 1; k--) { if (m.key(k).comment == n) return m.key(k); } return null; }";
const layerWith = (marks) => ({ marker: { numKeys: marks.length, key: (k) => marks[k - 1] } });

test("текст: время — от маркера; каждая единица от 100% (спрятана) к 0%, для всех пресетов и порядков", () => {
  for (const p of TABS_PRESETS.text.presets.filter((x) => x.build)) {
    for (const order of ["forward", "reverse", "center", "random"]) {
      for (const mode of ["in", "out"]) {
        const v = { ...defaults(p), order, mode };
        const a = p.build(v).input;
        assert.ok(a.marker && a.marker.duration > 0, `${p.id}: есть маркер`);
        const fx = sliders(a.controls);
        const code = a.code.split("@@").join("1");
        const mk = { comment: a.marker.name.split("@@").join("1"), time: 0.2, duration: a.marker.duration };
        const amount = (time, idx, marks = [mk]) => evalExpr(code, { effect: (n) => () => { if (!(n in fx)) throw new Error("нет " + n); return fx[n]; }, time, inPoint: 0, textIndex: idx, textTotal: 5, thisLayer: layerWith(marks) })[0];
        const start = amount(0, 1), end = amount(0.2 + a.marker.duration + 0.01, 5);
        assert.ok(Math.abs((mode === "in" ? start : end) - 100) < 1e-6, `${p.id}/${order}/${mode}: спрятан (${mode === "in" ? start : end})`);
        assert.ok(Math.abs(mode === "in" ? end : start) < 1e-6, `${p.id}/${order}/${mode}: виден к концу маркера (${mode === "in" ? end : start})`);
        assert.equal(amount(0.5, 2, []), 0, `${p.id}: маркер удалён — текст виден`);
      }
    }
  }
});

test("текст: последняя буква заканчивает ровно к концу маркера; растянули маркер — анимация длиннее", () => {
  const p = TABS_PRESETS.text.presets.find((x) => x.id === "slide");
  const a = p.build({ ...defaults(p), total: 1, soft: 40 }).input;
  const code = a.code.split("@@").join("1"), name = a.marker.name.split("@@").join("1");
  const amt = (time, i, dur = 1) => evalExpr(code, { effect: () => () => 40, time, inPoint: 0, textIndex: i, textTotal: 5, thisLayer: layerWith([{ comment: name, time: 0, duration: dur }]) })[0];
  assert.ok(amt(0.1, 1) < amt(0.1, 2), "вторая позже первой");
  assert.ok(amt(0.99, 5) > 0 && Math.abs(amt(1.0, 5)) < 1e-9, "последняя ровно к концу");
  assert.ok(amt(1.0, 5, 2) > 0, "маркер 2 с — в 1 с ещё идёт");
});

test("тряска: до маркера без изменений, после — затухает к концу маркера", () => {
  for (const p of TABS_PRESETS.shakes.presets) {
    const a = p.build(defaults(p)).input;
    assert.equal(a.chain, true);
    const fx = sliders(a.controls);
    const mk = { comment: a.marker.name.split("@@").join("1"), time: 1, duration: a.marker.duration };
    for (const it of a.items) {
      const value = it.path[1] === "ADBE Position" ? [960, 540] : it.path[1] === "ADBE Scale" ? [100, 100, 100] : 0;
      const body = it.code.split("@@").join("1");
      const run = (time) => evalExpr(`${MKDEF}\n(function (value) {\n${body}\n})(value)`, { effect: (n) => () => { if (!(n in fx)) throw new Error("нет " + n); return fx[n]; }, time, value, thisLayer: layerWith([mk]) });
      assert.deepEqual(run(0.5), value, `${p.id} ${it.path[1]}: до удара`);
      assert.notDeepEqual(run(1.07), value, `${p.id} ${it.path[1]}: трясёт`);
      const late = [].concat(run(1 + mk.duration * 2)), v0 = [].concat(value);
      assert.ok(late.every((x, i) => Math.abs(x - v0[i]) < 0.05 * Math.max(1, fx[Object.keys(fx).find((k) => k.includes("сила"))] / 10)), `${p.id}: затухло к концу маркера`);
    }
  }
});

test("все пресеты вкладок собирают действие с параметрами по умолчанию", () => {
  let n = 0;
  for (const [tab, t] of Object.entries(TABS_PRESETS)) for (const p of t.presets) {
    if (!p.build) continue;
    const a = p.build(defaults(p));
    assert.ok(a.tool && a.tool.name, `${tab}/${p.id}`);
    n++;
  }
  assert.ok(n > 60, `пресетов: ${n}`);
});

test("id пресетов уникальны внутри вкладки", () => {
  for (const [tab, t] of Object.entries(TABS_PRESETS)) {
    const ids = t.presets.map((p) => p.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dup, [], `${tab}: повторяются ${dup.join(", ")}`);
  }
});

test("счётчики: выражение даёт правильный текст в начале, середине и конце маркера", () => {
  const c = Object.fromEntries(TABS_PRESETS.create.presets.filter((p) => p.group === "Счётчики").map((p) => [p.id, p]));
  const run = (p, v, time) => {
    const a = p.build({ ...defaults(p), ...v }).input;
    const fx = Object.fromEntries(a.controls.map((x) => [x.name.split("@@").join("1"), x.value]));
    const mk = { comment: a.marker.name.split("@@").join("1"), time: 1, duration: a.marker.duration };
    return evalExpr(a.code.split("@@").join("1"), { effect: (n) => () => { if (!(n in fx)) throw new Error("нет " + n); return fx[n]; }, time, thisLayer: layerWith([mk]) });
  };
  assert.equal(run(c.count, { from: 0, to: 1500, ease: "linear", duration: 2 }, 0), "0");
  assert.equal(run(c.count, { from: 0, to: 1500, ease: "linear", duration: 2 }, 3), "1\u00a0500");
  assert.equal(run(c.percent, { ease: "linear", duration: 1 }, 1.5), "50%");
  assert.equal(run(c.money, { from: 0, to: 250000, cur: "usd", ease: "linear", duration: 2 }, 3), "$250,000");
  assert.equal(run(c.money, { from: 0, to: 1234.5, decimals: 2, cur: "rub", ease: "linear", duration: 2 }, 3), "1\u00a0234,50\u00a0₽");
  assert.equal(run(c.timer, { from: 90, to: 0, ease: "linear", duration: 90 }, 1), "01:30");
  assert.equal(run(c.timer, { from: 3700, to: 0, ease: "linear", duration: 10 }, 0), "1:01:40");
});
