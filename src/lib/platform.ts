// macOS или Windows: подписи клавиш и выбор архива обновления.
export const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);
/** «Ctrl» на Windows, «⌘» на Mac. */
export const MOD = isMac ? "⌘" : "Ctrl+";
export const undoKeys = isMac ? "⌘Z" : "Ctrl+Z";
