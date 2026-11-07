import { EASE_EXPR, easeIn, easeOut, type EaseKind } from "../lib/easing";
import { getPrefs } from "../lib/store";
import { layersWord } from "../lib/format";
import { motion, type MotionInput } from "../tools/ae/motion";
import { sceneTransition, type SceneKind } from "../tools/ae/scene";
import { libImport } from "../tools/ae/library";
import { carousel } from "../tools/ae/mtools";
import type { LibItem } from "../lib/library";
import { act, AT_SEG, DIR_SEG, slider, type Ctl, type Pose, type Preset, type Values } from "./types";

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

/** Режим маркера: насколько слой «спрятан» (h) от прогресса p внутри маркера — та же кривая, что в превью. */
export function markerArgs(title: string, mode: string, spring: boolean) {
  if (getPrefs().animControl === "keys") return { control: "keys" as const };
  const hidden = mode === "out"
    ? `(function (p) { return 1 - ${EASE_EXPR.smooth}; })(1 - p)`
    : `(1 - ${EASE_EXPR[spring ? "back" : "smooth"]})`;
  return { control: "marker" as const, markerName: `${mode === "out" ? "Исчезание" : "Появление"} · ${title} @@`, hidden };
}

function make(id: string, title: string, subtitle: string, group: string, extra: Ctl[], recipe: Recipe, multi = false): Preset {
  const controls = [DIR_SEG, AT_SEG, DUR, ...extra, ...(multi ? [STAG] : [])];
  return {
    id, title, subtitle, group, controls,
    preview: (v) => {
      const r = recipe(v);
      const count = multi ? 3 : 1;
      return { kind: "layers", count, label: "Слой", length: v.duration + (count - 1) * (v.stagger ?? 0), pose: (i, t) => poseFor(r, v, i, t) };
    },
    hint: (_v, sel) => sel.selected
      ? `${layersWord(sel.selected)} · ${getPrefs().animControl === "marker" ? "длительность — маркер на слое, тяните его конец" : "ключами от текущего времени"}`
      : "Выделите слои и поставьте указатель времени",
    build: (v) => act(motion, { ...recipe(v), title, mode: v.mode, duration: v.duration, stagger: multi ? v.stagger : 0, at: v.at, ...markerArgs(title, v.mode, !!recipe(v).spring) }),
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

// ---------- переходы между сценами (на склейке) ----------
/** Превью «кадр A → кадр B»: склейка посередине. */
function scenePose(kind: SceneKind, v: Values, i: number, t: number): Pose {
  const L = v.duration, cut = L / 2, a = v.amount / 100;
  const isA = i === 0, before = t < cut;
  if ((isA && !before) || (!isA && before)) return { o: 0 };
  const p = before ? t / cut : (t - cut) / cut; // 0..1 внутри половины
  const inT = p * p, outT = 1 - (1 - p) * (1 - p);
  switch (kind) {
    case "dip": return {}; // затемнение рисует чёрный слой поверх
    case "flash": return { o: 1, b: 0, s: 1 };
    case "blur": return { b: (before ? inT : 1 - outT) * 14 * a };
    case "zoomIn": return before ? { s: 1 + inT * 2 * a, b: inT * 6 } : { s: 0.33 + outT * 0.67, b: (1 - outT) * 6 };
    case "zoomOut": return before ? { s: 1 - inT * 0.67, b: inT * 6 } : { s: 1 + (1 - outT) * 2 * a, b: (1 - outT) * 6 };
    case "spin": return { r: (before ? inT : -(1 - outT)) * 180 * a, b: (before ? inT : 1 - outT) * 5 };
    case "whip": {
      const k = v.side === "left" || v.side === "up" ? -1 : 1, D = 220 * a;
      const off = before ? k * D * inT : -k * D * (1 - outT);
      return v.side === "up" || v.side === "down" ? { y: off * 0.5, b: Math.abs(off) / 30 } : { x: off, b: Math.abs(off) / 30 };
    }
  }
  return {};
}

function scene(id: string, title: string, subtitle: string, kind: SceneKind, extra: Ctl[] = [], amount = 100): Preset {
  return {
    id, title, subtitle, group: "Между сценами",
    controls: [slider("duration", "Длительность", 0.6, 0.1, 3, 0.05, "с"), ...extra, slider("amount", "Сила", amount, 10, 300, 1, "%"),
      ...(["zoomIn", "zoomOut", "whip", "spin"].includes(kind) ? [{ type: "toggle", key: "motionBlur", label: "Размытие движения", value: true } as Ctl] : [])],
    preview: (v) => ({ kind: "cut", length: v.duration, flash: kind === "flash" ? v.amount / 100 : 0, dip: kind === "dip", pose: (i, t) => scenePose(kind, v, i, t) }),
    hint: () => "Время на склейку → «Применить». Длительность = длина слоя перехода: тяните его края",
    build: (v) => act(sceneTransition, { title, kind, duration: v.duration, side: v.side, amount: v.amount, motionBlur: v.motionBlur }),
  };
}

export const SCENE_TRANSITIONS: Preset[] = [
  scene("dip", "Через чёрное", "Затемнение и проявление", "dip"),
  scene("flash", "Вспышка", "Белая вспышка на склейке", "flash"),
  scene("blurCut", "Размытие", "Расфокус через склейку", "blur", [], 60),
  scene("zoomIn", "Зум вперёд", "Проезд камерой сквозь кадр", "zoomIn"),
  scene("zoomOut", "Зум назад", "Отъезд с рывком", "zoomOut"),
  scene("whipCut", "Хлыст-панорама", "Резкая панорама с размытием", "whip", [{ ...SIDE, label: "Куда", value: "left" } as Ctl]),
  scene("spinCut", "Поворот", "Закрутка через склейку", "spin"),
];

/** Переходы пользователя из библиотеки: папки, в названии которых есть «переход» / «transition». */
export function libraryTransitions(items: LibItem[]): Preset[] {
  return items
    .filter((it) => /переход|transition/i.test(it.category) && (it.kind === "template" || it.kind === "preset"))
    .map((it) => ({
      id: `lib:${it.path}`, title: it.name, subtitle: it.kind === "template" ? "Шаблон из библиотеки" : "Пресет из библиотеки", group: "Мои переходы",
      controls: [],
      preview: () => (it.preview ? { kind: "media" as const, path: it.preview } : { kind: "cut" as const, length: 1, pose: (i: number, t: number) => scenePose("zoomIn", { duration: 1, amount: 100 }, i, t) }),
      hint: () => (it.kind === "template" ? "Маркер в шаблоне встанет на текущее время (склейку)" : "На выделенные слои или новый корректирующий слой"),
      build: () => act(libImport, { item: it }),
    }));
}

// ---------- карусель ----------
function carouselPose(v: Values, i: number, t: number): Pose {
  const step = v.hold + v.move, n = 3;
  const k = Math.min(n - 1, Math.floor(t / step)), local = t - k * step;
  const m = local <= v.hold || k >= n - 1 ? 0 : easeOut("smooth", (local - v.hold) / v.move);
  const pos = k + m, d = i - pos, ad = Math.abs(d);
  const pose: Pose = { x: d * 62 };
  if (v.mode === "cover") { pose.s = ad < 1 ? 1 - 0.25 * ad : Math.max(0.6, 0.75 - 0.15 * (ad - 1)); pose.o = ad < 1 ? 1 - 0.4 * ad : Math.max(0, 0.6 - 0.6 * (ad - 1)); }
  return pose;
}
const carouselPreset = (id: string, title: string, subtitle: string, mode: "slide" | "cover"): Preset => ({
  id, title, subtitle, group: "Карусель",
  controls: [slider("hold", "Пауза в центре", 1, 0, 10, 0.1, "с"), slider("move", "Переезд", 0.6, 0.1, 5, 0.05, "с"), slider("spacing", "Шаг между слоями", 1100, 50, 5000, 10, "px")],
  preview: (v) => ({ kind: "layers", count: 3, length: 3 * (v.hold + v.move), pose: (i, t) => carouselPose({ ...v, mode }, i, t) }),
  hint: (_v, sel) => (sel.selected > 1 ? `${layersWord(sel.selected)} по порядку в таймлайне, от текущего времени` : "Выделите минимум два слоя"),
  build: (v) => act(carousel, { title, mode, hold: v.hold, move: v.move, spacing: v.spacing }),
});
export const CAROUSELS: Preset[] = [
  carouselPreset("carousel", "Карусель", "Слои по очереди выезжают в центр", "slide"),
  carouselPreset("carouselCover", "Карусель-обложки", "Центр крупно, соседи меньше", "cover"),
];
