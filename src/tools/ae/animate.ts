import { layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export type AnimKind = "slide" | "fade" | "scale" | "rotate";
export type AnimMode = "in" | "out";
export type Direction = "left" | "right" | "up" | "down";
export type AnimateInput = { kind: AnimKind; mode: AnimMode; direction?: Direction; duration?: number; spring?: boolean };

const dirName: Record<Direction, { in: string; out: string }> = {
  left: { in: "слева", out: "влево" },
  right: { in: "справа", out: "вправо" },
  up: { in: "сверху", out: "вверх" },
  down: { in: "снизу", out: "вниз" },
};

/** Короткое название действия для плитки и статуса: «Влёт слева», «Затухание», «Рост». */
export function animTitle(i: Partial<AnimateInput>): string {
  if (!i.kind) return "Анимация слоёв";
  const spring = i.spring && i.mode === "in" && i.kind !== "fade" ? " с пружиной" : "";
  if (i.kind === "fade") return i.mode === "in" ? "Появление" : "Затухание";
  if (i.kind === "scale") return (i.mode === "in" ? "Рост" : "Сжатие") + spring;
  if (i.kind === "rotate") return (i.mode === "in" ? "Довернуть" : "Отвернуть") + spring;
  return `${i.mode === "in" ? "Влёт" : "Улёт"} ${dirName[i.direction ?? "left"][i.mode ?? "in"]}${spring}`;
}

type Skipped = { locked: number; noPosition: number; expression: number };

export const animate = hostTool<AnimateInput>({
  name: "ae.animate",
  title: animTitle,
  description:
    "Анимирует влёт (mode=in) или улёт (mode=out) выделенных слоёв активной композиции. " +
    "kind=slide — из-за края кадра / за край кадра в сторону direction; kind=fade — прозрачность 0↔текущая; " +
    "kind=scale — масштаб 0↔текущий; kind=rotate — поворот на 90° к текущему. spring=true — перелёт и возврат (пружина, только для влёта). " +
    "Ключи ставятся от текущего времени (CTI) на duration секунд с настоящим ease. " +
    "Пропускает заблокированные слои, камеры/свет и свойства с выражением. Отменяется одним Ctrl+Z.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["slide", "fade", "scale", "rotate"], description: "Тип анимации." },
      mode: { type: "string", enum: ["in", "out"], description: "in — появление/влёт, out — исчезание/улёт." },
      direction: { type: "string", enum: ["left", "right", "up", "down"], description: "Только для slide: сторона кадра." },
      duration: { type: "number", minimum: 0.05, maximum: 10, default: 0.6, description: "Длительность в секундах." },
      spring: { type: "boolean", default: false, description: "Пружина: перелёт за конечное значение и возврат." },
    },
    required: ["kind", "mode"],
  },
  mutates: true,
  toArgs: (i) => ({ kind: i.kind, mode: i.mode, direction: i.direction ?? "left", duration: i.duration ?? 0.6, spring: !!i.spring }),
  done: (r, i) => {
    const s = r.skipped as Skipped;
    const skipped = s.locked + s.noPosition + s.expression;
    return `${animTitle(i)}: ${layersWord(Number(r.changed))}.${undoHint}${skipped ? ` · пропущено: ${skipped}` : ""}`;
  },
});

export const motionBlur = hostTool<{ on?: boolean }>({
  name: "ae.motionBlur",
  title: (i) => (i.on === false ? "Выключить моушн-блюр" : "Моушн-блюр"),
  description: "Включает (on=true) или выключает моушн-блюр у выделенных слоёв; при включении включает его и в композиции.",
  inputSchema: { type: "object", properties: { on: { type: "boolean", default: true, description: "true — включить, false — выключить." } } },
  mutates: true,
  done: (r) => `Моушн-блюр ${r.on ? "включён" : "выключен"}: ${layersWord(Number(r.changed))}.${undoHint}`,
});
