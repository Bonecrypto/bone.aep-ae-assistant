import { EASE_EXPR, easeOut, type EaseKind } from "../lib/easing";
import { textCounter } from "../tools/ae/mtools";
import { act, slider, type Ctl, type Preset, type Values } from "./types";

// Счётчики: Source Text считается выражением от маркера слоя (длина маркера = длительность счёта).
const MK = "function MK(n) { var m = thisLayer.marker; for (var k = m.numKeys; k >= 1; k--) { if (m.key(k).comment == n) return m.key(k); } return null; }";
const EASE: Ctl = { type: "seg", key: "ease", label: "Кривая", value: "expo", options: [{ value: "linear", label: "Ровно" }, { value: "smooth", label: "Плавно" }, { value: "expo", label: "Резко" }] };

type Fmt = { prefix: string; suffix: string; sep: string; dec: string; timer?: boolean };

const fmtJs = (x: number, d: number, f: Fmt) => {
  if (f.timer) {
    const t = Math.max(0, Math.round(x)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60, z = (n: number) => (n < 10 ? "0" : "") + n;
    return (h > 0 ? `${h}:${z(m)}` : z(m)) + ":" + z(s);
  }
  const parts = Math.abs(x).toFixed(d).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, f.sep);
  return f.prefix + (x < 0 ? "-" : "") + parts.join(f.dec) + f.suffix;
};

function code(name: string, ease: EaseKind, f: Fmt) {
  const q = JSON.stringify;
  const out = f.timer
    ? `var t = Math.max(0, Math.round(x)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
function z(n) { return (n < 10 ? "0" : "") + n; }
(h > 0 ? h + ":" + z(m) : z(m)) + ":" + z(s)`
    : `var parts = Math.abs(x).toFixed(d).split(".");
parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ${q(f.sep)});
${q(f.prefix)} + (x < 0 ? "-" : "") + parts.join(${q(f.dec)}) + ${q(f.suffix)}`;
  return `// AE Assistant — счётчик, время = маркер «${name}»
${MK}
var mk = MK(${q(name)});
var a = effect("Счётчик@@ · от")(1), b = effect("Счётчик@@ · до")(1);
var d = Math.max(0, Math.min(6, Math.round(effect("Счётчик@@ · знаков")(1))));
var p = mk ? Math.min(1, Math.max(0, (time - mk.time) / Math.max(mk.duration, 0.001))) : 1;
var x = a + (b - a) * ${EASE_EXPR[ease]};
${out}`;
}

const CURRENCY: Ctl = { type: "seg", key: "cur", label: "Валюта", value: "rub", options: [{ value: "rub", label: "₽" }, { value: "usd", label: "$" }, { value: "eur", label: "€" }] };
const fmtFor = (kind: string, v: Values): Fmt => {
  const sep = v.sep === false ? "" : "\u00a0";
  if (kind === "percent") return { prefix: "", suffix: "%", sep, dec: "," };
  if (kind === "money") return v.cur === "usd" ? { prefix: "$", suffix: "", sep: v.sep === false ? "" : ",", dec: "." } : { prefix: "", suffix: v.cur === "eur" ? "\u00a0€" : "\u00a0₽", sep, dec: "," };
  if (kind === "timer") return { prefix: "", suffix: "", sep: "", dec: "", timer: true };
  return { prefix: "", suffix: "", sep, dec: "," };
};

function make(id: string, title: string, subtitle: string, kind: string, from: number, to: number, decimals: number, duration: number, extra: Ctl[] = []): Preset {
  const controls: Ctl[] = [
    slider("from", "От", from, -1e6, 1e7, 1), slider("to", "До", to, -1e6, 1e7, 1),
    ...(kind === "timer" ? [] : [slider("decimals", "Знаков после запятой", decimals, 0, 4, 1)]),
    slider("duration", "Длительность", duration, 0.1, 30, 0.1, "с"), EASE, ...extra,
    ...(kind === "timer" ? [] : [{ type: "toggle", key: "sep", label: "Разделять тысячи", value: true } as Ctl]),
  ];
  return {
    id, title, subtitle, group: "Счётчики", controls,
    preview: (v) => ({ kind: "label", length: v.duration, text: (t: number) => fmtJs(v.from + (v.to - v.from) * easeOut(v.ease, t / v.duration), v.decimals ?? 0, fmtFor(kind, v)) }),
    hint: () => "Текстовый слой в центре кадра. Длительность — маркер на слое, тяните его конец; числа — ползунки в эффектах",
    applyLabel: "Создать",
    build: (v) => {
      const name = `${title} @@`;
      return act(textCounter, {
        title, code: code(name, v.ease, fmtFor(kind, v)), marker: { name, duration: v.duration },
        controls: [{ name: "Счётчик@@ · от", value: v.from }, { name: "Счётчик@@ · до", value: v.to }, { name: "Счётчик@@ · знаков", value: v.decimals ?? 0 }],
      });
    },
  };
}

export const COUNTERS: Preset[] = [
  make("count", "Число", "Счёт от и до", "number", 0, 1000, 0, 2),
  make("percent", "Проценты", "0 → 100 %", "percent", 0, 100, 0, 1.5),
  make("money", "Деньги", "Сумма с валютой", "money", 0, 250000, 0, 2, [CURRENCY]),
  make("timer", "Таймер", "Обратный отсчёт мм:сс", "timer", 60, 0, 0, 60),
];

export { fmtJs };
