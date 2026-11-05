import { buildExpression, EXPR_PRESETS } from "../../presets/expressions";
import { hostTool, undoHint } from "../host-tool";

export type ExprInput = { preset: string; params?: Record<string, number> };

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
    },
    required: ["preset"],
  },
  mutates: true,
  toArgs: (i) => {
    const p = EXPR_PRESETS.find((x) => x.id === i.preset);
    if (!p) return { code: "" };
    return buildExpression(p, i.params ?? {});
  },
  done: (r) => {
    const err = String(r.expressionError ?? "");
    return err ? `Выражение поставлено, но AE сообщает об ошибке: ${err}` : `Выражение поставлено: ${Number(r.changed)} ${Number(r.changed) === 1 ? "свойство" : "свойств"}.${undoHint}`;
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

