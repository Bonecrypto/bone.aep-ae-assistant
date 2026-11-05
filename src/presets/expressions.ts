// Пресеты выражений. Ползунки добавляются на слой эффектами — их можно крутить потом.
// Для массивов используем add/sub/mul — работают и в JavaScript-, и в Legacy-движке выражений.

export type ExprParam = { key: string; label: string; value: number; min: number; max: number; step: number };
export type ExprPreset = {
  id: string;
  title: string;
  hint: string;
  params: ExprParam[];
  defaultPath?: string[];
  forceDefault?: boolean;
  lookAtLast?: boolean;
  /** Имена эффектов-ползунков на слое (видны пользователю). */
  controlName: (p: ExprParam) => string;
  code: (name: (key: string) => string) => string;
  layerControl?: string;
};

const POS = ["ADBE Transform Group", "ADBE Position"];
const ROT = ["ADBE Transform Group", "ADBE Rotate Z"];
const SCALE = ["ADBE Transform Group", "ADBE Scale"];
const ctl = (prefix: string) => (p: ExprParam) => `${prefix} · ${p.label.toLowerCase()}`;
const fx = (name: string) => `effect(${JSON.stringify(name)})(1)`;

// Безопасная векторная математика для 1D и nD свойств.
const VEC = "function A(a,b){return (a instanceof Array)?add(a,b):a+b}function S(a,b){return (a instanceof Array)?sub(a,b):a-b}function M(a,k){return (a instanceof Array)?mul(a,k):a*k}";

const afterKey = (amp: string, freq: string, decay: string, bounce: boolean) => `${VEC}
var amp = ${amp} / 100, freq = ${freq}, decay = ${decay};
var n = 0;
if (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) n--; }
if (n > 0 && time > key(n).time) {
  var t = time - key(n).time;
  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);
  var w = ${bounce ? "Math.abs(Math.sin(freq * t * 2 * Math.PI))" : "Math.sin(freq * t * 2 * Math.PI)"};
  ${bounce ? "S" : "A"}(value, M(v, amp * w / Math.exp(decay * t)));
} else { value; }`;

export const EXPR_PRESETS: ExprPreset[] = [
  {
    id: "wiggle", title: "Wiggle", hint: "Случайное дрожание. Выделите свойство или будет Position",
    params: [{ key: "freq", label: "Частота", value: 2, min: 0, max: 20, step: 0.5 }, { key: "amp", label: "Сила", value: 30, min: 0, max: 500, step: 1 }],
    defaultPath: POS, controlName: ctl("Wiggle"),
    code: (n) => `wiggle(${fx(n("freq"))}, ${fx(n("amp"))})`,
  },
  {
    id: "shake", title: "Тряска", hint: "Плавное «ручное» покачивание позиции",
    params: [{ key: "freq", label: "Частота", value: 0.8, min: 0, max: 5, step: 0.1 }, { key: "amp", label: "Сила", value: 12, min: 0, max: 200, step: 1 }],
    defaultPath: POS, controlName: ctl("Тряска"),
    code: (n) => `wiggle(${fx(n("freq"))}, ${fx(n("amp"))}, 2, 0.5)`,
  },
  {
    id: "loopCycle", title: "Повтор", hint: "Повторяет ключи по кругу (выделите свойство с ключами)",
    params: [], controlName: ctl("Повтор"), code: () => 'loopOut("cycle")',
  },
  {
    id: "loopPingpong", title: "Пинг-понг", hint: "Проигрывает ключи вперёд и назад",
    params: [], controlName: ctl("Повтор"), code: () => 'loopOut("pingpong")',
  },
  {
    id: "loopOffset", title: "Нарастание", hint: "Каждый цикл продолжает с конца предыдущего",
    params: [], controlName: ctl("Повтор"), code: () => 'loopOut("offset")',
  },
  {
    id: "inertia", title: "Инерция", hint: "Покачивание после каждого ключа",
    params: [
      { key: "amp", label: "Сила", value: 5, min: 0, max: 50, step: 0.5 },
      { key: "freq", label: "Частота", value: 2.5, min: 0.1, max: 10, step: 0.1 },
      { key: "decay", label: "Затухание", value: 6, min: 0.1, max: 20, step: 0.1 },
    ],
    defaultPath: POS, controlName: ctl("Инерция"),
    code: (n) => afterKey(fx(n("amp")), fx(n("freq")), fx(n("decay")), false),
  },
  {
    id: "bounce", title: "Отскок", hint: "Отскакивает от конечного значения, как мяч",
    params: [
      { key: "amp", label: "Сила", value: 6, min: 0, max: 50, step: 0.5 },
      { key: "freq", label: "Частота", value: 2, min: 0.1, max: 10, step: 0.1 },
      { key: "decay", label: "Затухание", value: 5, min: 0.1, max: 20, step: 0.1 },
    ],
    defaultPath: POS, controlName: ctl("Отскок"),
    code: (n) => afterKey(fx(n("amp")), fx(n("freq")), fx(n("decay")), true),
  },
  {
    id: "lookAt", title: "Смотреть на", hint: "Выделите слои, последним — цель. Меняется поворот",
    params: [{ key: "offset", label: "Доворот", value: 0, min: -180, max: 180, step: 1 }],
    defaultPath: ROT, forceDefault: true, lookAtLast: true, controlName: ctl("Смотреть"), layerControl: "Смотреть · цель",
    code: (n) => `try {
  var L = effect(${JSON.stringify("Смотреть · цель")})(1);
  var d = sub(L.toComp(L.anchorPoint), toComp(anchorPoint));
  radiansToDegrees(Math.atan2(d[1], d[0])) + ${fx(n("offset"))};
} catch (e) { value; }`,
  },
  {
    id: "spin", title: "Вращение", hint: "Постоянное вращение, градусов в секунду",
    params: [{ key: "speed", label: "Скорость", value: 90, min: -1440, max: 1440, step: 5 }],
    defaultPath: ROT, forceDefault: true, controlName: ctl("Вращение"),
    code: (n) => `value + time * ${fx(n("speed"))}`,
  },
  {
    id: "pulse", title: "Пульс", hint: "Ритмичное увеличение и уменьшение",
    params: [{ key: "amp", label: "Сила", value: 8, min: 0, max: 100, step: 1 }, { key: "freq", label: "Частота", value: 1.5, min: 0.1, max: 10, step: 0.1 }],
    defaultPath: SCALE, forceDefault: true, controlName: ctl("Пульс"),
    code: (n) => `${VEC}\nM(value, 1 + ${fx(n("amp"))} / 100 * Math.sin(time * ${fx(n("freq"))} * 2 * Math.PI))`,
  },
];

/** Аргументы для host: код + описание ползунков с текущими значениями. */
export function buildExpression(p: ExprPreset, values: Record<string, number>) {
  const nameOf = (key: string) => p.controlName(p.params.find((x) => x.key === key)!);
  const controls: { type: string; name: string; value?: number }[] = p.params.map((x) => ({ type: "slider", name: p.controlName(x), value: values[x.key] ?? x.value }));
  if (p.layerControl) controls.unshift({ type: "layer", name: p.layerControl });
  return {
    code: p.code(nameOf),
    defaultPath: p.defaultPath,
    forceDefault: !!p.forceDefault,
    lookAtLast: !!p.lookAtLast,
    controls,
  };
}
