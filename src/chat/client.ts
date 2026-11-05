import { getPrefs } from "../lib/store";
import type { Tool } from "../tools/types";
import { PROVIDERS } from "./providers";

export type ApiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

// В именах функций OpenAI допускаются только [a-zA-Z0-9_-], поэтому ae.animate -> ae_animate.
export const apiName = (name: string) => name.replace(/\./g, "_");

export function chatConfig() {
  const p = getPrefs();
  const def = PROVIDERS[p.chatProvider];
  return {
    provider: def,
    baseUrl: (p.chatBaseUrl || def.baseUrl).replace(/\/+$/, ""),
    model: p.chatModel || def.model,
    key: p.chatKey,
  };
}

export class ChatError extends Error {}

export async function complete(messages: ApiMessage[], tools: Tool<any>[], signal?: AbortSignal): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  const c = chatConfig();
  if (!c.baseUrl) throw new ChatError("Укажите адрес сервера в настройках (шестерёнка).");
  if (c.provider.needsKey && !c.key) throw new ChatError(`Добавьте ключ ${c.provider.title} в настройках (шестерёнка).`);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (c.key) headers.Authorization = `Bearer ${c.key}`;
  if (getPrefs().chatProvider === "openrouter") headers["X-Title"] = "AE Assistant";

  let res: Response;
  try {
    res = await fetch(`${c.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: c.model,
        messages,
        ...(tools.length ? { tools: tools.map((t) => ({ type: "function", function: { name: apiName(t.name), description: t.description, parameters: t.inputSchema } })) } : {}),
        temperature: 0.3,
      }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ChatError(`Нет связи с ${c.provider.title} (${c.baseUrl}). ${getPrefs().chatProvider === "ollama" ? "Запущен ли Ollama?" : "Проверьте интернет."}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new ChatError("Ключ не подошёл. Проверьте его в настройках.");
    if (res.status === 404) throw new ChatError(`Модель «${c.model}» не найдена у ${c.provider.title}.`);
    if (res.status === 429) throw new ChatError("Слишком много запросов или закончился лимит. Подождите или смените модель.");
    throw new ChatError(`${c.provider.title} ответил ошибкой ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  if (!msg) throw new ChatError("Пустой ответ модели.");
  return { content: msg.content ?? null, tool_calls: msg.tool_calls };
}

export const SYSTEM_PROMPT = `Ты — ассистент моушн-дизайнера внутри Adobe After Effects (панель AE Assistant). Отвечай по-русски, коротко и по делу.
- На вопросы об анимации и AE отвечай сам, с конкретными шагами и значениями.
- Если нужно что-то сделать в проекте — вызывай инструменты. Действия выполняются над ВЫДЕЛЕННЫМИ слоями/ключами активной композиции и от текущего времени.
- Если не знаешь, что в композиции, сначала вызови ae_compInfo.
- Пользователь подтверждает изменения перед выполнением; если он отказался — не настаивай.
- Предпочитай готовые пресеты (ae_expressionPreset, ae_ease preset) своему коду. Своё выражение (ae_setExpression) — только когда пресета нет.
- Не выдумывай возможностей: если инструментами сделать нельзя — скажи «так панель пока не умеет» и дай ручной путь в AE.
- После действия кратко скажи, что изменилось, и напомни, что Ctrl+Z отменяет его целиком.`;
