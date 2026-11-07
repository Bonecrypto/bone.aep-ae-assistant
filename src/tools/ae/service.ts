import { layersWord } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

export const precompose = hostTool<{ name?: string }>({
  name: "ae.precompose",
  title: () => "Прекомпоз",
  description: "Собирает выделенные слои в новую композицию (pre-compose, все атрибуты переносятся).",
  inputSchema: { type: "object", properties: { name: { type: "string", description: "Имя новой композиции." } } },
  mutates: true,
  toArgs: (i) => ({ name: i.name || "Прекомпоз" }),
  done: (r) => `Прекомпоз «${String(r.comp)}»: ${layersWord(Number(r.changed))}.${undoHint}`,
});

export const sequence = hostTool<{ mode: "time" | "markers"; stepFrames?: number; reverse?: boolean; offsetFrames?: number; groupSize?: number }>({
  name: "ae.sequence",
  title: (i) => (i.mode === "markers" ? "Разложить по маркерам" : "Разложить по очереди"),
  description:
    "Сдвигает выделенные слои во времени: mode=time — каждый следующий начинается через stepFrames кадров; " +
    "mode=markers — каждый слой начинается на очередном маркере композиции. reverse — снизу вверх.",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["time", "markers"], description: "По времени или по маркерам." },
      stepFrames: { type: "number", minimum: 0, maximum: 1000, description: "Шаг в кадрах (для time)." },
      reverse: { type: "boolean", description: "Порядок снизу вверх." },
    },
    required: ["mode"],
  },
  mutates: true,
  done: (r) => `Разложено: ${layersWord(Number(r.changed))}${Number(r.extraLayers) ? ` (маркеров не хватило на ${Number(r.extraLayers)})` : ""}.${undoHint}`,
});

export const labelByType = hostTool<Record<string, never>>({
  name: "ae.labelByType",
  title: () => "Покрасить по типу",
  description: "Красит метки слоёв по типу (текст, шейпы, прекомпы, null, корректирующие, solid, камеры, видео, картинки, звук). Без выделения — все слои.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Покрашено: ${layersWord(Number(r.changed))}.${undoHint}`,
});

export const removeUnused = hostTool<Record<string, never>>({
  name: "ae.removeUnused",
  title: () => "Убрать неиспользуемое",
  description: "Удаляет из проекта неиспользуемые исходники (File > Remove Unused Footage). Файлы на диске не трогаются.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `Убрано из проекта: ${Number(r.changed)}. Файлы на диске не тронуты.${undoHint}`,
});

export const compInfo = hostTool<{ maxLayers?: number }>({
  name: "ae.compInfo",
  title: () => "Сводка по композиции",
  description:
    "Только чтение. Возвращает активную композицию: размер, fps, длительность, текущее время, маркеры, слои " +
    "(номер, имя, тип, выделен ли, in/out, родитель, текст), а для выделенных — выделенные свойства с числом ключей и выражениями. " +
    "Вызывай перед действиями, если нужно понять, что в композиции.",
  inputSchema: { type: "object", properties: { maxLayers: { type: "number", description: "Максимум слоёв в ответе (по умолчанию 40)." } } },
  mutates: false,
  done: () => "Композиция прочитана.",
});
