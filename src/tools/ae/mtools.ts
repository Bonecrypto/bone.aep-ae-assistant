import { layersWord, plural } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

const keysWord = (n: number) => `${n} ${plural(n, "ключ", "ключа", "ключей")}`;

export const quickEase = hostTool<{ inInfluence: number; outInfluence: number; which: "both" | "in" | "out" }>({
  name: "ae.quickEase",
  title: () => "Быстрый ease",
  description: "Ставит influence входа и/или выхода (скорость 0) прямо на каждый выделенный ключ — можно и на одиночный ключ. which: both/in/out.",
  inputSchema: { type: "object", properties: {
    inInfluence: { type: "number", minimum: 0.1, maximum: 100, description: "Influence входа, %." },
    outInfluence: { type: "number", minimum: 0.1, maximum: 100, description: "Influence выхода, %." },
    which: { type: "string", enum: ["both", "in", "out"], description: "Что менять." } }, required: ["inInfluence", "outInfluence"] },
  mutates: true,
  done: (r) => `Ease: ${keysWord(Number(r.changed))}.${undoHint}`,
});

export const cloneKeys = hostTool<Record<string, never>>({
  name: "ae.cloneKeys",
  title: () => "Клонировать ключи",
  description: "Копирует выделенные ключи в текущее время с теми же интервалами и ease (самый ранний выделенный ключ встаёт на указатель).",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Скопировано: ${keysWord(Number(r.changed))} в текущее время.${undoHint}`,
});

export const unprecompose = hostTool<{ scope: "selected" | "all"; recursive: boolean; removeLayer: boolean; removeComps: boolean }>({
  name: "ae.unprecompose",
  title: () => "Распаковать прекомпы",
  description:
    "Распаковывает прекомпы обратно в композицию (например, тексты после импорта из Premiere): scope=selected — выделенные, all — все в активной композиции; " +
    "recursive — и вложенные. Слои встают на свои места и во времени (с учётом обрезки), трансформация и прозрачность прекомпа сохраняются. " +
    "removeLayer — удалить слой прекомпа, removeComps — удалить из проекта ставшие ненужными композиции. Прекомпы с Time Remap, другой скоростью или эффектами пропускаются.",
  inputSchema: { type: "object", properties: {
    scope: { type: "string", enum: ["selected", "all"], description: "Какие прекомпы." },
    recursive: { type: "boolean", description: "Распаковывать вложенные." },
    removeLayer: { type: "boolean", description: "Удалить слой прекомпа (иначе выключить)." },
    removeComps: { type: "boolean", description: "Удалить ненужные композиции из проекта." } }, required: ["scope"] },
  mutates: true,
  toArgs: (i) => ({ ...i, holderName: "Прекомп" }),
  done: (r) => {
    const skipped = [Number(r.remap) && `с Time Remap: ${r.remap}`, Number(r.stretch) && `с другой скоростью: ${r.stretch}`, Number(r.effects) && `с эффектами: ${r.effects}`].filter(Boolean);
    return `Распаковано прекомпов: ${Number(r.precomps) || 0}, слоёв: ${Number(r.layers) || 0}${Number(r.removedComps) ? `, удалено композиций: ${r.removedComps}` : ""}${skipped.length ? ` · пропущено ${skipped.join(", ")}` : ""}.${undoHint}`;
  },
});

export const extract = hostTool<Record<string, never>>({
  name: "ae.extract",
  title: () => "Достать из прекомпа",
  description: "Достаёт слои выделенного прекомпа обратно в композицию на тех же местах и во времени, сам прекомп выключается (для полной уборки — ae.unprecompose).",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: () => ({ holderName: "Прекомп" }),
  done: (r) => `Достано ${layersWord(Number(r.changed))}; прекомп выключен.${undoHint}`,
});

export const toShapes = hostTool<Record<string, never>>({
  name: "ae.toShapes",
  title: () => "В шейпы",
  description: "Превращает выделенные текстовые слои или слои Illustrator в шейп-слои (команды AE «Create Shapes from Text / Vector Layer»).",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Создано шейп-слоёв: ${Number(r.changed)}.${undoHint}`,
});

export const carousel = hostTool<{ title?: string; mode: "slide" | "cover"; hold: number; move: number; spacing: number }>({
  name: "ae.carousel",
  title: (i) => i.title ?? "Карусель",
  description: "Карусель: выделенные слои (минимум 2, по порядку в таймлайне) по очереди выезжают в центр и стоят hold секунд; move — время переезда, spacing — расстояние между слоями, px. mode=cover — центральный крупнее, соседи меньше и прозрачнее.",
  inputSchema: { type: "object", properties: {
    mode: { type: "string", enum: ["slide", "cover"], description: "Вид." }, hold: { type: "number", description: "Пауза в центре, с." },
    move: { type: "number", description: "Переезд, с." }, spacing: { type: "number", description: "Шаг между слоями, px." } }, required: ["mode"] },
  mutates: true,
  toArgs: (i) => ({ ...i, title: undefined }),
  done: (r, i) => {
    const len = Number(r.length);
    return `${i.title ?? "Карусель"}: ${layersWord(Number(r.changed))}${Number.isFinite(len) ? `, ${String(Math.round(len * 10) / 10).replace(".", ",")} с` : ""}.${undoHint}`;
  },
});

export const mergeShapes = hostTool<Record<string, never>>({
  name: "ae.mergeShapes",
  title: () => "Слить шейпы",
  description: "Сливает выделенные шейп-слои в верхний: содержимое каждого становится группой с его трансформацией; исходные слои выключаются.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `В «${String(r.target)}» слито ${layersWord(Number(r.changed))}; исходные выключены.${Number(r.failedParams) ? ` Не всё перенеслось (${r.failedParams}).` : ""}${undoHint}`,
});

export const textCounter = hostTool<{ title: string; code: string; controls: { name: string; value: number }[]; marker: { name: string; duration: number }; fontSize?: number }>({
  name: "ae.textCounter",
  title: (i) => i.title ?? "Счётчик",
  description: "Внутренний инструмент счётчиков.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: (i) => ({ name: i.title, code: i.code, controls: i.controls, marker: i.marker, fontSize: i.fontSize }),
  done: (r, i) => {
    const err = String(r.expressionError ?? "");
    return err ? `${i.title}: ошибка выражения в AE: ${err}` : `${i.title}: текстовый слой в центре, длительность — маркер на слое.${undoHint}`;
  },
});

export const dedupeEffects = hostTool<{ scope: "selected" | "all"; mode: "copies" | "all" }>({
  name: "ae.dedupeEffects",
  title: () => "Убрать дубли эффектов",
  description:
    "Удаляет повторы эффектов на слоях: mode=copies — копии вида «Deep Glow 2» при уже стоящем «Deep Glow» того же типа (первый остаётся с настройками), " +
    "mode=all — все эффекты слоя. scope=selected — выделенные слои, all — все слои активной композиции. Заблокированные слои не трогаются.",
  inputSchema: { type: "object", properties: {
    scope: { type: "string", enum: ["selected", "all"], description: "Какие слои." },
    mode: { type: "string", enum: ["copies", "all"], description: "Только копии или все эффекты." } }, required: ["scope", "mode"] },
  mutates: true,
  done: (r) => Number(r.changed)
    ? `Убрано эффектов: ${r.changed} на ${layersWord(Number(r.layers))}.${Number(r.locked) ? ` Заблокированных пропущено: ${r.locked}.` : ""}${undoHint}`
    : `Дублей не нашлось.${Number(r.locked) ? ` Заблокированных слоёв пропущено: ${r.locked}.` : ""}`,
});
