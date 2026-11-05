import { easeIn, easeOut, type EaseKind } from "../lib/easing";
import { layersWord } from "../lib/format";
import { motion, type MotionInput } from "../tools/ae/motion";
import { act, DIR_SEG, slider, type Ctl, type Pose, type Preset, type Values } from "./types";

// Переходы слоёв. Каждый пресет — набор свойств для ae.motion + те же формулы для превью.
type Recipe = (v: Values) => Omit<MotionInput, "mode" | "duration" | "stagger" | "title">;

const SIDE: Ctl = { type: "seg", key: "side", label: "Откуда", value: "left", options: [{ value: "left", label: "←" }, { value: "right", label: "→" }, { value: "up", label: "↑" }, { value: "down", label: "↓" }] };
const DUR = slider("duration", "Длительность", 0.6, 0.1, 3, 0.05, "с");
const STAG = slider("stagger", "Шаг между слоями", 0.08, 0, 1, 0.01, "с");

const PREVIEW_SHIFT = 0.25; // превью: 1 px в AE ≈ 0,25 px на сцене

function poseFor(r: ReturnType<Recipe>, v: Values, i: number, t: number): Pose {
  const isIn = v.mode !== "out";
  const local = t - i * (v.stagger ?? 0);
  const p = local / Math.max(0.05, v.duration);
  const kind: EaseKind = r.spring && isIn ? "back" : "smooth";
  const e = isIn ? easeOut(kind, p) : easeIn("smooth", p);
  const h = isIn ? 1 - e : e; // 1 = спрятан, 0 = на месте
  const pose: Pose = {};
  if (r.fade) pose.o = 1 - Math.min(1, Math.max(0, isIn ? 1 - easeOut("smooth", p) : easeIn("smooth", p)));
  if (r.move) {
    const d = r.move.distance > 0 ? r.move.distance * PREVIEW_SHIFT : 160;
    const k = r.move.dir === "left" || r.move.dir === "up" ? -1 : 1;
    if (r.move.dir === "left" || r.move.dir === "right") pose.x = k * d * h; else pose.y = k * d * h * 0.6;
  }
  if (r.scaleFrom !== undefined && r.scaleFrom !== null) pose.s = 1 + (r.scaleFrom / 100 - 1) * h;
  if (r.rotateFrom) pose.r = (isIn ? 1 : -1) * r.rotateFrom * h;
  if (r.blurFrom) pose.b = (r.blurFrom * Math.max(0, h)) / 4;
  return pose;
}

function make(id: string, title: string, subtitle: string, group: string, extra: Ctl[], recipe: Recipe, multi = false): Preset {
  const controls = [DIR_SEG, DUR, ...extra, ...(multi ? [STAG] : [])];
  return {
    id, title, subtitle, group, controls,
    preview: (v) => {
      const r = recipe(v);
      const count = multi ? 3 : 1;
      return { kind: "layers", count, label: "Слой", length: v.duration + (count - 1) * (v.stagger ?? 0), pose: (i, t) => poseFor(r, v, i, t) };
    },
    hint: (_v, sel) => sel.selected ? `${layersWord(sel.selected)} · от текущего времени` : "Выделите слои и поставьте указатель времени",
    build: (v) => act(motion, { ...recipe(v), title, mode: v.mode, duration: v.duration, stagger: multi ? v.stagger : 0 }),
  };
}

export const TRANSITIONS: Preset[] = [
  make("pop", "Выпрыгивание", "Пружинный масштаб из точки", "Переходы", [slider("scale", "Масштаб в начале", 0, 0, 100, 1, "%")],
    (v) => ({ scaleFrom: v.scale, fade: true, spring: true })),
  make("zoom", "Наезд", "Резкий масштаб и проявление", "Переходы", [slider("scale", "Масштаб в начале", 140, 100, 300, 1, "%"), slider("blur", "Размытие", 12, 0, 80, 1, "px")],
    (v) => ({ scaleFrom: v.scale, fade: true, blurFrom: v.blur })),
  make("whip", "Хлыст", "Сдвиг с размытием и пружиной", "Переходы", [SIDE, slider("distance", "Расстояние", 300, 20, 1500, 10, "px"), slider("blur", "Размытие", 40, 0, 120, 1, "px")],
    (v) => ({ move: { dir: v.side, distance: v.distance }, blurFrom: v.blur, fade: true, spring: true })),
  make("spin", "Вкрутка", "Масштаб и поворот с пружиной", "Переходы", [slider("rotate", "Поворот", 90, 0, 720, 5, "°"), slider("scale", "Масштаб в начале", 0, 0, 100, 1, "%")],
    (v) => ({ rotateFrom: -v.rotate, scaleFrom: v.scale, fade: true, spring: true })),
  make("defocus", "Расфокус", "Проявление из размытия", "Переходы", [slider("blur", "Размытие", 40, 1, 150, 1, "px")],
    (v) => ({ blurFrom: v.blur, fade: true })),
  make("fly", "Влёт из-за кадра", "Слой прилетает из-за края", "Переходы", [SIDE, { type: "toggle", key: "spring", label: "Пружина", value: false }],
    (v) => ({ move: { dir: v.side, distance: 0 }, spring: v.spring })),
  make("fade", "Проявление", "Только прозрачность", "Переходы", [], () => ({ fade: true })),
  make("rise", "Подъём", "Снизу с проявлением, по очереди", "Каскад", [slider("distance", "Расстояние", 80, 10, 600, 5, "px")],
    (v) => ({ move: { dir: "down", distance: v.distance }, fade: true }), true),
  make("drop", "Падение", "Сверху с отскоком, по очереди", "Каскад", [slider("distance", "Расстояние", 120, 10, 800, 5, "px")],
    (v) => ({ move: { dir: "up", distance: v.distance }, fade: true, spring: true }), true),
  make("popSeq", "Выпрыгивание по очереди", "Масштаб из точки, один за другим", "Каскад", [],
    () => ({ scaleFrom: 0, fade: true, spring: true }), true),
  make("slideSeq", "Выезд по очереди", "Сбоку, один за другим", "Каскад", [SIDE, slider("distance", "Расстояние", 160, 10, 1200, 10, "px")],
    (v) => ({ move: { dir: v.side, distance: v.distance }, fade: true }), true),
  make("fadeSeq", "Проявление по очереди", "Каскад прозрачности", "Каскад", [], () => ({ fade: true }), true),
];
