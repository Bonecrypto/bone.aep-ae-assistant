import { layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export type StyleArgs = {
  title: string;
  matchName: string;
  params?: { index: number; value: unknown }[];
  keys?: { index: number; from?: unknown; to?: unknown; duration: number; sweep?: boolean }[];
};

export const style = hostTool<StyleArgs>({
  name: "ae.style",
  title: (i) => i.title ?? "Стиль",
  description: "Внутренний инструмент стилей: эффект с параметрами по номеру.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: (i) => ({ matchName: i.matchName, name: i.title, params: i.params, keys: i.keys }),
  done: (r, i) => `${i.title}: ${layersWord(Number(r.changed))}${Number(r.failedParams) ? ` (не все параметры приняты: ${r.failedParams})` : ""}.${undoHint}`,
});

export const multiExpr = hostTool<{ title: string; items: { path: string[]; code: string }[]; controls: { type?: string; name: string; value: number }[]; startSlider?: string }>({
  name: "ae.expressions",
  title: (i) => i.title ?? "Выражения",
  description: "Внутренний инструмент: несколько выражений одним действием.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: (i) => ({ items: i.items, controls: i.controls, startSlider: i.startSlider }),
  done: (r, i) => {
    const err = String(r.expressionError ?? "");
    return err ? `${i.title}: AE сообщает об ошибке в выражении: ${err}` : `${i.title}: ${layersWord(Number(r.changed))}.${undoHint}`;
  },
});
