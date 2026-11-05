import { layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export type TextStyle = Record<string, unknown>;
export const textCopyStyle = hostTool<Record<string, never>>({
  name: "ae.textCopyStyle",
  title: () => "Копировать стиль текста",
  description: "Читает стиль первого выделенного текстового слоя (шрифт, размер, цвет, обводка, трекинг, выравнивание).",
  inputSchema: { type: "object", properties: {} },
  mutates: false,
  done: (r) => `Стиль скопирован с «${String(r.from)}».`,
});

export const textPasteStyle = hostTool<{ style: TextStyle }>({
  name: "ae.textPasteStyle",
  title: () => "Вставить стиль текста",
  description: "Применяет сохранённый стиль текста к выделенным текстовым слоям. Сам текст не меняется.",
  inputSchema: { type: "object", properties: { style: { type: "object", description: "Стиль из ae.textCopyStyle." } }, required: ["style"] },
  mutates: true,
  done: (r) => `Стиль применён: ${layersWord(Number(r.changed))}.${undoHint}`,
});
