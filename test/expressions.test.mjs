// Выражения из пресетов на имитации движка выражений AE: ключи, скорость, эффекты-ползунки.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPR_PRESETS, buildExpression } from "../src/presets/expressions.ts";

const isArr = Array.isArray;
const op = (f) => (a, b) => (isArr(a) ? a.map((x, i) => f(x, isArr(b) ? b[i] : b)) : f(a, b));

/** Свойство с линейной интерполяцией между ключами [{t, v}]. */
function property(keys) {
  const valueAt = (t) => {
    if (t <= keys[0].t) return keys[0].v;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b.t) { const k = (t - a.t) / (b.t - a.t); return op((x, y) => x + (y - x) * k)(a.v, b.v); }
    }
    return keys[keys.length - 1].v;
  };
  const h = 1e-4;
  return { valueAt, velocityAt: (t) => op((x, y) => (y - x) / (2 * h))(valueAt(t - h), valueAt(t + h)) };
}

function evaluate(code, prop, keys, time, sliders) {
  const env = {
    value: prop.valueAt(time), time, numKeys: keys.length,
    key: (i) => ({ time: keys[i - 1].t, value: keys[i - 1].v, index: i }),
    nearestKey: (t) => { let best = 0; keys.forEach((k, i) => { if (Math.abs(k.t - t) < Math.abs(keys[best].t - t)) best = i; }); return { index: best + 1, time: keys[best].t }; },
    velocityAtTime: prop.velocityAt, thisComp: { frameDuration: 1 / 25 },
    effect: (name) => () => { if (!(name in sliders)) throw new Error("нет эффекта " + name); return sliders[name]; },
    length: (v) => Math.hypot(...v), clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    add: op((a, b) => a + b), sub: op((a, b) => a - b), mul: op((a, b) => a * b),
    radiansToDegrees: (r) => (r * 180) / Math.PI, wiggle: () => prop.valueAt(time), loopOut: () => prop.valueAt(time),
    toComp: (p) => p, anchorPoint: [0, 0],
  };
  return new Function(...Object.keys(env), `return eval(${JSON.stringify(code)})`)(...Object.values(env));
}

function run(id, keys, times, params = {}) {
  const p = EXPR_PRESETS.find((x) => x.id === id);
  const b = buildExpression(p, params);
  const sliders = Object.fromEntries(b.controls.filter((c) => c.type === "slider").map((c) => [c.name, c.value]));
  const prop = property(keys);
  return times.map((t) => evaluate(b.code, prop, keys, t, sliders));
}

const after = Array.from({ length: 200 }, (_, i) => 1 + (i + 1) * 0.01); // 2 секунды после ключа

test("все пресеты выполняются без ошибок", () => {
  const keys = [{ t: 0, v: [0, 0] }, { t: 1, v: [100, 0] }];
  for (const p of EXPR_PRESETS) {
    if (p.lookAtLast) continue; // нужен второй слой
    assert.doesNotThrow(() => run(p.id, keys, [0.5, 1.5]), p.id);
  }
});

test("отскок-мяч: только назад от ключа, параболы, возвращается в ключ", () => {
  const vals = run("bounce", [{ t: 0, v: 0 }, { t: 1, v: 100 }], after, { elastic: 55, gravity: 500, count: 4 });
  assert.ok(vals.every((v) => v <= 100 + 1e-9), "не проскакивает за ключ");
  const first = Math.min(...vals);
  assert.ok(Math.abs(100 - first - (55 * 55) / (2 * 500)) < 0.2, `высота первого отскока ${100 - first}`);
  assert.equal(vals.at(-1), 100, "в конце стоит в ключе");
});

test("отскок по 2D позиции — против направления прилёта", () => {
  const [v] = run("bounce", [{ t: 0, v: [0, 0] }, { t: 1, v: [0, 300] }], [1.05], { elastic: 50, gravity: 2000 });
  assert.equal(v[0], 0);
  assert.ok(v[1] < 300);
});

test("инерция: перелёт за ключ и обратно, затухает", () => {
  const vals = run("inertia", [{ t: 0, v: 0 }, { t: 1, v: 100 }], after);
  assert.ok(Math.max(...vals) > 100 && Math.min(...vals) < 100);
  assert.ok(Math.abs(vals.at(-1) - 100) < 0.5);
});

test("на промежуточном ключе (движение продолжается) эффекта нет", () => {
  const keys = [{ t: 0, v: 0 }, { t: 1, v: 100 }, { t: 2, v: 200 }];
  const prop = property(keys);
  for (const id of ["bounce", "inertia", "elastic"]) {
    const vals = run(id, keys, [1.2, 1.5]);
    assert.deepEqual(vals, [prop.valueAt(1.2), prop.valueAt(1.5)], id);
  }
});

test("Easy Ease на входе (скорость 0) — выражение не ломается, значение не меняется", () => {
  const keys = [{ t: 0, v: 100 }, { t: 1, v: 100 }];
  assert.deepEqual(run("bounce", keys, [1.2]), [100]);
});
