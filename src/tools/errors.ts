// Коды ошибок ExtendScript → понятные человеку сообщения.
const messages: Record<string, string> = {
  NO_COMP: "Откройте композицию и кликните по таймлайну.",
  NO_SELECTION: "Выделите хотя бы один слой в таймлайне.",
  NOTHING_CHANGED: "Ни один слой не изменён: все выделенные заблокированы, без позиции или с выражением на позиции.",
  HOST_NOT_LOADED: "Скрипт панели не загрузился в AE. Закройте и откройте панель заново.",
  BAD_RESPONSE: "AE вернул непонятный ответ. Подробности — в консоли отладки (localhost:8860).",
  UNKNOWN_TOOL: "Эта функция ещё не реализована в host-скрипте.",
  BAD_ARGS: "Неверные параметры действия.",
};

export function humanError(code: string, extra?: Record<string, unknown>): string {
  if (code === "EXCEPTION") return `Ошибка After Effects: ${String(extra?.message ?? "неизвестно")}`;
  return messages[code] ?? `Ошибка: ${code}`;
}
