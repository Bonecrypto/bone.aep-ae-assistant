// Поиск битов и разбивка субтитров — на синтетических данных.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "test/.cache/beats.mjs");
buildSync({ stdin: { contents: 'export * from "./src/lib/beats.ts"; export { splitSegments } from "./src/lib/stt.ts";', resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", external: ["react"] });
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { detectBeats, toCompTimes, splitSegments } = await import(pathToFileURL(out).href);

function track(beats, sr = 22050, len = 6) {
  const x = new Float32Array(sr * len);
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < x.length; i++) x[i] = 0.05 * rnd() + 0.05 * Math.sin((2 * Math.PI * 2000 * i) / sr); // шум и высокий тон
  for (const b of beats) {                                        // бочка: затухающий синус 60 Гц
    const s = Math.round(b * sr);
    for (let j = 0; j < sr * 0.25 && s + j < x.length; j++) x[s + j] += 0.9 * Math.sin((2 * Math.PI * 60 * j) / sr) * Math.exp(-j / (sr * 0.06));
  }
  return { x, sr };
}

test("биты: 120 BPM находятся с точностью до 30 мс, лишних нет", () => {
  const beats = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const { x, sr } = track(beats);
  const found = detectBeats(x, sr, { bass: true, sensitivity: 0.6, minGap: 0.3 });
  assert.equal(found.length, beats.length, `нашлось: ${found.map((t) => t.toFixed(2)).join(", ")}`);
  found.forEach((t, i) => assert.ok(Math.abs(t - beats[i]) < 0.03, `${t} vs ${beats[i]}`));
});

test("биты: в тишине и ровном шуме ничего нет", () => {
  const { x, sr } = track([]);
  assert.equal(detectBeats(x, sr, { bass: true, sensitivity: 0.6, minGap: 0.3 }).length, 0);
});

test("биты → время композиции: начало слоя, растяжение, обрезка", () => {
  assert.deepEqual(toCompTimes([0.5, 1, 4], { startTime: 2, inPoint: 2, outPoint: 5, stretch: 100 }), [2.5, 3]);
  assert.deepEqual(toCompTimes([1], { startTime: 0, inPoint: 0, outPoint: 10, stretch: 200 }), [2]);
});

test("субтитры: длинная фраза режется по словам, время делится пропорционально", () => {
  const parts = splitSegments([{ start: 0, end: 4, text: "раз два три четыре пять шесть семь восемь" }], 20);
  assert.ok(parts.every((p) => p.text.length <= 20));
  assert.equal(parts.map((p) => p.text).join(" "), "раз два три четыре пять шесть семь восемь");
  assert.equal(parts[0].start, 0); assert.ok(Math.abs(parts.at(-1).end - 4) < 1e-9);
});

test("биты: бочка + хай-хэт — «Бас» ловит только бочку, «Все акценты» — больше", () => {
  const sr = 22050, kicks = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  const { x } = track(kicks, sr, 5);
  for (let h = 0.25; h < 4.5; h += 0.25) { // хай-хэт восьмыми: короткий высокий щелчок
    const s = Math.round(h * sr);
    for (let j = 0; j < sr * 0.03; j++) x[s + j] += 0.5 * Math.sin((2 * Math.PI * 7000 * j) / sr) * Math.exp(-j / (sr * 0.008));
  }
  const bass = detectBeats(x, sr, { bass: true, sensitivity: 0.6, minGap: 0.2 });
  assert.equal(bass.length, kicks.length, `бас: ${bass.map((t) => t.toFixed(2)).join(", ")}`);
  const all = detectBeats(x, sr, { bass: false, sensitivity: 0.6, minGap: 0.2 });
  assert.ok(all.length > kicks.length, `все акценты: ${all.length}`);
});
