import { layersWord } from "../../lib/format";
import type { Anim } from "../../lib/myanims";
import { hostTool, undoHint } from "../host-tool";

export const animCapture = hostTool<{ effects: boolean }>({
  name: "ae.animCapture",
  title: () => "Сохранить анимацию",
  description: "Снимает анимацию с первого выделенного слоя: ключи и выражения трансформации, эффекты, текстовые аниматоры, маркеры.",
  inputSchema: { type: "object", properties: { effects: { type: "boolean", description: "Сохранять эффекты слоя." } } },
  mutates: false,
  done: (r) => `Анимация снята со слоя «${String((r.anim as Anim)?.from ?? "")}».`,
});

export const animApply = hostTool<{ title: string; anim: Anim; at: "layer" | "playhead"; relative: boolean }>({
  name: "ae.animApply",
  title: (i) => (i.title ? `Анимация «${i.title}»` : "Моя анимация"),
  description: "Накладывает сохранённую анимацию на выделенные слои.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: (i) => ({ anim: i.anim, at: i.at, relative: i.relative }),
  done: (r, i) => {
    const extra = [
      Number(r.notText) ? `текстовые аниматоры пропущены на ${layersWord(Number(r.notText))} без текста` : "",
      Number(r.locked) ? `заблокированных: ${r.locked}` : "",
      Number(r.fails) ? `не перенеслось свойств: ${r.fails}` : "",
    ].filter(Boolean).join(", ");
    return `«${i.title}» → ${layersWord(Number(r.changed))}${extra ? ` (${extra})` : ""}.${undoHint}`;
  },
});
