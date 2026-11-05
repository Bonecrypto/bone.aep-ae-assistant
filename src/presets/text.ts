import { runTool } from "../lib/actions";
import { EASE_EXPR, easeOut, type EaseKind } from "../lib/easing";
import { plural } from "../lib/format";
import { setPrefs, getPrefs, setStatus } from "../lib/store";
import { textFx, type TextFxArgs } from "../tools/ae/textfx";
import { textCopyStyle, textPasteStyle } from "../tools/ae/text";
import { act, DIR_SEG, slider, type Ctl, type Pose, type Preset, type Values } from "./types";

/*
 * Текст: аниматор задаёт «спрятанное» состояние, Expression Selector для каждой единицы считает,
 * насколько она спрятана: 100 → 0 по своей кривой, со сдвигом по времени (шаг × номер).
 */
type Hidden = TextFxArgs["props"];

const UNIT: Ctl = { type: "seg", key: "unit", label: "По", value: "chars", options: [{ value: "chars", label: "буквам" }, { value: "words", label: "словам" }, { value: "lines", label: "строкам" }] };
const EASE: Ctl = { type: "seg", key: "ease", label: "Кривая", value: "smooth", options: [{ value: "smooth", label: "Плавно" }, { value: "expo", label: "Резко" }, { value: "back", label: "Пружина" }, { value: "elastic", label: "Резинка" }] };
const ORDER: Ctl = { type: "seg", key: "order", label: "Порядок", value: "forward", options: [{ value: "forward", label: "→" }, { value: "reverse", label: "←" }, { value: "center", label: "↔" }, { value: "random", label: "?" }] };
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

function amountCode(v: Values, markerName: string) {
  const ease = EASE_EXPR[(v.ease as EaseKind) ?? "smooth"];
  return `// AE Assistant — текст по ${v.unit === "words" ? "словам" : v.unit === "lines" ? "строкам" : "буквам"}, время = маркер «${markerName}»
${MK}
var mk = MK(${JSON.stringify(markerName)});
if (!mk) { [0, 0, 0]; } else {
  var T = Math.max(mk.duration, 0.001), F = Math.min(1, Math.max(0, effect("Текст@@ · плавность")(1) / 100));
  var n = textTotal, i = textIndex - 1;
  ${ORDER_EXPR[v.order] ?? ""}
  var D = Math.max(T * F, 0.001), G = n > 1 ? (T - T * F) / (n - 1) : 0;
  var p = Math.min(1, Math.max(0, (time - mk.time - i * G) / D));
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

const markerFor = (title: string, mode: string, tag: string) => `${mode === "out" ? "Исчезание" : "Появление"} · ${title} ${tag}`;

function make(id: string, title: string, subtitle: string, extra: Ctl[], hidden: (v: Values) => Hidden, init: Partial<Record<string, any>> = {}): Preset {
  const controls = [DIR_SEG, UNIT, EASE, TOTAL, SOFT, ...extra, ORDER].map((c) => (c.key in init ? { ...c, value: init[c.key] } : c)) as Ctl[];
  return {
    id, title, subtitle, group: "Появление и исчезание", controls,
    code: (v) => amountCode(v, markerFor(title, v.mode, "@@")),
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
    hint: (_v, sel) => sel.text ? `${sel.text} ${plural(sel.text, "текстовый слой", "текстовых слоя", "текстовых слоёв")} · длительность — маркер на слое, тяните его конец` : "Выделите текстовый слой",
    build: (v) => {
      const name = markerFor(title, v.mode, "@@");
      return act(textFx, {
        title, unit: v.unit, props: hidden(v), code: amountCode(v, name), startSlider: "",
        controls: [{ name: "Текст@@ · плавность", value: v.soft }],
        marker: { name, duration: v.total },
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
