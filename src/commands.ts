import { runTool } from "./lib/actions";
import { ALL_EASE_PRESETS } from "./presets/ease";
import { TABS_PRESETS } from "./presets/all";
import { defaults } from "./presets/types";
import { ease } from "./tools/ae/ease";
import { applyPreset } from "./ui/Browser";

export type Command = { id: string; title: string; group: string; keywords: string; run: () => void };

/** Все действия панели — для палитры Ctrl+K (с параметрами по умолчанию). */
export function buildCommands(goTo: (tab: string) => void, tabTitles: Record<string, string>): Command[] {
  const c: Command[] = [];
  for (const [tab, t] of Object.entries(TABS_PRESETS)) {
    for (const p of t.presets) {
      c.push({ id: `${tab}.${p.id}`, title: p.title, group: t.title, keywords: `${p.subtitle} ${p.id} ${tab}`, run: () => applyPreset(p, defaults(p)) });
    }
  }
  for (const e of ALL_EASE_PRESETS) c.push({ id: `ease.${e.id}`, title: `Кривая: ${e.title}`, group: "Скорость", keywords: `ease easing ${e.id} ${e.hint}`, run: () => runTool(ease, { preset: e.id }) });
  for (const [id, title] of Object.entries(tabTitles)) c.push({ id: `go.${id}`, title: `Открыть: ${title}`, group: "Переход", keywords: `go tab ${id}`, run: () => goTo(id) });
  return c;
}

// ---------- поиск с исправлением раскладки ----------
const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./";
const RU = "ёйцукенгшщзхъфывапролджэячсмитьбю.";
const swap = (s: string, from: string, to: string) => [...s].map((ch) => { const i = from.indexOf(ch); return i >= 0 ? to[i] : ch; }).join("");
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

/** Подходит ли команда под запрос — с учётом неправильной раскладки (влет == dktn). */
export function matchScore(cmd: Command, query: string): number {
  const q = norm(query.trim());
  if (!q) return 1;
  const hay = norm(`${cmd.title} ${cmd.group} ${cmd.keywords}`);
  const title = norm(cmd.title);
  let best = 0;
  for (const v of [q, norm(swap(q, EN, RU)), norm(swap(q, RU, EN))]) {
    const words = v.split(/\s+/).filter(Boolean);
    if (!words.every((w) => hay.includes(w))) continue;
    best = Math.max(best, title.startsWith(v) ? 3 : title.includes(v) ? 2 : 1);
  }
  return best;
}
