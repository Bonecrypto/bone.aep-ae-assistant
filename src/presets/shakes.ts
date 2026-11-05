import { layersWord } from "../lib/format";
import { multiExpr } from "../tools/ae/style";
import { act, slider, type Pose, type Preset, type Values } from "./types";

// Тряска-удар от текущего времени: затухающие колебания. Двигает сам слой (выделите слой или прекомп сцены).
const POS = ["ADBE Transform Group", "ADBE Position"];
const ROT = ["ADBE Transform Group", "ADBE Rotate Z"];
const SCL = ["ADBE Transform Group", "ADBE Scale"];

// Тело функции цепочки выражений (см. host/src/05_markers.jsx): время удара и затухание — от маркера.
// Маркер начинается в момент удара, его длина — за сколько тряска затухает (до ~1%).
const HEAD = (name: string) => `var mk = MK(${JSON.stringify(name)});
if (!mk || time < mk.time) return value;
var I = effect("Тряска@@ · сила")(1), R = effect("Тряска@@ · поворот")(1), F = effect("Тряска@@ · частота")(1);
var t = time - mk.time, K = 4.6 / Math.max(mk.duration, 0.05);
function V(x, y) { return value.length == 3 ? [x, y, 0] : [x, y]; }
var d = Math.exp(-K * t), w = Math.sin(2 * Math.PI * F * t) * d, w2 = Math.cos(2 * Math.PI * F * t * 1.3) * d;
var nx = noise(t * F * 4) * d, ny = noise(t * F * 4 + 99) * d, nr = noise(t * F * 4 + 7) * d;
`;
const wrap = (name: string, body: string) => `${HEAD(name)}return ${body.replace(/;$/, "")};`;

type Body = { pos?: string; rot?: string; scale?: string };
type Sim = (v: Values, t: number) => Pose;

function make(id: string, title: string, subtitle: string, init: Record<string, number>, body: Body, sim: Sim): Preset {
  const controls = [
    slider("intensity", "Сила", init.intensity, 0, 400, 1, body.scale && !body.pos ? "%" : "px"),
    slider("rotation", "Поворот", init.rotation, 0, 45, 0.5, "°"),
    slider("frequency", "Частота", init.frequency, 0.5, 30, 0.5, "Гц"),
    slider("settle", "Длительность", init.settle, 0.1, 5, 0.05, "с"),
  ];
  return {
    id, title, subtitle, group: "Удары", controls,
    code: () => Object.entries(body).map(([k, b]) => `// ${k === "pos" ? "Position" : k === "rot" ? "Rotation" : "Scale"}\n${wrap(`${title} @@`, b!)}`).join("\n\n"),
    preview: (v) => ({ kind: "layers", count: 1, label: "Удар", length: v.settle + 0.3, pose: (_i, t) => sim(v, t) }),
    hint: (_v, sel) => sel.selected ? `${layersWord(sel.selected)} · удар в текущем времени, длительность — маркер на слое` : "Выделите слой (или прекомп сцены) и поставьте время удара",
    build: (v) => {
      const name = `${title} @@`;
      return act(multiExpr, {
        title, chain: true, marker: { name, duration: v.settle },
        controls: [{ name: "Тряска@@ · сила", value: v.intensity }, { name: "Тряска@@ · поворот", value: v.rotation }, { name: "Тряска@@ · частота", value: v.frequency }],
        items: [
          ...(body.pos ? [{ path: POS, code: wrap(name, body.pos) }] : []),
          ...(body.rot ? [{ path: ROT, code: wrap(name, body.rot) }] : []),
          ...(body.scale ? [{ path: SCL, code: wrap(name, body.scale) }] : []),
        ],
      });
    },
  };
}

const decay = (v: Values) => 4.6 / Math.max(v.settle, 0.05);
const osc = (v: Values, t: number) => {
  const d = Math.exp(-decay(v) * t);
  return { d, w: Math.sin(2 * Math.PI * v.frequency * t) * d, w2: Math.cos(2 * Math.PI * v.frequency * t * 1.3) * d };
};
const pseudoNoise = (x: number) => Math.sin(x * 12.9898) * 0.6 + Math.sin(x * 4.1414 + 1.3) * 0.4;
const K = 0.3; // px AE -> px превью

export const SHAKES: Preset[] = [
  make("bump", "Толчок", "Вертикальный удар", { intensity: 55, rotation: 2, frequency: 3, settle: 0.8 },
    { pos: "add(value, V(0, I * w));", rot: "value + R * w2;" },
    (v, t) => { const o = osc(v, t); return { y: v.intensity * o.w * K, r: v.rotation * o.w2 }; }),
  make("punch", "Удар зумом", "Масштаб-рывок и доворот", { intensity: 12, rotation: 3, frequency: 2.5, settle: 0.9 },
    { scale: "mul(value, 1 + I / 100 * w);", rot: "value + R * w2;" },
    (v, t) => { const o = osc(v, t); return { s: 1 + (v.intensity / 100) * o.w, r: v.rotation * o.w2 }; }),
  make("whip", "Хлёст", "Горизонтальный рывок с наклоном", { intensity: 80, rotation: 4, frequency: 2, settle: 0.9 },
    { pos: "add(value, V(I * w, 0));", rot: "value + R * w;" },
    (v, t) => { const o = osc(v, t); return { x: v.intensity * o.w * K, r: v.rotation * o.w }; }),
  make("slam", "Удар об пол", "Жёсткий удар по всем осям", { intensity: 70, rotation: 3, frequency: 4, settle: 0.7 },
    { pos: "add(value, V(I * w, I * 0.6 * w2));", rot: "value + R * w2;", scale: "mul(value, 1 + I / 1000 * Math.abs(w));" },
    (v, t) => { const o = osc(v, t); return { x: v.intensity * o.w * K, y: v.intensity * 0.6 * o.w2 * K, r: v.rotation * o.w2, s: 1 + (v.intensity / 1000) * Math.abs(o.w) }; }),
  make("jitter", "Дребезг", "Быстрая мелкая дрожь", { intensity: 14, rotation: 1, frequency: 12, settle: 1.5 },
    { pos: "add(value, V(I * nx, I * ny));", rot: "value + R * nr;" },
    (v, t) => { const d = Math.exp(-decay(v) * t), x = t * v.frequency * 4; return { x: v.intensity * pseudoNoise(x) * d * K * 2, y: v.intensity * pseudoNoise(x + 99) * d * K * 2, r: v.rotation * pseudoNoise(x + 7) * d }; }),
];
