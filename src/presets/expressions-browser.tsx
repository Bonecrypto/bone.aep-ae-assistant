import { buildExpression, EXPR_PRESETS, type ExprPreset } from "./expressions";
import { customExpression, expression, clearExpression } from "../tools/ae/expression";
import { act, slider, type Ctl, type Pose, type Preset, type Values } from "./types";

// Вкладка «Выражения»: пресеты из expressions.ts + выбор свойства + показ кода + живое превью.
const PROP: Ctl = { type: "seg", key: "prop", label: "Свойство", value: "auto", options: [
  { value: "auto", label: "Авто" }, { value: "pos", label: "Позиция" }, { value: "scale", label: "Масштаб" }, { value: "rot", label: "Поворот" }, { value: "opacity", label: "Прозр." },
] };
const PATH: Record<string, string[]> = {
  pos: ["ADBE Transform Group", "ADBE Position"], scale: ["ADBE Transform Group", "ADBE Scale"],
  rot: ["ADBE Transform Group", "ADBE Rotate Z"], opacity: ["ADBE Transform Group", "ADBE Opacity"],
};

const SUB: Record<string, string> = {
  wiggle: "Дрожание любого свойства", shake: "Плавное «ручное» покачивание", loopCycle: "Ключи по кругу бесконечно",
  loopPingpong: "Вперёд и назад", loopOffset: "Каждый цикл продолжает прошлый", inertia: "Перелёт и покачивание в ключе",
  bounce: "Мяч: отскоки от ключа", elastic: "Быстрые отскоки назад", lookAt: "Поворот к другому слою",
  spin: "Постоянное вращение", pulse: "Ритмичный масштаб", sine: "Плавная волна", float: "Парение вверх-вниз",
  flicker: "Случайное мигание", autoFade: "Проявление и затухание на краях слоя",
  throw: "Бросок с плавным торможением", breathe: "Медленное дыхание масштабом", beatPulse: "Толчок на каждом маркере",
};
const GROUP: Record<string, string> = { inertia: "После ключа", bounce: "После ключа", elastic: "После ключа", loopCycle: "Повтор", loopPingpong: "Повтор", loopOffset: "Повтор" };

const nz = (x: number) => Math.sin(x * 2.1) * 0.5 + Math.sin(x * 4.7 + 1) * 0.3 + Math.sin(x * 9.3 + 2) * 0.2;

/** Превью выражений: простые симуляции того же поведения на квадрате. */
function sim(id: string, v: Values, t: number): Pose {
  const k = 0.3;
  switch (id) {
    case "wiggle": return { x: v.amp * k * nz(t * v.freq), y: v.amp * k * nz(t * v.freq + 40) };
    case "shake": return { x: v.amp * k * nz(t * v.freq * 0.7), y: v.amp * k * nz(t * v.freq * 0.7 + 9), r: nz(t * v.freq + 3) * 2 };
    case "loopCycle": return { x: ((t % 1) - 0.5) * 120 };
    case "loopPingpong": { const q = t % 2; return { x: ((q < 1 ? q : 2 - q) - 0.5) * 120 }; }
    case "loopOffset": return { x: (((t * 40) % 200) - 100) };
    case "inertia": { const m = Math.min(1, t / 0.4), x = -80 + 80 * m; const a = t - 0.4; return { x: a > 0 ? (v.amp / 100) * 200 * Math.sin(v.freq * a * 2 * Math.PI) / Math.exp(v.decay * a) * 2 : x }; }
    case "bounce": case "elastic": {
      if (t < 0.4) return { y: -60 + (t / 0.4) ** 2 * 60 };
      let a = t - 0.4, s = 300 * (id === "bounce" ? v.elastic / 100 : 0.5), g = id === "bounce" ? v.gravity / 10 : 1500;
      for (let b = 0; b < (id === "bounce" ? v.count : 5); b++) { const d = (2 * s) / g; if (a < d) return { y: -(s * a - (g * a * a) / 2) * 0.4 }; a -= d; s *= id === "bounce" ? v.elastic / 100 : 0.5; }
      return { y: 0 };
    }
    case "lookAt": return { r: Math.atan2(Math.sin(t * 2), Math.cos(t * 2)) * 57.3 + v.offset };
    case "spin": return { r: t * v.speed };
    case "pulse": return { s: 1 + (v.amp / 100) * Math.sin(t * v.freq * 2 * Math.PI) };
    case "beatPulse": { const t2 = t % 0.5; return { s: 1 + (v.amp / 100) * Math.exp(-v.decay * t2) }; }
    case "throw": { const k = Math.max(v.drag, 0.001), q = ((1 - Math.exp(-k * t)) / k) * 0.12; return { x: -80 + v.vx * q, y: v.vy * q }; }
    case "breathe": return { s: 1 + (v.amp / 100) * 2 * (0.5 - 0.5 * Math.cos((t * 2 * Math.PI) / Math.max(v.period, 0.01))) };
    case "sine": return { y: v.amp * k * Math.sin(t * v.freq * 2 * Math.PI) };
    case "float": return { y: v.amp * k * Math.sin(t * v.freq * 2 * Math.PI) };
    case "flicker": return { o: Math.sin(t * 37) * Math.sin(t * 11) > v.amount / 100 - 0.6 ? 1 : 0.2 };
    case "autoFade": return { o: Math.min(1, t / v.dur, Math.max(0, (3 - t) / v.dur)) };
    default: return {};
  }
}
const LENGTH: Record<string, number> = { throw: 2.5, breathe: 6, inertia: 2.4, bounce: 2.6, elastic: 2.4, autoFade: 3, loopPingpong: 4, loopCycle: 3 };

function fromExpr(e: ExprPreset): Preset {
  const controls: Ctl[] = [
    ...(e.forceDefault || e.lookAtLast ? [] : [PROP]),
    ...e.params.map((x) => slider(x.key, x.label, x.value, x.min, x.max, x.step)),
    ...(e.linearIn ? [{ type: "toggle", key: "linearIn", label: "Сделать вход в ключи линейным", value: true } as Ctl] : []),
  ];
  const args = (v: Values) => {
    const b = buildExpression(e, v, v.linearIn ?? true);
    if (v.prop && v.prop !== "auto") return { ...b, defaultPath: PATH[v.prop], forceDefault: true };
    return b;
  };
  return {
    id: e.id, title: e.title, subtitle: SUB[e.id] ?? e.hint, group: GROUP[e.id] ?? "Движение", controls,
    code: (v) => args(v).code,
    preview: (v) => ({ kind: "layers", count: 1, label: "", length: LENGTH[e.id] ?? 3, pose: (_i, t) => sim(e.id, v, t) }),
    hint: (v) => (v.prop && v.prop !== "auto" ? `На свойство: ${PROP.type === "seg" ? PROP.options.find((o) => o.value === v.prop)?.label : ""}` : e.hint),
    build: (v) => act(expression, { preset: e.id, params: v, linearIn: v.linearIn ?? true, ...(v.prop && v.prop !== "auto" ? { prop: v.prop } : {}) } as any),
  };
}

export const EXPRESSION_PRESETS: Preset[] = [
  ...EXPR_PRESETS.map(fromExpr),
  {
    id: "clear", title: "Убрать выражения", subtitle: "С выделенных свойств", group: "Сервис", controls: [],
    hint: () => "Без выделенных свойств — со всей трансформации слоя", applyLabel: "Убрать",
    build: () => act(clearExpression, {}),
  },
];

export { customExpression };
