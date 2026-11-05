import { plural } from "../../lib/format";
import { ALL_EASE_PRESETS as EASE_PRESETS, type Curve } from "../../presets/ease";
import { hostTool, undoHint } from "../host-tool";

export type Manual = { outSpeed: number; outInfluence: number; inSpeed: number; inInfluence: number };
export type EaseInput = { preset?: string; curve?: Curve; manual?: Manual };

const curveOf = (i: EaseInput): Curve | undefined => i.curve ?? EASE_PRESETS.find((p) => p.id === i.preset)?.curve;

export const ease = hostTool<EaseInput>({
  name: "ae.ease",
  title: (i) => `График: ${EASE_PRESETS.find((p) => p.id === i.preset)?.title ?? (i.manual ? "свои значения" : "своя кривая")}`,
  description:
    "Меняет график скорости между выделенными соседними ключами (настоящий KeyframeEase, без лишних ключей). " +
    `preset — готовая кривая: ${EASE_PRESETS.map((p) => `${p.id} (${p.title})`).join(", ")}. ` +
    "Или curve — cubic-bezier [x1,y1,x2,y2] как в CSS; или manual — speed/influence для выхода из первого и входа во второй ключ.",
  inputSchema: {
    type: "object",
    properties: {
      preset: { type: "string", enum: EASE_PRESETS.map((p) => p.id), description: "Готовая кривая." },
      curve: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4, description: "cubic-bezier [x1, y1, x2, y2], x в 0..1." },
      manual: {
        type: "object", description: "Ручные значения ease.",
        properties: { outSpeed: { type: "number" }, outInfluence: { type: "number" }, inSpeed: { type: "number" }, inInfluence: { type: "number" } },
      },
    },
  },
  mutates: true,
  toArgs: (i) => (i.manual ? { manual: i.manual } : { curve: curveOf(i) }),
  done: (r) => `График применён: ${Number(r.changed)} ${plural(Number(r.changed), "отрезок", "отрезка", "отрезков")}.${undoHint}`,
});

export const readEase = hostTool<Record<string, never>>({
  name: "ae.readEase",
  title: () => "Считать график",
  description: "Читает график скорости первого выделенного отрезка между ключами и возвращает его как cubic-bezier и speed/influence.",
  inputSchema: { type: "object", properties: {} },
  mutates: false,
  done: (r) => `Считан график свойства «${String(r.property)}».`,
});

