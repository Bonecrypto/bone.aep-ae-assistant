import { hostTool, undoHint } from "../host-tool";

export type SceneKind = "dip" | "flash" | "blur" | "zoomIn" | "zoomOut" | "whip" | "spin";
export type SceneInput = { title?: string; kind: SceneKind; duration?: number; side?: "left" | "right" | "up" | "down"; amount?: number; motionBlur?: boolean };

export const sceneTransition = hostTool<SceneInput>({
  name: "ae.sceneTransition",
  title: (i) => i.title ?? "Переход",
  description:
    "Переход между сценами на склейке (склейка = текущее время): новый слой сверху длиной duration по центру склейки. " +
    "kind: dip — через чёрное, flash — вспышка белым, blur — размытие, zoomIn/zoomOut — зум-проход, whip — хлыст-панорама (side), spin — поворот. " +
    "amount — сила, %. motionBlur — размытие движения.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["dip", "flash", "blur", "zoomIn", "zoomOut", "whip", "spin"], description: "Вид перехода." },
      duration: { type: "number", minimum: 0.1, maximum: 5, description: "Длительность, с." },
      side: { type: "string", enum: ["left", "right", "up", "down"], description: "Для whip: куда уезжает кадр." },
      amount: { type: "number", minimum: 1, maximum: 300, description: "Сила, %." },
      motionBlur: { type: "boolean", description: "Размытие движения." },
    },
    required: ["kind"],
  },
  mutates: true,
  toArgs: (i) => ({ ...i, title: undefined, name: i.title ?? "Переход" }),
  done: (r, i) => `${i.title ?? "Переход"} на склейке.${Number(r.failedParams) ? ` Не все параметры эффектов приняты (${r.failedParams}).` : ""}${undoHint}`,
});
