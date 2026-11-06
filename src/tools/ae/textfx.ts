import { layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export type TextFxArgs = {
  title: string;
  unit: "chars" | "words" | "lines";
  props: { opacity?: number; position?: [number, number]; scale?: number; rotation?: number; blur?: number; skew?: number; tracking?: number };
  code: string;
  controls: { name: string; value: number }[];
  startSlider: string;
  marker?: { name: string; duration: number };
  at?: "playhead" | "layer";
  mode?: "in" | "out";
};

/** Низкоуровневый вызов: аниматор с Expression Selector. Пресеты собирают аргументы в presets/text.ts. */
export const textFx = hostTool<TextFxArgs>({
  name: "ae.textFx",
  title: (i) => i.title ?? "Анимация текста",
  description: "Внутренний инструмент текстовых пресетов.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: (i) => ({ unit: i.unit, props: i.props, code: i.code, controls: i.controls, startSlider: i.startSlider, animatorName: i.title, marker: i.marker, at: i.at, mode: i.mode }),
  done: (r, i) => `${i.title}: ${layersWord(Number(r.changed))}${r.unitSet === false ? " (не удалось переключить на слова/строки — анимация по буквам)" : ""}.${undoHint}`,
});
