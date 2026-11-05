import { callHost } from "../../lib/cep";
import { humanError } from "../errors";
import type { Tool } from "../types";

type Input = { direction: "left"; duration?: number };
type Skipped = { locked: number; noPosition: number; expression: number };

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const flyIn: Tool<Input> = {
  name: "ae.flyIn",
  title: "Влёт слева",
  description:
    "Анимирует влёт выделенных слоёв активной композиции из-за левого края кадра в их текущую позицию. " +
    "Ключи ставятся от текущего времени (CTI) на duration секунд, с настоящим ease (быстрый старт, мягкая остановка). " +
    "Пропускает заблокированные слои, камеры/свет и слои с выражением на позиции. Отменяется одним Ctrl+Z.",
  inputSchema: {
    type: "object",
    properties: {
      direction: { type: "string", enum: ["left"], description: "Откуда влетает слой. Пока только left." },
      duration: { type: "number", minimum: 0.05, maximum: 10, default: 0.6, description: "Длительность влёта в секундах." },
    },
    required: ["direction"],
  },
  mutates: true,
  async run(input) {
    const res = await callHost(this.name, {
      direction: input.direction,
      duration: input.duration ?? 0.6,
      undoName: "Ассистент: влёт слева",
    });
    if (!res.ok) return { ok: false, undoable: false, message: humanError(res.code, res), data: res };

    const n = Number(res.changed);
    const s = res.skipped as Skipped;
    const skippedTotal = s.locked + s.noPosition + s.expression;
    let message = `Готово: ${n} ${plural(n, "слой", "слоя", "слоёв")}. Ctrl+Z — отменить`;
    if (skippedTotal) message += ` · пропущено: ${skippedTotal}`;
    return { ok: true, undoable: true, message, data: res };
  },
};
