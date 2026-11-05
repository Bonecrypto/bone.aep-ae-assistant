import { layersWord } from "../lib/format";
import { multiExpr } from "../tools/ae/style";
import { act, slider, type Pose, type Preset, type Values } from "./types";

// Тряска-удар от текущего времени: затухающие колебания. Двигает сам слой (выделите слой или прекомп сцены).
const POS = ["ADBE Transform Group", "ADBE Position"];
const ROT = ["ADBE Transform Group", "ADBE Rotate Z"];
const SCL = ["ADBE Transform Group", "ADBE Scale"];

const HEAD = `var S = effect("Тряска@@ · старт")(1), I = effect("Тряска@@ · сила")(1), R = effect("Тряска@@ · поворот")(1);
var F = effect("Тряска@@ · частота")(1), K = effect("Тряска@@ · затухание")(1);
var t = time - inPoint - S;
function V(x, y) { return value.length == 3 ? [x, y, 0] : [x, y]; }
if (t < 0) { value; } else {
  var d = Math.exp(-K * t), w = Math.sin(2 * Math.PI * F * t) * d, w2 = Math.cos(2 * Math.PI * F * t * 1.3) * d;
  var nx = noise(t * F * 4) * d, ny = noise(t * F * 4 + 99) * d, nr = noise(t * F * 4 + 7) * d;
`;
const wrap = (body: string) => `// AE Assistant — тряска\n${HEAD}  ${body}\n}`;

type Body = { pos?: string; rot?: string; scale?: string };
type Sim = (v: Values, t: number) => Pose;

function make(id: string, title: string, subtitle: string, init: Record<string, number>, body: Body, sim: Sim): Preset {
  const controls = [
    slider("intensity", "Сила", init.intensity, 0, 400, 1, body.scale && !body.pos ? "%" : "px"),
    slider("rotation", "Поворот", init.rotation, 0, 45, 0.5, "°"),
    slider("frequency", "Частота", init.frequency, 0.5, 30, 0.5, "Гц"),
    slider("settle", "Затухание", init.settle, 0.5, 20, 0.5),
  ];
  return {
    id, title, subtitle, group: "Удары", controls,
    code: () => Object.entries(body).map(([k, b]) => `// ${k === "pos" ? "Position" : k === "rot" ? "Rotation" : "Scale"}\n${wrap(b!)}`).join("\n\n"),
    preview: (v) => ({ kind: "layers", count: 1, label: "Удар", length: Math.min(2.5, 5 / Math.max(0.5, v.settle) + 0.2), pose: (_i, t) => sim(v, t) }),
    hint: (_v, sel) => sel.selected ? `${layersWord(sel.selected)} · удар в текущем времени` : "Выделите слой (или прекомп сцены) и поставьте время удара",
    build: (v) => act(multiExpr, {
      title,
      startSlider: "Тряска@@ · старт",
      controls: [
        { name: "Тряска@@ · старт", value: 0 }, { name: "Тряска@@ · сила", value: v.intensity }, { name: "Тряска@@ · поворот", value: v.rotation },
        { name: "Тряска@@ · частота", value: v.frequency }, { name: "Тряска@@ · затухание", value: v.settle },
      ],
      items: [
        ...(body.pos ? [{ path: POS, code: wrap(body.pos) }] : []),
        ...(body.rot ? [{ path: ROT, code: wrap(body.rot) }] : []),
        ...(body.scale ? [{ path: SCL, code: wrap(body.scale) }] : []),
      ],
    }),
  };
}

const osc = (v: Values, t: number) => {
  const d = Math.exp(-v.settle * t);
  return { d, w: Math.sin(2 * Math.PI * v.frequency * t) * d, w2: Math.cos(2 * Math.PI * v.frequency * t * 1.3) * d };
};
const pseudoNoise = (x: number) => Math.sin(x * 12.9898) * 0.6 + Math.sin(x * 4.1414 + 1.3) * 0.4;
const K = 0.3; // px AE -> px превью

export const SHAKES: Preset[] = [
  make("bump", "Толчок", "Вертикальный удар", { intensity: 55, rotation: 2, frequency: 3, settle: 6 },
    { pos: "add(value, V(0, I * w));", rot: "value + R * w2;" },
    (v, t) => { const o = osc(v, t); return { y: v.intensity * o.w * K, r: v.rotation * o.w2 }; }),
  make("punch", "Удар зумом", "Масштаб-рывок и доворот", { intensity: 12, rotation: 3, frequency: 2.5, settle: 5 },
    { scale: "mul(value, 1 + I / 100 * w);", rot: "value + R * w2;" },
    (v, t) => { const o = osc(v, t); return { s: 1 + (v.intensity / 100) * o.w, r: v.rotation * o.w2 }; }),
  make("whip", "Хлёст", "Горизонтальный рывок с наклоном", { intensity: 80, rotation: 4, frequency: 2, settle: 5 },
    { pos: "add(value, V(I * w, 0));", rot: "value + R * w;" },
    (v, t) => { const o = osc(v, t); return { x: v.intensity * o.w * K, r: v.rotation * o.w }; }),
  make("slam", "Удар об пол", "Жёсткий удар по всем осям", { intensity: 70, rotation: 3, frequency: 4, settle: 7 },
    { pos: "add(value, V(I * w, I * 0.6 * w2));", rot: "value + R * w2;", scale: "mul(value, 1 + I / 1000 * Math.abs(w));" },
    (v, t) => { const o = osc(v, t); return { x: v.intensity * o.w * K, y: v.intensity * 0.6 * o.w2 * K, r: v.rotation * o.w2, s: 1 + (v.intensity / 1000) * Math.abs(o.w) }; }),
  make("jitter", "Дребезг", "Быстрая мелкая дрожь", { intensity: 14, rotation: 1, frequency: 12, settle: 3 },
    { pos: "add(value, V(I * nx, I * ny));", rot: "value + R * nr;" },
    (v, t) => { const d = Math.exp(-v.settle * t), x = t * v.frequency * 4; return { x: v.intensity * pseudoNoise(x) * d * K * 2, y: v.intensity * pseudoNoise(x + 99) * d * K * 2, r: v.rotation * pseudoNoise(x + 7) * d }; }),
];
