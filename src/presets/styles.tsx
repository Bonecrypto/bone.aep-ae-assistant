import { hexToRgb, layersWord } from "../lib/format";
import { style, type StyleArgs } from "../tools/ae/style";
import { act, slider, type Preset, type Values } from "./types";

// Стили: встроенные эффекты AE с подобранными параметрами (номера параметров не зависят от языка AE).
type Make = (v: Values) => Omit<StyleArgs, "title">;

const card = (css: React.CSSProperties, label: string) => ({ kind: "node" as const, node: <div className="style-stage"><div className="style-card" style={css}>{label}</div></div> });

function make(id: string, title: string, subtitle: string, controls: Preset["controls"], args: Make, css: (v: Values) => React.CSSProperties): Preset {
  return {
    id, title, subtitle, group: "Стили", controls,
    preview: (v) => card(css(v), title),
    hint: (_v, sel) => sel.selected ? `Эффект на ${layersWord(sel.selected)}` : "Выделите слои",
    build: (v) => act(style, { title, ...args(v) }),
  };
}

const rgba = (hex: string) => [...hexToRgb(hex), 1];

export const STYLES: Preset[] = [
  make("shadow", "Мягкая тень", "Тень под объектом",
    [slider("distance", "Расстояние", 12, 0, 200, 1, "px"), slider("softness", "Мягкость", 35, 0, 250, 1, "px"), slider("opacity", "Плотность", 30, 0, 100, 1, "%"), { type: "color", key: "color", label: "Цвет", value: "#000000" }],
    (v) => ({ matchName: "ADBE Drop Shadow", params: [{ index: 1, value: rgba(v.color) }, { index: 2, value: Math.round(v.opacity * 2.55) }, { index: 3, value: 180 }, { index: 4, value: v.distance }, { index: 5, value: v.softness }] }),
    (v) => ({ boxShadow: `0 ${v.distance / 2}px ${v.softness / 2}px ${v.color}${Math.round(v.opacity * 2.55).toString(16).padStart(2, "0")}` })),
  make("glow", "Свечение", "Ореол вокруг ярких мест",
    [slider("radius", "Радиус", 30, 0, 300, 1, "px"), slider("intensity", "Сила", 1.2, 0, 5, 0.1), slider("threshold", "Порог", 60, 0, 100, 1, "%")],
    (v) => ({ matchName: "ADBE Glo2", params: [{ index: 2, value: v.threshold * 2.55 }, { index: 3, value: v.radius }, { index: 4, value: v.intensity }] }),
    (v) => ({ boxShadow: `0 0 ${v.radius / 2}px ${v.intensity * 4}px var(--accent)` })),
  make("sweep", "Световой блик", "Полоса света проходит по слою",
    [slider("duration", "Длительность", 1, 0.2, 5, 0.1, "с"), slider("width", "Ширина", 50, 5, 300, 1, "px"), slider("angle", "Угол", -30, -90, 90, 1, "°")],
    (v) => ({ matchName: "CC Light Sweep", params: [{ index: 2, value: v.angle }, { index: 4, value: v.width }], keys: [{ index: 1, duration: v.duration, sweep: true }] }),
    () => ({ backgroundImage: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%)", backgroundSize: "250% 100%", animation: "sweep 1.6s ease-in-out infinite" })),
  make("blur", "Размытие", "Gaussian Blur",
    [slider("amount", "Размытие", 12, 0, 200, 1, "px")],
    (v) => ({ matchName: "ADBE Gaussian Blur 2", params: [{ index: 1, value: v.amount }] }),
    (v) => ({ filter: `blur(${v.amount / 6}px)` })),
  make("tint", "Тонировка", "Окрасить в два цвета",
    [{ type: "color", key: "dark", label: "Тени", value: "#1b0b3a" }, { type: "color", key: "light", label: "Свет", value: "#f2d6ff" }, slider("amount", "Сила", 100, 0, 100, 1, "%")],
    (v) => ({ matchName: "ADBE Tint", params: [{ index: 1, value: rgba(v.dark) }, { index: 2, value: rgba(v.light) }, { index: 3, value: v.amount }] }),
    (v) => ({ background: `linear-gradient(135deg, ${v.dark}, ${v.light})`, color: v.dark })),
  make("grain", "Зерно", "Плёночный шум",
    [slider("amount", "Количество", 6, 0, 100, 0.5, "%")],
    (v) => ({ matchName: "ADBE Noise", params: [{ index: 1, value: v.amount }] }),
    (v) => ({ backgroundImage: `repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,${v.amount / 200}) 0 1px, transparent 1px 3px)` })),
  make("bw", "Чёрно-белый", "Обесцветить слой", [], () => ({ matchName: "ADBE Black&White" }), () => ({ filter: "grayscale(1)" })),
];
