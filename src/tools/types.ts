import type { HostResult } from "../lib/cep";

/** JSON Schema входа инструмента (то же, что получит ИИ-модель). */
export type InputSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string; enum?: string[]; minimum?: number; maximum?: number; default?: unknown }>;
  required?: string[];
};

export type ToolResult = { ok: boolean; message: string; undoable: boolean; data?: HostResult };

/**
 * Инструмент = одна возможность ассистента.
 * name — с префиксом (ae.*, audio.*, files.*, knowledge.*).
 * mutates — меняет проект; из чата такие вызовы требуют подтверждения.
 */
export interface Tool<I = Record<string, unknown>> {
  name: string;
  title: string;
  description: string;
  inputSchema: InputSchema;
  mutates: boolean;
  run: (input: I) => Promise<ToolResult>;
}
