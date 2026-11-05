import { EFFECT_ITEMS, ELEMENT_ITEMS, LAYER_ITEMS, type ElementKind, type LayerKind } from "../../presets/create";
import { hexToRgb, layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export const createLayer = hostTool<{ kind: LayerKind; color?: string; name?: string; parentSelected?: boolean }>({
  name: "ae.create",
  title: (i) => `Создать: ${LAYER_ITEMS.find((x) => x.kind === i.kind)?.title ?? "слой"}`,
  description:
    "Создаёт слой в активной композиции: " + LAYER_ITEMS.map((x) => `${x.kind} — ${x.hint}`).join("; ") +
    ". color — #rrggbb для solid. parentSelected — для null: сделать выделенные слои его детьми (по умолчанию true).",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: LAYER_ITEMS.map((x) => x.kind), description: "Что создать." },
      color: { type: "string", description: "Цвет #rrggbb (для solid)." },
      name: { type: "string", description: "Имя слоя." },
      parentSelected: { type: "boolean", description: "Только для null." },
    },
    required: ["kind"],
  },
  mutates: true,
  toArgs: (i) => ({
    kind: i.kind,
    name: i.name ?? LAYER_ITEMS.find((x) => x.kind === i.kind)?.name,
    color: hexToRgb(i.color ?? "#000000"),
    parentSelected: i.parentSelected ?? true,
  }),
  done: (r) => `Создан слой «${String(r.layer)}»${Number(r.parented) ? `, привязано ${layersWord(Number(r.parented))}` : ""}.${undoHint}`,
});

export const addEffect = hostTool<{ matchName: string }>({
  name: "ae.addEffect",
  title: (i) => `Эффект: ${EFFECT_ITEMS.find((x) => x.matchName === i.matchName)?.title ?? i.matchName ?? ""}`,
  description:
    "Добавляет эффект на выделенные слои; если ничего не выделено — создаёт корректирующий слой с этим эффектом. matchName: " +
    EFFECT_ITEMS.map((x) => `${x.matchName} (${x.title})`).join(", ") + ". Можно и другие встроенные matchName эффектов AE.",
  inputSchema: { type: "object", properties: { matchName: { type: "string", description: "matchName эффекта AE." } }, required: ["matchName"] },
  mutates: true,
  toArgs: (i) => ({ matchName: i.matchName, adjustmentName: EFFECT_ITEMS.find((x) => x.matchName === i.matchName)?.title ?? "Корректирующий" }),
  done: (r) => (r.createdAdjustment ? `Создан корректирующий слой с эффектом.${undoHint}` : `Эффект добавлен: ${layersWord(Number(r.changed))}.${undoHint}`),
});

export const element = hostTool<{ kind: ElementKind; color?: string; width?: number; duration?: number }>({
  name: "ae.element",
  title: (i) => `Элемент: ${ELEMENT_ITEMS.find((x) => x.kind === i.kind)?.title ?? ""}`,
  description:
    "Создаёт шейп-элемент с анимацией прорисовки (Trim Paths) от текущего времени: " +
    ELEMENT_ITEMS.map((x) => `${x.kind} — ${x.hint}`).join("; ") + ". Ставится в центр выделенных слоёв или кадра.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ELEMENT_ITEMS.map((x) => x.kind), description: "Какой элемент." },
      color: { type: "string", description: "Цвет обводки #rrggbb." },
      width: { type: "number", minimum: 1, maximum: 100, description: "Толщина линии, px." },
      duration: { type: "number", minimum: 0.1, maximum: 10, description: "Длительность прорисовки, с." },
    },
    required: ["kind"],
  },
  mutates: true,
  toArgs: (i) => ({ kind: i.kind, color: hexToRgb(i.color ?? "#ffffff"), width: i.width ?? 8, duration: i.duration ?? 0.8, name: ELEMENT_ITEMS.find((x) => x.kind === i.kind)?.title }),
  done: (r) => `Создан элемент «${String(r.layer)}».${undoHint}`,
});
