import { callHost, type HostResult } from "../lib/cep";
import { humanError } from "./errors";
import { logError } from "../lib/errorlog";
import { undoKeys } from "../lib/platform";
import type { InputSchema, Tool } from "./types";

type OkResult = Extract<HostResult, { ok: true }>;

/**
 * Инструмент, который вызывает функцию из host/*.jsx.
 * toArgs — превращает вход в аргументы ExtendScript (тексты на русском передаются отсюда),
 * done — сообщение для строки статуса.
 */
export function hostTool<I extends Record<string, any>>(def: {
  name: string;
  host?: string;
  title: (i: I) => string;
  description: string;
  inputSchema: InputSchema;
  mutates: boolean;
  toArgs?: (i: I) => Record<string, unknown>;
  done: (r: OkResult, i: I) => string;
}): Tool<I> {
  return {
    name: def.name,
    title: def.title({} as I),
    description: def.description,
    inputSchema: def.inputSchema,
    mutates: def.mutates,
    describe: def.title,
    async run(input: I) {
      const title = def.title(input);
      const args = { ...(def.toArgs ? def.toArgs(input) : input), undoName: `Ассистент: ${title.toLowerCase()}` };
      const res = await callHost(def.host ?? def.name, args);
      if (!res.ok) {
        const message = humanError(res.code, res);
        logError({ tool: def.host ?? def.name, code: res.code, message, args: JSON.stringify(args).slice(0, 600), host: res.code === "EXCEPTION" ? `${String(res.message)} (строка ${String(res.line)})` : undefined });
        return { ok: false, undoable: false, message, data: res };
      }
      return { ok: true, undoable: def.mutates, message: def.done(res, input), data: res };
    },
  };
}

export const undoHint = ` ${undoKeys} — отменить`;
