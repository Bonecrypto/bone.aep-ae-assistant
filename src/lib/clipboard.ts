import { setStatus } from "./store";

/** Копирование в буфер: Clipboard API, а если он недоступен во встроенном браузере AE — через скрытое поле. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  setStatus({ kind: "ok", text: "Скопировано в буфер обмена." });
}
