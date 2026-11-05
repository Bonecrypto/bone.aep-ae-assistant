import type { ReactNode } from "react";
import type { Tool, ToolResult } from "../tools/types";

// Общая модель пресета для всех вкладок-браузеров: список слева, детали и ползунки справа.

export type Ctl =
  | { type: "slider"; key: string; label: string; min: number; max: number; step: number; unit?: string; value: number }
  | { type: "seg"; key: string; label: string; options: { value: string; label: string }[]; value: string }
  | { type: "toggle"; key: string; label: string; value: boolean }
  | { type: "color"; key: string; label: string; value: string };

export type Values = Record<string, any>;

/** Поза объекта превью: сдвиг (px), масштаб (1 = 100%), поворот (°), прозрачность (0..1), размытие (px), наклон (°). */
export type Pose = { x?: number; y?: number; s?: number; r?: number; o?: number; b?: number; sk?: number };

export type PreviewSpec =
  | { kind: "layers"; count: number; length: number; pose: (i: number, t: number) => Pose; label?: string }
  | { kind: "text"; text: string; unit: "chars" | "words" | "lines"; length: number; pose: (i: number, n: number, t: number) => Pose }
  | { kind: "node"; node: ReactNode };

export type Selection = { comp: string | null; selected: number; text: number; keys: number };

export type Preset = {
  id: string;
  title: string;
  subtitle: string;
  group?: string;
  controls: Ctl[];
  preview?: (v: Values) => PreviewSpec;
  /** Подсказка над кнопкой «Применить» (может зависеть от выделения). */
  hint?: (v: Values, sel: Selection) => string;
  /** Код/формула для показа (например, выражение). */
  code?: (v: Values) => string;
  applyLabel?: string;
  /** Какое действие выполнить: инструмент и его вход (так пресет может вызвать и кнопка, и ИИ в чате). */
  build?: (v: Values) => Action;
  /** Особый запуск (например, копирование стиля в память панели). */
  run?: (v: Values) => Promise<ToolResult | null>;
};

export type Action = { tool: Tool<any>; input: any };
export const act = <I,>(tool: Tool<I>, input: I): Action => ({ tool, input });

export const defaults = (p: Preset): Values => Object.fromEntries(p.controls.map((c) => [c.key, c.value]));

export const DIR_SEG: Ctl = { type: "seg", key: "mode", label: "Направление", value: "in", options: [{ value: "in", label: "Появление" }, { value: "out", label: "Исчезание" }] };
export const slider = (key: string, label: string, value: number, min: number, max: number, step: number, unit?: string): Ctl =>
  ({ type: "slider", key, label, value, min, max, step, unit });
