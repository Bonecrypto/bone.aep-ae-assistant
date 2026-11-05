import type { Tool, ToolResult } from "../tools/types";
import { getStatusBusy, setBusy } from "./busy";
import { setStatus } from "./store";

/** Запуск инструмента из кнопки/палитры: блокирует повторные клики и пишет результат в строку статуса. */
export async function runTool<I>(tool: Tool<I>, input: I): Promise<ToolResult | null> {
  if (getStatusBusy()) return null;
  const title = tool.describe ? tool.describe(input) : tool.title;
  setBusy(true);
  setStatus({ kind: "busy", text: `${title}…` });
  try {
    const r = await tool.run(input);
    setStatus({ kind: r.ok ? "ok" : "error", text: r.message });
    return r;
  } catch (e) {
    setStatus({ kind: "error", text: `Не удалось выполнить: ${String(e)}` });
    return null;
  } finally {
    setBusy(false);
  }
}
