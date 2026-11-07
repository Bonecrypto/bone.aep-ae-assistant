import { layersWord, plural } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export const audioInfo = hostTool<Record<string, never>>({
  name: "ae.audioInfo", title: () => "Звук", description: "Внутренний инструмент: файл и время слоя со звуком.",
  inputSchema: { type: "object", properties: {} }, mutates: false, done: (r) => `Звук: «${String(r.name)}».`,
});

export const addMarkers = hostTool<{ times: number[]; comment: string; target: "comp" | "layer"; layerIndex?: number; replace: boolean }>({
  name: "ae.addMarkers", title: () => "Маркеры на биты", description: "Внутренний инструмент: маркеры по списку времён.",
  inputSchema: { type: "object", properties: {} }, mutates: true,
  done: (r) => `Маркеры на биты: ${Number(r.changed)} ${plural(Number(r.changed), "маркер", "маркера", "маркеров")}${Number(r.removed) ? ` (старых убрано: ${r.removed})` : ""}. Дальше: «Сервис → По маркерам» или «Пульс под бит».${undoHint}`,
});

export const subtitles = hostTool<{ segments: { start: number; end: number; text: string }[]; position: "bottom" | "center"; style?: Record<string, unknown> | null }>({
  name: "ae.subtitles", title: () => "Субтитры", description: "Внутренний инструмент: текстовые слои по фразам.",
  inputSchema: { type: "object", properties: {} }, mutates: true,
  done: (r) => `Субтитры: ${layersWord(Number(r.changed))} — у каждого своё время.${undoHint}`,
});

export const morph = hostTool<{ duration: number }>({
  name: "ae.morph",
  title: () => "Морфинг фигур",
  description: "Выделите две шейп-фигуры (сначала «из», потом «в»): первая перетекает во вторую от текущего времени за duration секунд, вторая выключается.",
  inputSchema: { type: "object", properties: { duration: { type: "number", description: "Длительность, с." } }, required: ["duration"] },
  mutates: true,
  done: (r) => `«${String(r.from)}» перетекает в «${String(r.to)}».${undoHint}`,
});
