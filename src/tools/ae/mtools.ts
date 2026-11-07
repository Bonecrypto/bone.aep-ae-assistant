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

export const extract = hostTool<Record<string, never>>({
  name: "ae.extract",
  title: () => "Достать из прекомпа",
  description: "Достаёт слои выделенного прекомпа обратно в композицию на тех же местах и во времени: слои привязываются к null с трансформацией прекомпа, сам прекомп выключается.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Из «${String(r.from)}» достано ${layersWord(Number(r.changed))}; прекомп выключен.${undoHint}`,
});

export const toShapes = hostTool<Record<string, never>>({
  name: "ae.toShapes",
  title: () => "В шейпы",
  description: "Превращает выделенные текстовые слои или слои Illustrator в шейп-слои (команды AE «Create Shapes from Text / Vector Layer»).",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Создано шейп-слоёв: ${Number(r.changed)}.${undoHint}`,
});
