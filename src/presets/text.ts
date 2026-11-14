import { runTool } from "../lib/actions";
import { EASE_EXPR, easeOut, type EaseKind } from "../lib/easing";
import { plural } from "../lib/format";
import { setPrefs, getPrefs, setStatus } from "../lib/store";
import { textFx, type TextFxArgs } from "../tools/ae/textfx";
import { textCopyStyle, textPasteStyle } from "../tools/ae/text";
import { act, AT_SEG, DIR_SEG, slider, type Ctl, type Pose, type Preset, type Values } from "./types";

/*
 * Текст: аниматор задаёт «спрятанное» состояние, Expression Selector для каждой единицы считает,
 * насколько она спрятана: 100 → 0 по своей кривой, со сдвигом по времени (шаг × номер).
 */
type Hidden = TextFxArgs["props"];

const UNIT: Ctl = { type: "seg", key: "unit", label: "По", value: "chars", options: [{ value: "chars", label: "буквам" }, { value: "words", label: "словам" }, { value: "lines", label: "строкам" }] };
const EASE: Ctl = { type: "seg", key: "ease", label: "Кривая", value: "smooth", options: [{ value: "smooth", label: "Плавно" }, { value: "expo", label: "Резко" }, { value: "back", label: "Пружина" }, { value: "elastic", label: "Резинка" }] };
const ORDER: Ctl = { type: "seg", key: "order", label: "Порядок", value: "forward", options: [{ value: "forward", label: "С начала →" }, { value: "reverse", label: "С конца ←" }, { value: "center", label: "От центра" }, { value: "random", label: "Вразнобой" }] };
const TOTAL = slider("total", "Длительность", 1, 0.1, 6, 0.05, "с");
const SOFT = slider("soft", "Плавность", 40, 0, 100, 1, "%");
const ORDER_EXPR: Record<string, string> = {
  forward: "",
  reverse: "i = n - 1 - i;",
  center: "i = Math.abs(i - (n - 1) / 2);",
  random: "seedRandom(textIndex, true); i = Math.floor(random(n));",
};

/*
 * Выражение для Amount селектора. Время — от маркера слоя: начало маркера = старт, его длина = вся анимация.
 * Плавность F — доля этого времени, за которую проявляется одна единица; остальное — сдвиг между единицами.
 * Маркер удалён — текст просто виден. "@@" — номер анимации на слое (подставит AE-часть).
 */
const MK = "function MK(n) { var m = thisLayer.marker; for (var k = m.numKeys; k >= 1; k--) { if (m.key(k).comment == n) return m.key(k); } return null; }";

function amountCode(v: Values, markerName: string, style: "tr" | "bar" = "bar") {
  const ease = EASE_EXPR[(v.ease as EaseKind) ?? "smooth"];
  return `// AE Assistant — текст по ${v.unit === "words" ? "словам" : v.unit === "lines" ? "строкам" : "буквам"}, время = маркер «${markerName}»
${MK}
${style === "tr"
    ? (v.mode === "out"
      ? `var mk = MK("TR Out");\nif (!mk) { [0, 0, 0]; } else {\n  var mi = MK("TR In"), S0 = mk.time;\n  if (mi && mi.time > S0) S0 = mi.time;\n  var T = Math.max(outPoint - S0, 0.001);`
      : `var mk = MK("TR In");\nif (!mk) { [0, 0, 0]; } else {\n  var mo = MK("TR Out"), E = mk.time;\n  if (mo && mo.time < E) E = mo.time;\n  var S0 = inPoint, T = Math.max(E - inPoint, 0.001);`)
    : `var mk = MK(${JSON.stringify(markerName)});\nif (!mk) { [0, 0, 0]; } else {\n  var S0 = mk.time, T = Math.max(mk.duration, 0.001);`}
  var F = Math.min(1, Math.max(0, effect("Текст@@ · плавность")(1) / 100));
  var n = textTotal, i = textIndex - 1;
  ${ORDER_EXPR[v.order] ?? ""}
  var D = Math.max(T * F, 0.001), G = n > 1 ? (T - T * F) / (n - 1) : 0;
  var p = Math.min(1, Math.max(0, (time - S0 - i * G) / D));
  ${v.mode === "out" ? "p = 1 - p;" : ""}
  var a = 100 * (1 - (${ease}));
  [a, a, a];
}`;
}

/** Время одной единицы в превью — те же формулы, что в выражении. */
function unitTiming(v: Values, n: number) {
  const T = Math.max(v.total, 0.001), F = Math.min(1, Math.max(0, v.soft / 100));
  return { D: Math.max(T * F, 0.001), G: n > 1 ? (T - T * F) / (n - 1) : 0, T };
}

function previewIndex(order: string, i: number, n: number) {
  if (order === "reverse") return n - 1 - i;
  if (order === "center") return Math.abs(i - (n - 1) / 2);
  if (order === "random") return (i * 7 + 3) % n;
  return i;
}

// стиль маркера для текста: «TR In / TR Out» или полоса (режим «Ключи» для текста тоже маркер — анимация на выражении)
const textStyle = (): "tr" | "bar" => (getPrefs().animControl === "marker" ? "bar" : "tr");

const markerFor = (title: string, mode: string, tag: string) => `${mode === "out" ? "Исчезание" : "Появление"} · ${title} ${tag}`;

function make(id: string, title: string, subtitle: string, extra: Ctl[], hidden: (v: Values) => Hidden, init: Partial<Record<string, any>> = {}): Preset {
  const all = [DIR_SEG, AT_SEG, UNIT, ORDER, EASE, TOTAL, SOFT, ...extra].map((c) => (c.key in init ? { ...c, value: init[c.key] } : c)) as Ctl[];
  const noAt = all.filter((c) => c.key !== "at");
  return {
    id, title, subtitle, group: "Появление и исчезание",
    // в стиле TR In / TR Out время задают края слоя — «Где» не нужно
    get controls() { return textStyle() === "tr" ? noAt : all; },
    code: (v) => amountCode(v, markerFor(title, v.mode, "@@"), textStyle()),
    preview: (v) => {
      const h = hidden(v);
      const text = v.unit === "lines" ? "Анимация\nтекста" : "Анимация текста";
      return {
        kind: "text", text, unit: v.unit,
        length: v.total + 0.1,
        pose: (i, n, t): Pose => {
          const k = previewIndex(v.order, i, n), { D, G } = unitTiming(v, n);
          let p = Math.min(1, Math.max(0, (t - k * G) / D));
          if (v.mode === "out") p = 1 - p;
          const a = 1 - easeOut(v.ease, p); // доля «спрятанности», может уходить за 0 (перелёт)
          return {
            o: 1 - a * (1 - (h.opacity ?? 100) / 100),
            x: (h.position?.[0] ?? 0) * a * 0.3 + (h.tracking ?? 0) * a * (i - (n - 1) / 2) * 0.08,
            y: (h.position?.[1] ?? 0) * a * 0.3,
            s: 1 + ((h.scale ?? 100) / 100 - 1) * a,
            r: (h.rotation ?? 0) * a,
            b: Math.max(0, (h.blur ?? 0) * a * 0.25),
            sk: (h.skew ?? 0) * a,
          };
        },
      };
    },
    hint: (v, sel) => sel.text ? `${sel.text} ${plural(sel.text, "текстовый слой", "текстовых слоя", "текстовых слоёв")} · ${textStyle() === "tr" ? (v.mode === "out" ? "от «TR Out» до конца слоя" : "от начала слоя до «TR In»") : "длительность — маркер-полоса на слое"}` : "Выделите текстовый слой",
    build: (v) => {
      const name = markerFor(title, v.mode, "@@");
      const style = textStyle();
      return act(textFx, {
        title, unit: v.unit, props: hidden(v), code: amountCode(v, name, style), startSlider: "",
        controls: [{ name: "Текст@@ · плавность", value: v.soft }],
        marker: { name, duration: v.total, style }, at: v.at, mode: v.mode,
      });
    },
  };
}

const dist = (v = 40) => slider("distance", "Расстояние", v, 0, 400, 1, "px");
const blur = (v = 12) => slider("blur", "Размытие", v, 0, 100, 1, "px");
const scale = (v = 60) => slider("scale", "Масштаб в начале", v, 0, 400, 1, "%");
const rot = (v = 90) => slider("rotation", "Поворот", v, -360, 360, 5, "°");

export const TEXT_PRESETS: Preset[] = [
  make("hero", "Главный титр", "Масштаб, размытие и проявление", [blur(12), scale(60)], (v) => ({ opacity: 0, scale: v.scale, blur: v.blur }), { total: 1.2, soft: 60 }),
  make("rise", "Подъём по словам", "Снизу с проявлением", [dist(40)], (v) => ({ opacity: 0, position: [0, v.distance] }), { unit: "words", total: 1, soft: 60 }),
  make("slide", "Сдвиг", "Буквы приезжают сбоку", [dist(60)], (v) => ({ opacity: 0, position: [-v.distance, 0] })),
  make("pop", "Пружинный масштаб", "Буквы выпрыгивают", [scale(0)], (v) => ({ opacity: 0, scale: v.scale }), { ease: "back", total: 1, soft: 45 }),
  make("letters", "Буквы с подъёмом", "Сдвиг и масштаб по буквам", [dist(30), scale(50)], (v) => ({ opacity: 0, position: [0, v.distance], scale: v.scale }), { ease: "back" }),
  make("wordBounce", "Слова пружиной", "Масштаб по словам с резинкой", [scale(0)], (v) => ({ opacity: 0, scale: v.scale }), { unit: "words", ease: "elastic", total: 1.4, soft: 65 }),
  make("blurIn", "Из размытия", "Проявление из расфокуса", [blur(20)], (v) => ({ opacity: 0, blur: v.blur }), { total: 1.2, soft: 55 }),
  make("burst", "Взрыв", "Крупно и размыто, вразброс", [scale(300), blur(30)], (v) => ({ opacity: 0, scale: v.scale, blur: v.blur }), { ease: "expo", order: "random", total: 1, soft: 60 }),
  make("typewriter", "Печатная машинка", "Буквы по одной, без плавности", [], () => ({ opacity: 0 }), { total: 1.5, soft: 0 }),
  make("drop", "Падение букв", "Сверху с отскоком", [dist(60)], (v) => ({ opacity: 0, position: [0, -v.distance] }), { ease: "elastic", total: 1.3, soft: 55 }),
  make("rotate", "Поворот букв", "Буквы доворачиваются на место", [rot(90)], (v) => ({ opacity: 0, rotation: v.rotation }), { ease: "back" }),
  make("skew", "Наклонный сдвиг", "Сдвиг с наклоном", [dist(60), slider("skew", "Наклон", 30, -70, 70, 1, "°")], (v) => ({ opacity: 0, position: [-v.distance, 0], skew: v.skew })),
  make("lines", "Строки снизу", "Строки по очереди", [dist(50)], (v) => ({ opacity: 0, position: [0, v.distance] }), { unit: "lines", total: 1.2, soft: 70 }),
  make("tracking", "Разлёт трекинга", "Буквы съезжаются к центру", [slider("tracking", "Трекинг", 40, 0, 300, 1), blur(8)], (v) => ({ opacity: 0, tracking: v.tracking, blur: v.blur }), { order: "center", total: 1, soft: 60 }),
];

/*
 * Постоянное движение (вигл по буквам). Аниматор задаёт размах, Expression Selector для каждой
 * единицы даёт плавный шум -100..100 по осям: буквы двигаются всё время, без маркера и ключей.
 * Ползунки на слое: частота, сила (можно анимировать ключами), кадров в секунду (0 — плавно, 8–12 — «рисованное кипение»).
 * shape: xyz — свой шум на каждую ось; uniform — один на все (масштаб); positive — только 0..100 (мерцание прозрачности).
 */
type WiggleShape = "xyz" | "uniform" | "positive";

function wiggleCode(shape: WiggleShape) {
  const out = shape === "uniform" ? "[x, x, x]" : shape === "positive" ? "[(x + 100) / 2, (x + 100) / 2, (x + 100) / 2]" : "[x, y, z]";
  return `// AE Assistant — вигл текста: каждая единица движется по своему шуму
var f = effect("Вигл@@ · частота")(1), s = effect("Вигл@@ · сила")(1) / 100, fps = effect("Вигл@@ · кадров в секунду")(1);
if (fps > 0) posterizeTime(fps);
var i = textIndex, t = time * f;
function N(k) { return Math.max(-1, Math.min(1, 1.6 * noise([i * 7.31 + k, t]))); }
var x = 100 * s * N(0.17), y = 100 * s * N(41.3), z = 100 * s * N(83.9);
${out};`;
}

/** Плавный псевдошум для превью (в AE — noise()). */
const pnoise = (seed: number, t: number) => (Math.sin(t * 2.1 + seed * 1.7) + Math.sin(t * 3.3 + seed * 4.1) * 0.6 + Math.sin(t * 5.7 + seed * 2.9) * 0.3) / 1.9;

function wiggle(id: string, title: string, subtitle: string, extra: Ctl[], props: (v: Values) => Hidden, shape: WiggleShape, init: { freq?: number; strength?: number; fps?: number; unit?: string } = {}): Preset {
  const controls: Ctl[] = [
    { ...UNIT, value: init.unit ?? "chars" } as Ctl,
    slider("freq", "Частота", init.freq ?? 2, 0.1, 20, 0.1, "раз/с"),
    slider("strength", "Сила", init.strength ?? 100, 0, 100, 1, "%"),
    slider("fps", "Кадров в секунду", init.fps ?? 0, 0, 30, 1),
    ...extra,
  ];
  return {
    id, title, subtitle, group: "Постоянное движение", controls,
    code: () => wiggleCode(shape),
    preview: (v) => {
      const h = props(v);
      return {
        kind: "text", text: v.unit === "lines" ? "Живой\nтекст" : "Живой текст", unit: v.unit, length: 4,
        pose: (i, _n, t0): Pose => {
          const t = (v.fps > 0 ? Math.floor(t0 * v.fps) / v.fps : t0) * v.freq, k = v.strength / 100;
          const ax = pnoise(i * 7.3, t) * k, ay = pnoise(i * 7.3 + 41, t) * k;
          const a = shape === "positive" ? (ax + 1) / 2 : ax;
          return {
            o: 1 - a * (1 - (h.opacity ?? 100) / 100),
            x: (h.position?.[0] ?? 0) * a * 0.5,
            y: (h.position?.[1] ?? 0) * (shape === "uniform" ? ax : ay) * 0.5,
            s: 1 + ((h.scale ?? 100) / 100 - 1) * a,
            r: (h.rotation ?? 0) * a,
            b: Math.max(0, (h.blur ?? 0) * a * 0.25),
            sk: (h.skew ?? 0) * a,
          };
        },
      };
    },
    hint: (_v, sel) => sel.text
      ? `${sel.text} ${plural(sel.text, "текстовый слой", "текстовых слоя", "текстовых слоёв")} · движется всё время. Частота и сила — ползунки на слое, силу можно анимировать ключами`
      : "Выделите текстовый слой",
    build: (v) => act(textFx, {
      title, unit: v.unit, props: props(v), code: wiggleCode(shape), startSlider: "",
      controls: [{ name: "Вигл@@ · частота", value: v.freq }, { name: "Вигл@@ · сила", value: v.strength }, { name: "Вигл@@ · кадров в секунду", value: v.fps }],
    }),
  };
}

const amp = (v = 10) => slider("amp", "Размах", v, 0, 200, 1, "px");
const tilt = (v = 10) => slider("tilt", "Наклон", v, 0, 90, 1, "°");

export const WIGGLE_PRESETS: Preset[] = [
  wiggle("wiggleMove", "Вигл букв", "Каждая буква плавает сама по себе", [amp(10)], (v) => ({ position: [v.amp, v.amp] }), "xyz"),
  wiggle("wiggleAlive", "Живые буквы", "Плавают и покачиваются", [amp(6), tilt(8)], (v) => ({ position: [v.amp, v.amp], rotation: v.tilt }), "xyz", { freq: 1.5 }),
  wiggle("wiggleRock", "Покачивание", "Буквы качаются вокруг своей оси", [tilt(12)], (v) => ({ rotation: v.tilt }), "xyz", { freq: 1.2 }),
  wiggle("wigglePulse", "Пульсация", "Буквы дышат масштабом", [slider("pulse", "Масштаб", 25, 0, 150, 1, "%")], (v) => ({ scale: 100 + v.pulse }), "uniform", { freq: 1.5 }),
  wiggle("wiggleBoil", "Кипение", "Рисованное дрожание, как в мультфильме", [amp(3), tilt(4)], (v) => ({ position: [v.amp, v.amp], rotation: v.tilt }), "xyz", { freq: 6, fps: 8 }),
  wiggle("wiggleJitter", "Нервная тряска", "Мелко и часто", [amp(4)], (v) => ({ position: [v.amp, v.amp] }), "xyz", { freq: 14 }),
  wiggle("wiggleFloat", "Плавающие слова", "Медленно, по словам", [amp(14)], (v) => ({ position: [v.amp * 0.4, v.amp] }), "xyz", { unit: "words", freq: 0.5 }),
  wiggle("wiggleFlicker", "Мерцание", "Буквы то гаснут, то загораются", [slider("dim", "Гаснут до", 20, 0, 100, 1, "%")], (v) => ({ opacity: v.dim }), "positive", { freq: 4 }),
  wiggle("wiggleGlitch", "Глитч", "Рывками со сдвигом и наклоном", [amp(25), slider("skew", "Наклон", 20, 0, 70, 1, "°")], (v) => ({ position: [v.amp, v.amp * 0.2], skew: v.skew }), "xyz", { freq: 3, fps: 10, strength: 80 }),
];

const styleSummary = () => {
  const s = getPrefs().textStyle;
  if (!s) return "Стиль ещё не скопирован";
  return [s.font, s.fontSize ? `${Math.round(Number(s.fontSize))} px` : "", s.tracking ? `трекинг ${s.tracking}` : ""].filter(Boolean).join(" · ");
};

export const TEXT_STYLE_PRESETS: Preset[] = [
  {
    id: "copyStyle", title: "Копировать стиль", subtitle: "Шрифт, размер, цвет, обводка, трекинг", group: "Стиль текста", controls: [], applyLabel: "Копировать",
    hint: () => styleSummary(),
    run: async () => {
      const r = await runTool(textCopyStyle, {});
      if (r?.ok && r.data?.ok) setPrefs({ textStyle: r.data.style as Record<string, unknown>, textStyleFrom: String(r.data.from) });
      return r;
    },
  },
  {
    id: "pasteStyle", title: "Вставить стиль", subtitle: "На выделенные текстовые слои", group: "Стиль текста", controls: [], applyLabel: "Вставить",
    hint: () => styleSummary(),
    run: async () => {
      const s = getPrefs().textStyle;
      if (!s) { setStatus({ kind: "error", text: "Сначала скопируйте стиль с текстового слоя." }); return null; }
      return runTool(textPasteStyle, { style: s });
    },
  },
];
