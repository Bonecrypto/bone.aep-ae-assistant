import { hexToRgb } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export type GlassInput = { title?: string; width: number; height: number; radius: number; frost: number; tint: number; color?: string; stroke: number; shadow: number };

export const glass = hostTool<GlassInput>({
  name: "ae.glass",
  title: (i) => i.title ?? "Стекло",
  description:
    "Создаёт стеклянную плашку (Liquid Glass) в центре активной композиции: шейп-слой со скруглением, лёгкой заливкой, обводкой и тенью, " +
    "а под ним корректирующий слой с такой же маской, который матово размывает всё, что ниже. Стекло привязано к плашке. " +
    "width/height/radius — px, frost — размытие, tint — плотность заливки %, color — #rrggbb, stroke — обводка px, shadow — тень %.",
  inputSchema: {
    type: "object",
    properties: {
      width: { type: "number", description: "Ширина, px." }, height: { type: "number", description: "Высота, px." },
      radius: { type: "number", description: "Скругление, px." }, frost: { type: "number", description: "Матовость (размытие), px." },
      tint: { type: "number", description: "Плотность заливки, %." }, color: { type: "string", description: "Цвет стекла #rrggbb." },
      stroke: { type: "number", description: "Обводка, px (0 — без неё)." }, shadow: { type: "number", description: "Тень, % (0 — без неё)." },
    },
    required: ["width", "height"],
  },
  mutates: true,
  toArgs: (i) => ({ ...i, title: undefined, color: hexToRgb(i.color ?? "#ffffff"), name: i.title ?? "Стекло", blurName: `${i.title ?? "Стекло"} · размытие` }),
  done: (r, i) => `${i.title ?? "Стекло"}: плашка в центре кадра. Двигайте её — стекло поедет вместе с ней.${Number(r.failedParams) ? ` Не все параметры эффектов приняты (${r.failedParams}).` : ""}${undoHint}`,
});
