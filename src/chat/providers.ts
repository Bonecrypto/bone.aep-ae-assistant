// Провайдеры ИИ. Все говорят на OpenAI-совместимом API (chat/completions + tools).
// Ключ вводит пользователь, он хранится только локально в панели и в код не попадает.
export type ProviderId = "openrouter" | "gemini" | "ollama" | "custom";

export const PROVIDERS: Record<ProviderId, { title: string; baseUrl: string; model: string; needsKey: boolean; keyUrl?: string; hint: string }> = {
  openrouter: { title: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/auto", needsKey: true, keyUrl: "https://openrouter.ai/keys", hint: "Сотни моделей по одному ключу" },
  gemini: { title: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", needsKey: true, keyUrl: "https://aistudio.google.com/apikey", hint: "Ключ Google AI Studio, есть бесплатный лимит" },
  ollama: { title: "Ollama", baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b", needsKey: false, hint: "Локальная модель на вашем компьютере, без интернета" },
  custom: { title: "Свой", baseUrl: "", model: "", needsKey: false, hint: "Любой OpenAI-совместимый сервер" },
};
