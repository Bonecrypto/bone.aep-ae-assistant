// Провайдер чата. Сейчас — заглушка. Дальше: OpenRouter / Gemini / Ollama,
// ключ вводит пользователь, хранится локально и в код не попадает.

export type ChatMessage = { role: "user" | "assistant"; text: string };

export interface ChatProvider {
  id: string;
  reply: (history: ChatMessage[]) => Promise<string>;
}

export const stubProvider: ChatProvider = {
  id: "stub",
  reply: async () => {
    await new Promise((r) => setTimeout(r, 300));
    return "Привет! Я ассистент After Effects. Пока я умею только здороваться, но скоро смогу работать с вашей композицией.";
  },
};
