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
  /** Работает от скорости прилёта в ключ — предлагать сделать вход в ключи линейным. */
  linearIn?: boolean;
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

/*
 * Выражения «после ключа». Срабатывают только на ключах, где движение останавливается
 * (последний ключ или после него стоп), и берут скорость, с которой слой прилетел в ключ.
 * Если вход в ключ с Easy Ease — скорость 0 и эффекта нет, поэтому панель умеет сделать вход линейным.
 */
const onStop = (body: string) => `${VEC}
function L(a){return (a instanceof Array)?length(a):Math.abs(a)}
var res = value, n = 0;
if (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) n--; }
if (n > 0 && time > key(n).time) {
  var f = thisComp.frameDuration / 10;
  var v = velocityAtTime(key(n).time - f);
  var stops = L(velocityAtTime(key(n).time + f)) <= L(v) * 0.01;
  if (stops && L(v) > 0) {
    var t = time - key(n).time;
${body}
  }
}
res;`;

/** Затухающее покачивание вокруг ключа (перелёт и возврат). */
const inertiaBody = (amp: string, freq: string, decay: string) =>
  `    res = A(value, M(v, ${amp} / 100 * Math.sin(${freq} * t * 2 * Math.PI) / Math.exp(${decay} * t)));`;

/** Упругий отскок: всегда назад от ключа, затухает по экспоненте. */
const elasticBody = (amp: string, freq: string, decay: string) =>
  `    res = S(value, M(v, ${amp} / 100 * Math.abs(Math.sin(${freq} * t * 2 * Math.PI)) / Math.exp(${decay} * t)));`;

/** Мяч: настоящие параболы. Каждый отскок теряет скорость на (1 - упругость). */
const ballBody = (elastic: string, gravity: string, count: string) => `    var e = clamp(${elastic} / 100, 0, 0.95), g = Math.max(1, ${gravity}), nMax = Math.round(${count});
    var u = M(v, 1 / L(v)), s = L(v) * e;
    for (var b = 0; b < nMax; b++) {
      var d = 2 * s / g;
      if (t < d) { res = S(value, M(u, s * t - g * t * t / 2)); break; }
      t -= d; s *= e;
    }`;

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
    id: "inertia", title: "Инерция", hint: "Перелёт и затухающее покачивание в ключе остановки",
    params: [
      { key: "amp", label: "Сила", value: 5, min: 0, max: 50, step: 0.5 },
      { key: "freq", label: "Частота", value: 2.5, min: 0.1, max: 10, step: 0.1 },
      { key: "decay", label: "Затухание", value: 6, min: 0.1, max: 20, step: 0.1 },
    ],
    defaultPath: POS, controlName: ctl("Инерция"), linearIn: true,
    code: (n) => onStop(inertiaBody(fx(n("amp")), fx(n("freq")), fx(n("decay")))),
  },
  {
    id: "bounce", title: "Отскок", hint: "Мяч: отскакивает от ключа остановки по параболам",
    params: [
      { key: "elastic", label: "Упругость", value: 55, min: 0, max: 95, step: 1 },
      { key: "gravity", label: "Гравитация", value: 5000, min: 100, max: 50000, step: 100 },
      { key: "count", label: "Отскоков", value: 4, min: 1, max: 20, step: 1 },
    ],
    defaultPath: POS, controlName: ctl("Отскок"), linearIn: true,
    code: (n) => onStop(ballBody(fx(n("elastic")), fx(n("gravity")), fx(n("count")))),
  },
  {
    id: "elastic", title: "Упругий отскок", hint: "Быстрые затухающие отскоки назад от ключа",
    params: [
      { key: "amp", label: "Сила", value: 6, min: 0, max: 50, step: 0.5 },
      { key: "freq", label: "Частота", value: 2, min: 0.1, max: 10, step: 0.1 },
      { key: "decay", label: "Затухание", value: 5, min: 0.1, max: 20, step: 0.1 },
    ],
    defaultPath: POS, controlName: ctl("Упругость"), linearIn: true,
    code: (n) => onStop(elasticBody(fx(n("amp")), fx(n("freq")), fx(n("decay")))),
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
  {
    id: "throw", title: "Бросок", hint: "Слой летит от начала слоя и плавно тормозит",
    params: [{ key: "vx", label: "Скорость X", value: 800, min: -5000, max: 5000, step: 10 }, { key: "vy", label: "Скорость Y", value: -300, min: -5000, max: 5000, step: 10 }, { key: "drag", label: "Торможение", value: 3, min: 0.1, max: 20, step: 0.1 }],
    defaultPath: POS, forceDefault: true, controlName: ctl("Бросок"),
    code: (n) => `var t = Math.max(0, time - inPoint), k = Math.max(${fx(n("drag"))}, 0.001);\nvar s = (1 - Math.exp(-k * t)) / k;\nadd(value, value.length == 3 ? [${fx(n("vx"))} * s, ${fx(n("vy"))} * s, 0] : [${fx(n("vx"))} * s, ${fx(n("vy"))} * s])`,
  },
  {
    id: "breathe", title: "Дыхание", hint: "Мягкое медленное увеличение и возврат",
    params: [{ key: "amp", label: "Сила", value: 4, min: 0, max: 50, step: 0.5 }, { key: "period", label: "Период", value: 3, min: 0.2, max: 20, step: 0.1 }],
    defaultPath: SCALE, forceDefault: true, controlName: ctl("Дыхание"),
    code: (n) => `mul(value, 1 + ${fx(n("amp"))} / 100 * (0.5 - 0.5 * Math.cos(time * 2 * Math.PI / Math.max(${fx(n("period"))}, 0.01))))`,
  },
  {
    id: "sine", title: "Волна", hint: "Плавное колебание по синусоиде (по вертикали)",
    params: [{ key: "amp", label: "Размах", value: 40, min: 0, max: 500, step: 1 }, { key: "freq", label: "Частота", value: 0.5, min: 0.05, max: 10, step: 0.05 }],
    defaultPath: POS, controlName: ctl("Волна"),
    code: (n) => `${VEC}\nvar o = ${fx(n("amp"))} * Math.sin(time * ${fx(n("freq"))} * 2 * Math.PI);\n(value instanceof Array) ? add(value, value.length == 3 ? [0, o, 0] : [0, o]) : value + o`,
  },
  {
    id: "float", title: "Парение", hint: "Мягко плавает вверх-вниз",
    params: [{ key: "amp", label: "Размах", value: 12, min: 0, max: 200, step: 1 }, { key: "freq", label: "Частота", value: 0.4, min: 0.05, max: 5, step: 0.05 }],
    defaultPath: POS, forceDefault: true, controlName: ctl("Парение"),
    code: (n) => `var o = ${fx(n("amp"))} * Math.sin(time * ${fx(n("freq"))} * 2 * Math.PI);\nadd(value, value.length == 3 ? [0, o, 0] : [0, o])`,
  },
  {
    id: "flicker", title: "Мерцание", hint: "Случайное мигание прозрачности",
    params: [{ key: "amount", label: "Сколько видно", value: 70, min: 0, max: 100, step: 1 }, { key: "speed", label: "Скорость", value: 12, min: 1, max: 60, step: 1 }],
    defaultPath: ["ADBE Transform Group", "ADBE Opacity"], forceDefault: true, controlName: ctl("Мерцание"),
    code: (n) => `seedRandom(Math.floor(time * ${fx(n("speed"))}), true);\nrandom(100) < ${fx(n("amount"))} ? value : value * 0.15`,
  },
  {
    id: "autoFade", title: "Авто-проявление", hint: "Проявляется в начале слоя и гаснет в конце — двигайте слой как угодно",
    params: [{ key: "dur", label: "Длительность", value: 0.5, min: 0.05, max: 5, step: 0.05 }],
    defaultPath: ["ADBE Transform Group", "ADBE Opacity"], forceDefault: true, controlName: ctl("Проявление"),
    code: (n) => `var d = Math.max(${fx(n("dur"))}, 0.001);\nvalue * Math.min(linear(time, inPoint, inPoint + d, 0, 1), linear(time, outPoint - d, outPoint, 1, 0))`,
  },
];

/** Аргументы для host: код + описание ползунков с текущими значениями. */
export function buildExpression(p: ExprPreset, values: Record<string, number>, linearIn = true) {
  const nameOf = (key: string) => p.controlName(p.params.find((x) => x.key === key)!);
  const controls: { type: string; name: string; value?: number }[] = p.params.map((x) => ({ type: "slider", name: p.controlName(x), value: values[x.key] ?? x.value }));
  if (p.layerControl) controls.unshift({ type: "layer", name: p.layerControl });
  return {
    code: p.code(nameOf),
    defaultPath: p.defaultPath,
    forceDefault: !!p.forceDefault,
    lookAtLast: !!p.lookAtLast,
    linearIn: !!p.linearIn && linearIn,
    controls,
  };
}
