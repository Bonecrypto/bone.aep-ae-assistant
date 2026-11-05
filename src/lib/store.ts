import { useSyncExternalStore } from "react";

// Маленькое хранилище настроек панели. Сохраняется в localStorage (если доступен) —
// это удобства одного пользователя: режим, длительность, цвета, настройки чата.

export type Prefs = {
  tab: string;
  animMode: "in" | "out";
  duration: number;
  spring: boolean;
  solidColor: string;
  elementColor: string;
  elementWidth: number;
  stepFrames: number;
  textStyle: Record<string, unknown> | null;
  textStyleFrom: string;
  chatProvider: "openrouter" | "gemini" | "ollama" | "custom";
  chatBaseUrl: string;
  chatModel: string;
  chatKey: string;
  chatConfirm: boolean;
  favorites: string[];
  lastPreset: Record<string, string>;
  accent: string;
  theme: "dark" | "light";
  customCurves: { id: string; title: string; curve: [number, number, number, number] }[];
};

const defaults: Prefs = {
  tab: "transitions",
  animMode: "in",
  duration: 0.6,
  spring: false,
  solidColor: "#9f18ec",
  elementColor: "#ffffff",
  elementWidth: 8,
  stepFrames: 5,
  textStyle: null,
  textStyleFrom: "",
  chatProvider: "openrouter",
  chatBaseUrl: "",
  chatModel: "",
  chatKey: "",
  chatConfirm: true,
  favorites: [],
  lastPreset: {},
  accent: "#9f18ec",
  theme: "dark",
  customCurves: [],
};

const KEY = "aea.prefs.v1";
let state: Prefs = load();
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
    if (saved.accent === "#7f00ff") saved.accent = defaults.accent; // акцент из 0.5.1 по умолчанию -> обратно фиолетовый из ТЗ
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

export function setPrefs(patch: Partial<Prefs>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* хранилище недоступно — живём в памяти */ }
  listeners.forEach((l) => l());
}

export const getPrefs = () => state;

export function usePrefs(): Prefs {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

// ---------- строка статуса ----------
export type Status = { kind: "idle" | "busy" | "ok" | "error"; text: string };
let status: Status = { kind: "idle", text: "Подключение к After Effects…" };
const statusListeners = new Set<() => void>();
export function setStatus(s: Status) { status = s; statusListeners.forEach((l) => l()); }
export function useStatus(): Status {
  return useSyncExternalStore((l) => { statusListeners.add(l); return () => statusListeners.delete(l); }, () => status);
}
