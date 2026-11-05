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

test("текст: каждая единица от 100% (спрятана) к 0% по очереди, для всех пресетов и порядков", () => {
  for (const p of TABS_PRESETS.text.presets.filter((x) => x.build)) {
    for (const order of ["forward", "reverse", "center", "random"]) {
      for (const mode of ["in", "out"]) {
        const v = { ...defaults(p), order, mode };
        const a = p.build(v).input;
        const fx = sliders(a.controls); fx["Текст1 · старт"] = 0.2;
        const code = a.code.split("@@").join("1");
        const amount = (time, idx) => evalExpr(code, { effect: (n) => () => { if (!(n in fx)) throw new Error("нет " + n); return fx[n]; }, time, inPoint: 0, textIndex: idx, textTotal: 5 })[0];
        const start = amount(0, 1), end = amount(20, 3);
        assert.ok(Math.abs((mode === "in" ? start : end) - 100) < 1e-6, `${p.id}/${order}/${mode}: спрятан`);
        assert.ok(Math.abs(mode === "in" ? end : start) < 1e-6, `${p.id}/${order}/${mode}: виден`);
      }
    }
  }
});

test("текст: по порядку вторая буква стартует позже первой", () => {
  const p = TABS_PRESETS.text.presets.find((x) => x.id === "slide");
  const a = p.build({ ...defaults(p), step: 0.1, duration: 0.5 }).input;
  const fx = { ...sliders(a.controls), "Текст1 · старт": 0 };
  const amt = (i) => evalExpr(a.code.split("@@").join("1"), { effect: (n) => () => fx[n], time: 0.1, inPoint: 0, textIndex: i, textTotal: 5 })[0];
  assert.ok(amt(1) < amt(2));
});

test("тряска: до удара значение не меняется, после — затухает к нулю", () => {
  for (const p of TABS_PRESETS.shakes.presets) {
    const a = p.build(defaults(p)).input;
    const fx = { ...sliders(a.controls), "Тряска1 · старт": 1 };
    for (const it of a.items) {
      const value = it.path[1] === "ADBE Position" ? [960, 540] : it.path[1] === "ADBE Scale" ? [100, 100, 100] : 0;
      const run = (time) => evalExpr(it.code.split("@@").join("1"), { effect: (n) => () => { if (!(n in fx)) throw new Error("нет " + n); return fx[n]; }, time, inPoint: 0, value });
      assert.deepEqual(run(0.5), value, `${p.id} ${it.path[1]}: до удара`);
      const late = run(30);
      assert.ok(JSON.stringify(late) === JSON.stringify(value) || Math.abs([].concat(late)[0] - [].concat(value)[0]) < 1e-3, `${p.id}: затухло`);
      assert.notDeepEqual(run(1.07), value, `${p.id} ${it.path[1]}: трясёт`);
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
