import { runTool } from "./lib/actions";
import { getPrefs, setPrefs, setStatus } from "./lib/store";
import { EASE_PRESETS } from "./presets/ease";
import { EXPR_PRESETS } from "./presets/expressions";
import { EFFECT_ITEMS, ELEMENT_ITEMS, LAYER_ITEMS } from "./presets/create";
import { animate, animTitle, motionBlur } from "./tools/ae/animate";
import { ease } from "./tools/ae/ease";
import { clearExpression, expression } from "./tools/ae/expression";
import { addEffect, createLayer, element } from "./tools/ae/create";
import { TEXT_ANIMS, textAnimate, textCopyStyle, textPasteStyle } from "./tools/ae/text";
import { labelByType, precompose, removeUnused, sequence } from "./tools/ae/service";
import { ANIM_PRESETS } from "./sections/Animate";

export type Command = { id: string; title: string; group: string; keywords: string; run: () => void };

/** Все действия панели — для палитры Ctrl+K. Параметры (длительность, цвета) берутся из текущих настроек. */
export function buildCommands(goTo: (tab: string) => void): Command[] {
  const p = getPrefs;
  const c: Command[] = [];
  for (const mode of ["in", "out"] as const) {
    for (const a of ANIM_PRESETS) {
      const t = animTitle({ ...a, mode });
      c.push({ id: `anim.${mode}.${a.kind}.${a.direction ?? ""}`, title: t, group: "Анимация", keywords: `${a.kind} ${a.direction ?? ""} ${mode} animate анимация`,
        run: () => runTool(animate, { ...a, mode, duration: p().duration, spring: p().spring }) });
    }
  }
  c.push({ id: "anim.mb", title: "Моушн-блюр", group: "Анимация", keywords: "motion blur размытие движения", run: () => runTool(motionBlur, { on: true }) });
  for (const e of EASE_PRESETS) c.push({ id: `ease.${e.id}`, title: `График: ${e.title}`, group: "Скорость", keywords: `ease easing кривая скорость ${e.id} ${e.hint}`, run: () => runTool(ease, { preset: e.id }) });
  for (const e of EXPR_PRESETS) c.push({ id: `expr.${e.id}`, title: `Выражение: ${e.title}`, group: "Выражения", keywords: `expression ${e.id} ${e.hint}`, run: () => runTool(expression, { preset: e.id }) });
  c.push({ id: "expr.clear", title: "Убрать выражения", group: "Выражения", keywords: "clear remove expression удалить", run: () => runTool(clearExpression, {}) });
  for (const l of LAYER_ITEMS) c.push({ id: `create.${l.kind}`, title: `Создать: ${l.title}`, group: "Создать", keywords: `new layer ${l.kind} ${l.hint}`, run: () => runTool(createLayer, { kind: l.kind, color: p().solidColor }) });
  for (const f of EFFECT_ITEMS) c.push({ id: `fx.${f.matchName}`, title: `Эффект: ${f.title}`, group: "Создать", keywords: `effect ${f.hint}`, run: () => runTool(addEffect, { matchName: f.matchName }) });
  for (const el of ELEMENT_ITEMS) c.push({ id: `el.${el.kind}`, title: `Элемент: ${el.title}`, group: "Создать", keywords: `shape element ${el.kind} ${el.hint}`, run: () => runTool(element, { kind: el.kind, color: p().elementColor, width: p().elementWidth, duration: Math.max(0.3, p().duration) }) });
  c.push({ id: "text.copy", title: "Копировать стиль текста", group: "Текст", keywords: "copy text style шрифт", run: async () => { const r = await runTool(textCopyStyle, {}); if (r?.ok && r.data?.ok) setPrefs({ textStyle: r.data.style as Record<string, unknown>, textStyleFrom: String(r.data.from) }); } });
  c.push({ id: "text.paste", title: "Вставить стиль текста", group: "Текст", keywords: "paste text style шрифт", run: () => { const s = p().textStyle; if (s) runTool(textPasteStyle, { style: s }); else setStatus({ kind: "error", text: "Сначала скопируйте стиль с текстового слоя." }); } });
  for (const mode of ["in", "out"] as const) for (const a of TEXT_ANIMS) c.push({ id: `text.${a.id}.${mode}`, title: `Текст по буквам: ${a.title}${mode === "out" ? " (исчезание)" : ""}`, group: "Текст", keywords: `text animator letters буквы ${a.id}`, run: () => runTool(textAnimate, { preset: a.id, mode, duration: p().duration }) });
  c.push({ id: "svc.precomp", title: "Прекомпоз", group: "Сервис", keywords: "precompose прекомпоновка", run: () => runTool(precompose, { name: "Прекомпоз" }) });
  c.push({ id: "svc.seq", title: "Разложить по очереди", group: "Сервис", keywords: "sequence stagger лесенка сдвиг", run: () => runTool(sequence, { mode: "time", stepFrames: p().stepFrames }) });
  c.push({ id: "svc.markers", title: "Разложить по маркерам", group: "Сервис", keywords: "markers sequence", run: () => runTool(sequence, { mode: "markers" }) });
  c.push({ id: "svc.labels", title: "Покрасить слои по типу", group: "Сервис", keywords: "label color метки", run: () => runTool(labelByType, {}) });
  c.push({ id: "svc.clean", title: "Убрать неиспользуемое из проекта", group: "Сервис", keywords: "remove unused footage очистить", run: () => runTool(removeUnused, {}) });
  const tabs: [string, string][] = [["animate", "Анимация"], ["ease", "Скорость"], ["expr", "Выражения"], ["create", "Создать"], ["text", "Текст"], ["service", "Сервис"], ["chat", "Чат"], ["settings", "Настройки"]];
  for (const [id, title] of tabs) c.push({ id: `go.${id}`, title: `Открыть: ${title}`, group: "Переход", keywords: `go tab ${id}`, run: () => goTo(id) });
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
