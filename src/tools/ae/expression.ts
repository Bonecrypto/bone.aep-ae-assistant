import { plural } from "../../lib/format";
import { buildExpression, EXPR_PRESETS } from "../../presets/expressions";
import { hostTool, undoHint } from "../host-tool";

export type ExprInput = { preset: string; params?: Record<string, number>; linearIn?: boolean; prop?: "pos" | "scale" | "rot" | "opacity" };
const PROP_PATH = { pos: "ADBE Position", scale: "ADBE Scale", rot: "ADBE Rotate Z", opacity: "ADBE Opacity" } as const;

export const expression = hostTool<ExprInput>({
  name: "ae.expressionPreset",
  host: "ae.expression",
  title: (i) => `Выражение: ${EXPR_PRESETS.find((p) => p.id === i.preset)?.title ?? "—"}`,
  description:
    "Ставит готовое выражение на выделенные свойства выделенных слоёв (или на свойство по умолчанию) и добавляет ползунки-эффекты для настройки. " +
    `Пресеты: ${EXPR_PRESETS.map((p) => `${p.id} — ${p.title}: ${p.hint}${p.params.length ? ` (params: ${p.params.map((x) => `${x.key}=${x.value}`).join(", ")})` : ""}`).join("; ")}.`,
  inputSchema: {
    type: "object",
    properties: {
      preset: { type: "string", enum: EXPR_PRESETS.map((p) => p.id), description: "Какое выражение." },
      params: { type: "object", description: "Значения ползунков по ключам пресета, например { freq: 3, amp: 40 }." },
      prop: { type: "string", enum: ["pos", "scale", "rot", "opacity"], description: "Принудительно на это свойство (иначе выделенные свойства или свойство по умолчанию)." },
      linearIn: { type: "boolean", default: true, description: "Для inertia/bounce/elastic: сделать вход в ключи линейным, иначе при Easy Ease эффекта не будет." },
    },
    required: ["preset"],
  },
  mutates: true,
  toArgs: (i) => {
    const p = EXPR_PRESETS.find((x) => x.id === i.preset);
    if (!p) return { code: "" };
    const b = buildExpression(p, i.params ?? {}, i.linearIn ?? true);
    return i.prop ? { ...b, defaultPath: ["ADBE Transform Group", PROP_PATH[i.prop]], forceDefault: true } : b;
  },
  done: (r) => {
    const err = String(r.expressionError ?? "");
    return err ? `Выражение поставлено, но AE сообщает об ошибке: ${err}` : `Выражение поставлено: ${Number(r.changed)} ${plural(Number(r.changed), "свойство", "свойства", "свойств")}.${undoHint}`;
  },
});

/** Произвольный код выражения — только после показа пользователю и подтверждения. */
export const customExpression = hostTool<{ code: string; target?: "selected" | "position" | "rotation" | "scale" | "opacity" }>({
  name: "ae.setExpression",
  host: "ae.expression",
  title: () => "Своё выражение",
  description:
    "Ставит произвольное выражение (code) на выделенные свойства; если свойство не выделено — на target (position/rotation/scale/opacity). " +
    "Код будет показан пользователю перед выполнением. Предпочитай ae.expressionPreset, если подходит готовый пресет.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "Текст выражения After Effects (JavaScript-движок)." },
      target: { type: "string", enum: ["selected", "position", "rotation", "scale", "opacity"], description: "Свойство по умолчанию." },
    },
    required: ["code"],
  },
  mutates: true,
  toArgs: (i) => {
    const m: Record<string, string> = { position: "ADBE Position", rotation: "ADBE Rotate Z", scale: "ADBE Scale", opacity: "ADBE Opacity" };
    const t = i.target && i.target !== "selected" ? m[i.target] : undefined;
    return { code: i.code, defaultPath: t ? ["ADBE Transform Group", t] : undefined };
  },
  done: (r) => {
    const err = String(r.expressionError ?? "");
    return err ? `Выражение поставлено, но AE сообщает об ошибке: ${err}` : `Выражение поставлено.${undoHint}`;
  },
});

export const clearExpression = hostTool<Record<string, never>>({
  name: "ae.clearExpression",
  title: () => "Убрать выражения",
  description: "Удаляет выражения с выделенных свойств; если свойства не выделены — со всех свойств трансформации выделенных слоёв.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Выражения убраны: ${Number(r.changed)}.${undoHint}`,
});


// Код, который написала модель, всегда показывается и подтверждается пользователем.
customExpression.alwaysConfirm = true;
