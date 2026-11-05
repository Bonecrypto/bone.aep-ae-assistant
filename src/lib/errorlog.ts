import { VERSION, BUILD } from "../config";

// Журнал ошибок действий: что вызывалось, с какими параметрами и что ответил AE. Копируется из настроек.
export type LogEntry = { at: string; tool: string; code: string; message: string; args: string; host?: string };
const KEY = "aea.errorlog.v1";
let log: LogEntry[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } })();

export function logError(e: Omit<LogEntry, "at">) {
  log = [{ ...e, at: new Date().toISOString().replace("T", " ").slice(0, 19) }, ...log].slice(0, 30);
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* без хранилища — только в памяти */ }
}
export const getLog = () => log;
export function clearLog() { log = []; try { localStorage.removeItem(KEY); } catch { /* нечего чистить */ } }

/** Текст отчёта для отправки разработчику. */
export function report(appVersion: string) {
  const head = `AE Assistant ${VERSION} (сборка ${BUILD}) · After Effects ${appVersion} · ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] ?? ""}`;
  return [head, "", ...log.map((e) => `[${e.at}] ${e.tool} → ${e.code}: ${e.message}\n  параметры: ${e.args}${e.host ? `\n  AE: ${e.host}` : ""}`)].join("\n");
}
