import { addEffect, createLayer, element } from "../tools/ae/create";
import { precompose, sequence, labelByType, removeUnused } from "../tools/ae/service";
import { motionBlur } from "../tools/ae/animate";
import { glass } from "../tools/ae/glass";
import { ELEMENT_ITEMS, EFFECT_ITEMS, LAYER_ITEMS } from "./create";
import { layersWord } from "../lib/format";
import { act, slider, type Preset } from "./types";

const draw: Record<string, string> = {
  underline: "M60 70 H140", arrow: "M60 50 H136 M120 36 L136 50 L120 64", circle: "M100 22 a28 28 0 1 1 -0.1 0",
  frame: "M56 28 H144 V72 H56 Z", cross: "M80 30 L120 70 M120 30 L80 70",
  burst: "M100 18 V30 M100 70 V82 M68 50 H80 M120 50 H132 M78 28 L86 36 M114 64 L122 72 M122 28 L114 36 M86 64 L78 72",
};
const shapeStage = (d: string, color: string, width: number) => ({
  kind: "node" as const,
  node: <svg className="draw-stage" viewBox="0 0 200 100"><path d={d} pathLength={1} style={{ stroke: color, strokeWidth: Math.max(1.5, width / 2.5) }} /></svg>,
});
const layerStage = (label: string, bg: string) => ({ kind: "node" as const, node: <div className="style-stage"><div className="style-card" style={{ background: bg }}>{label}</div></div> });

// Превью стекла: настоящее размытие фона (backdrop-filter) поверх цветных пятен.
const glassStage = (v: Record<string, any>, label: string) => {
  const k = 0.32; // px AE -> px превью
  return {
    kind: "node" as const,
    node: (
      <div className="glass-stage">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
        <div className="glass-card" style={{
          width: Math.min(260, v.width * k), height: Math.min(130, v.height * k), borderRadius: Math.min(v.radius * k, 65),
          backdropFilter: `blur(${v.frost / 4}px) brightness(1.08)`, WebkitBackdropFilter: `blur(${v.frost / 4}px)`,
          background: `${v.color ?? "#ffffff"}${Math.round(v.tint * 2.55).toString(16).padStart(2, "0")}`,
          border: v.stroke > 0 ? `${Math.max(1, v.stroke / 2)}px solid rgba(255,255,255,.45)` : "none",
          boxShadow: v.shadow > 0 ? `0 8px 24px rgba(0,0,0,${v.shadow / 140})` : "none",
        }}>{label}</div>
      </div>
    ),
  };
};

const glassControls = (w: number, h: number, r: number, withColor: boolean) => [
  slider("width", "Ширина", w, 40, 3000, 1, "px"), slider("height", "Высота", h, 20, 2000, 1, "px"),
  slider("radius", "Скругление", r, 0, 500, 1, "px"), slider("frost", "Матовость", 30, 0, 150, 1, "px"),
  slider("tint", "Заливка", withColor ? 28 : 12, 0, 100, 1, "%"),
  ...(withColor ? [{ type: "color", key: "color", label: "Цвет", value: "#7aa7ff" } as const] : []),
  slider("stroke", "Обводка", 1.5, 0, 10, 0.5, "px"), slider("shadow", "Тень", 30, 0, 100, 1, "%"),
];

function glassPreset(id: string, title: string, subtitle: string, w: number, h: number, r: number, withColor: boolean): Preset {
  return {
    id, title, subtitle, group: "Стекло", controls: glassControls(w, h, r, withColor) as Preset["controls"],
    preview: (v) => glassStage(v, title),
    hint: () => "В центре кадра, поверх всего. Двигайте плашку — стекло поедет вместе с ней",
    applyLabel: "Создать",
    build: (v) => act(glass, { title, width: v.width, height: v.height, radius: v.radius, frost: v.frost, tint: v.tint, color: v.color, stroke: v.stroke, shadow: v.shadow }),
  };
}

export const CREATE_PRESETS: Preset[] = [
  glassPreset("glass", "Стеклянная плашка", "Матовое стекло со скруглением", 800, 400, 80, false),
  glassPreset("glassColor", "Цветное стекло", "Стекло с цветной подсветкой", 800, 400, 80, true),
  glassPreset("glassPill", "Стеклянная кнопка", "Таблетка с матовым стеклом", 360, 110, 55, false),
  ...LAYER_ITEMS.map((it): Preset => ({
    id: it.kind, title: it.title, subtitle: it.hint, group: "Слои",
    controls: it.kind === "solid" ? [{ type: "color", key: "color", label: "Цвет", value: "#9f18ec" }] : [],
    preview: (v) => layerStage(it.title, it.kind === "solid" ? v.color : it.kind === "vignette" ? "radial-gradient(circle, #555 30%, #000 100%)" : "var(--surface-2)"),
    hint: (_v, sel) => it.kind === "null" && sel.selected ? `Null станет родителем: ${layersWord(sel.selected)}` : "Новый слой в активной композиции",
    applyLabel: "Создать",
    build: (v) => act(createLayer, { kind: it.kind, color: v.color }),
  })),
  ...ELEMENT_ITEMS.map((it): Preset => ({
    id: `el-${it.kind}`, title: it.title, subtitle: it.hint, group: "Элементы",
    controls: [{ type: "color", key: "color", label: "Цвет", value: "#ffffff" }, slider("width", "Толщина", 8, 1, 60, 1, "px"), slider("duration", "Прорисовка", 0.8, 0.1, 5, 0.05, "с")],
    preview: (v) => shapeStage(draw[it.kind], v.color, v.width),
    hint: (_v, sel) => sel.selected ? "В центре выделенных слоёв, от текущего времени" : "В центре кадра, от текущего времени",
    applyLabel: "Создать",
    build: (v) => act(element, { kind: it.kind, color: v.color, width: v.width, duration: v.duration }),
  })),
  ...EFFECT_ITEMS.map((it): Preset => ({
    id: `fx-${it.matchName}`, title: it.title, subtitle: it.hint, group: "Эффекты", controls: [],
    hint: (_v, sel) => sel.selected ? `На ${layersWord(sel.selected)}` : "Без выделения — новым корректирующим слоем",
    build: () => act(addEffect, { matchName: it.matchName }),
  })),
];

export const SERVICE_PRESETS: Preset[] = [
  { id: "precomp", title: "Прекомпоз", subtitle: "Собрать выделенные слои в композицию", group: "Слои", controls: [], build: () => act(precompose, { name: "Прекомпоз" }) },
  {
    id: "seq", title: "По очереди", subtitle: "Сдвинуть слои лесенкой", group: "Время",
    controls: [slider("step", "Шаг", 5, 0, 120, 1, "кадр."), { type: "toggle", key: "reverse", label: "Снизу вверх", value: false }],
    hint: (_v, sel) => sel.selected > 1 ? `${layersWord(sel.selected)} по порядку в таймлайне` : "Выделите минимум два слоя",
    build: (v) => act(sequence, { mode: "time", stepFrames: v.step, reverse: v.reverse }),
  },
  { id: "markers", title: "По маркерам", subtitle: "Каждый слой — на свой маркер композиции", group: "Время", controls: [{ type: "toggle", key: "reverse", label: "Снизу вверх", value: false }],
    build: (v) => act(sequence, { mode: "markers", reverse: v.reverse }) },
  { id: "mblur", title: "Моушн-блюр", subtitle: "Включить у выделенных слоёв", group: "Слои", controls: [{ type: "toggle", key: "on", label: "Включить", value: true }],
    build: (v) => act(motionBlur, { on: v.on }) },
  { id: "labels", title: "Цвет по типу", subtitle: "Покрасить метки слоёв", group: "Порядок", controls: [],
    hint: () => "Текст — красный, шейпы — жёлтый, прекомпы — голубой, null — розовый, коррекция — лавандовый", build: () => act(labelByType, {}) },
  { id: "clean", title: "Очистить проект", subtitle: "Убрать неиспользуемые исходники", group: "Порядок", controls: [{ type: "toggle", key: "sure", label: "Да, убрать из проекта", value: false }],
    hint: () => "Файлы на диске не удаляются. Можно отменить Ctrl+Z", applyLabel: "Очистить",
    build: (v) => (v.sure ? act(removeUnused, {}) : act({ ...removeUnused, run: async () => ({ ok: false, undoable: false, message: "Включите «Да, убрать из проекта» и нажмите ещё раз." }) }, {})) },
];
