import { getPrefs, setPrefs } from "./store";
import type { Values } from "../presets/types";

/*
 * Что и как часто применяют — для панели быстрого доступа.
 * Ключ: "<вкладка>:<id пресета>", "ease:<id кривой>", "lib:<путь файла>".
 */
export function recordUse(key: string, values?: Values) {
  const p = getPrefs();
  const u = p.usage[key] ?? { n: 0, last: 0 };
  setPrefs({
    usage: { ...p.usage, [key]: { n: u.n + 1, last: Date.now() } },
    ...(values ? { lastValues: { ...p.lastValues, [key]: values } } : {}),
  });
}

/** Самые частые (минимум 2 применения), кроме уже закреплённых. */
export function frequent(limit: number, exclude: string[]): string[] {
  return Object.entries(getPrefs().usage)
    .filter(([k, u]) => u.n >= 2 && !exclude.includes(k))
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([k]) => k);
}
