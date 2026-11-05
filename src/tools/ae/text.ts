import { layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export type TextStyle = Record<string, unknown>;
export type TextAnimPreset = "fade" | "rise" | "scale" | "blur";
export const TEXT_ANIMS: { id: TextAnimPreset; title: string }[] = [
  { id: "fade", title: "Проявление" },
  { id: "rise", title: "Снизу вверх" },
  { id: "scale", title: "Из точки" },
  { id: "blur", title: "Из размытия" },
];

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

export const textAnimate = hostTool<{ preset: TextAnimPreset; mode: "in" | "out"; duration?: number }>({
  name: "ae.textAnimate",
  title: (i) => `${TEXT_ANIMS.find((x) => x.id === i.preset)?.title ?? "Анимация"} по буквам${i.mode === "out" ? " (исчезание)" : ""}`,
  description:
    "Добавляет текстовый аниматор на выделенные текстовые слои: буквы появляются (mode=in) или исчезают (mode=out) по одной, от текущего времени. " +
    `preset: ${TEXT_ANIMS.map((x) => `${x.id} — ${x.title}`).join(", ")}.`,
  inputSchema: {
    type: "object",
    properties: {
      preset: { type: "string", enum: TEXT_ANIMS.map((x) => x.id), description: "Как появляются буквы." },
      mode: { type: "string", enum: ["in", "out"], description: "in — появление, out — исчезание." },
      duration: { type: "number", minimum: 0.1, maximum: 20, description: "Длительность, с." },
    },
    required: ["preset", "mode"],
  },
  mutates: true,
  toArgs: (i) => ({ ...i, duration: i.duration ?? 1, animatorName: `Ассистент · ${TEXT_ANIMS.find((x) => x.id === i.preset)?.title ?? ""}` }),
  done: (r) => `Анимация по буквам: ${layersWord(Number(r.changed))}.${undoHint}`,
});
