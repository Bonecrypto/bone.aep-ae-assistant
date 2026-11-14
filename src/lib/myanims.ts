import { useSyncExternalStore } from "react";

/** Сохранённая анимация: снимок со слоя (ключи, выражения, эффекты, текстовые аниматоры, маркеры). */
export type Anim = {
  v: 1; from: string; text: boolean; groups: unknown[]; markers: { c: string; d: number; edge: "in" | "out"; t: number }[];
  stats: { props: number; keys: number; effects: number; animators: number; markers: number };
};
export type SavedAnim = { id: string; name: string; created: number; anim: Anim };

const KEY = "aea.anims.v1";
let list: SavedAnim[] = load();
const listeners = new Set<() => void>();

function load(): SavedAnim[] {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as SavedAnim[]) : []; } catch { return []; }
}
function save(next: SavedAnim[]) {
  list = next;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* хранилище недоступно — живём в памяти */ }
  listeners.forEach((l) => l());
}

export const getAnims = () => list;
export function useAnims(): SavedAnim[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => list);
}

/** Уникальное имя: «Имя», «Имя 2», «Имя 3»… */
export function uniqueName(name: string) {
  const base = name.trim() || "Анимация";
  if (!list.some((a) => a.name === base)) return base;
  for (let i = 2; ; i++) if (!list.some((a) => a.name === `${base} ${i}`)) return `${base} ${i}`;
}

export function addAnim(name: string, anim: Anim): SavedAnim {
  const item = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: uniqueName(name), created: Date.now(), anim };
  save([item, ...list]);
  return item;
}
export const renameAnim = (id: string, name: string) => save(list.map((a) => (a.id === id ? { ...a, name: name.trim() || a.name } : a)));
export const removeAnim = (id: string) => save(list.filter((a) => a.id !== id));

/** Короткое описание содержимого. */
export function animSummary(a: Anim) {
  const s = a.stats, parts: string[] = [];
  if (s.keys) parts.push(`${s.keys} ключ.`);
  if (s.effects) parts.push(`эффектов: ${s.effects}`);
  if (s.animators) parts.push(`текст. аниматоров: ${s.animators}`);
  if (s.markers) parts.push(`маркеров: ${s.markers}`);
  if (!s.keys && s.props) parts.push(`свойств: ${s.props}`);
  return parts.join(" · ") || "пусто";
}

/** Файл для обмена: одна или несколько анимаций. */
export function exportJson(items: SavedAnim[]) { return JSON.stringify({ aeAssistantAnims: 1, items }, null, 1); }
export function importJson(text: string): number {
  const data = JSON.parse(text);
  const items: SavedAnim[] = Array.isArray(data?.items) ? data.items : [];
  let n = 0;
  for (const it of items) if (it?.anim?.groups) { addAnim(it.name, it.anim); n++; }
  return n;
}
