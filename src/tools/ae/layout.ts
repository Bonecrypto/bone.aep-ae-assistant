import { layersWord, plural } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export const anchor = hostTool<{ x: number; y: number }>({
  name: "ae.anchor",
  title: () => "Точка привязки",
  description: "Ставит точку привязки выделенных слоёв в точку сетки 3×3 их границ (x, y: 0 — левый/верхний край, 0.5 — центр, 1 — правый/нижний), не сдвигая слои.",
  inputSchema: { type: "object", properties: { x: { type: "number", enum: [0, 0.5, 1], description: "По горизонтали." }, y: { type: "number", enum: [0, 0.5, 1], description: "По вертикали." } }, required: ["x", "y"] },
  mutates: true,
  done: (r) => `Точка привязки: ${layersWord(Number(r.changed))}${Number(r.keyed) ? ` · пропущено с ключами: ${r.keyed}` : ""}.${undoHint}`,
});

export const align = hostTool<{ mode: string; to: "comp" | "selection" }>({
  name: "ae.align",
  title: () => "Выравнивание",
  description: "Выравнивает выделенные слои: mode left/hcenter/right/top/vcenter/bottom/center; to=comp — по кадру, selection — по общим границам выделения. Ключи позиции сдвигаются вместе.",
  inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["left", "hcenter", "right", "top", "vcenter", "bottom", "center"], description: "Как выровнять." }, to: { type: "string", enum: ["comp", "selection"], description: "По кадру или по выделению." } }, required: ["mode"] },
  mutates: true,
  done: (r) => `Выровнено: ${layersWord(Number(r.changed))}.${undoHint}`,
});

export const distribute = hostTool<{ axis: "x" | "y" }>({
  name: "ae.distribute",
  title: () => "Распределить",
  description: "Распределяет центры выделенных слоёв (минимум 3) равномерно по горизонтали (x) или вертикали (y) между крайними.",
  inputSchema: { type: "object", properties: { axis: { type: "string", enum: ["x", "y"], description: "Ось." } }, required: ["axis"] },
  mutates: true,
  done: (r) => `Распределено: ${layersWord(Number(r.changed))}.${undoHint}`,
});

export const reverseKeys = hostTool<Record<string, never>>({
  name: "ae.reverseKeys",
  title: () => "Развернуть ключи",
  description: "Разворачивает выделенные ключи во времени (минимум 2 на свойстве), иначе все ключи выделенных свойств. Ease меняется местами.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Развёрнуто: ${Number(r.changed)} ${plural(Number(r.changed), "свойство", "свойства", "свойств")}.${undoHint}`,
});

export const splitText = hostTool<{ unit: "chars" | "words" | "lines" }>({
  name: "ae.splitText",
  title: (i) => `Разбить текст на ${i.unit === "words" ? "слова" : i.unit === "lines" ? "строки" : "буквы"}`,
  description: "Разбивает выделенные текстовые слои на отдельные слои по буквам, словам или строкам — каждая часть остаётся на своём месте; исходный слой выключается.",
  inputSchema: { type: "object", properties: { unit: { type: "string", enum: ["chars", "words", "lines"], description: "Как разбить." } }, required: ["unit"] },
  mutates: true,
  done: (r) => `Создано ${layersWord(Number(r.changed))}; исходный выключен.${undoHint}`,
});
