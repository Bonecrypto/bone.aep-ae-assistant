import { callHost } from "../../lib/cep";
import { humanError } from "../errors";
import type { Tool } from "../types";

export type AnimKind = "slide" | "fade" | "scale";
export type AnimMode = "in" | "out";
export type Direction = "left" | "right" | "up" | "down";
export type AnimateInput = { kind: AnimKind; mode: AnimMode; direction?: Direction; duration?: number };

type Skipped = { locked: number; noPosition: number; expression: number };

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const dirName: Record<Direction, { in: string; out: string }> = {
  left: { in: "слева", out: "влево" },
  right: { in: "справа", out: "вправо" },
  up: { in: "сверху", out: "вверх" },
  down: { in: "снизу", out: "вниз" },
};

/** Короткое название действия для плитки и статуса: «Влёт слева», «Затухание», «Рост». */
export function animTitle(i: AnimateInput): string {
  if (i.kind === "fade") return i.mode === "in" ? "Появление" : "Затухание";
  if (i.kind === "scale") return i.mode === "in" ? "Рост" : "Сжатие";
  const d = dirName[i.direction ?? "left"][i.mode];
  return `${i.mode === "in" ? "Влёт" : "Улёт"} ${d}`;
}

export const animate: Tool<AnimateInput> = {
  name: "ae.animate",
  title: "Анимация слоёв",
  description:
    "Анимирует влёт (mode=in) или улёт (mode=out) выделенных слоёв активной композиции. " +
    "kind=slide — из-за края кадра / за край кадра в направлении direction; kind=fade — прозрачность 0↔текущая; " +
    "kind=scale — масштаб 0↔текущий. Ключи ставятся от текущего времени (CTI) на duration секунд " +
    "с настоящим ease: влёт тормозит в конце, улёт разгоняется в начале. " +
    "Пропускает заблокированные слои, камеры/свет и слои с выражением на анимируемом свойстве. Отменяется одним Ctrl+Z.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["slide", "fade", "scale"], description: "Тип анимации." },
      mode: { type: "string", enum: ["in", "out"], description: "in — появление/влёт, out — исчезание/улёт." },
      direction: { type: "string", enum: ["left", "right", "up", "down"], description: "Только для slide: сторона кадра." },
      duration: { type: "number", minimum: 0.05, maximum: 10, default: 0.6, description: "Длительность в секундах." },
    },
    required: ["kind", "mode"],
  },
  mutates: true,
  async run(input) {
    const title = animTitle(input);
    const res = await callHost(this.name, {
      kind: input.kind,
      mode: input.mode,
      direction: input.direction ?? "left",
      duration: input.duration ?? 0.6,
      undoName: `Ассистент: ${title.toLowerCase()}`,
    });
    if (!res.ok) return { ok: false, undoable: false, message: humanError(res.code, res), data: res };

    const n = Number(res.changed);
    const s = res.skipped as Skipped;
    const skippedTotal = s.locked + s.noPosition + s.expression;
    let message = `${title}: ${n} ${plural(n, "слой", "слоя", "слоёв")}. Ctrl+Z — отменить`;
    if (skippedTotal) message += ` · пропущено: ${skippedTotal}`;
    return { ok: true, undoable: true, message, data: res };
  },
};
