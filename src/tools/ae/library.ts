import { hostTool, undoHint } from "../host-tool";
import { hostKind, KIND_LABEL, type LibItem } from "../../lib/library";
import { layersWord } from "../../lib/format";
import type { Tool } from "../types";

const BIN = "AE Assistant · Библиотека";

export const libImport = hostTool<{ item: LibItem }>({
  name: "ae.libImport",
  title: (i) => (i.item ? `${KIND_LABEL[i.item.kind]}: ${i.item.name}` : "Из библиотеки"),
  description: "Внутренний инструмент: добавить элемент библиотеки.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  toArgs: (i) => ({ path: i.item.path, kind: hostKind(i.item.kind), base: i.item.name, name: i.item.name, binName: BIN }),
  done: (r, i) => {
    if (i.item.kind === "preset") return `Пресет «${i.item.name}» применён${r.createdAdjustment ? " на новый корректирующий слой" : `: ${layersWord(Number(r.changed))}`}.${undoHint}`;
    if (!r.added) return `«${i.item.name}» в проекте (папка «${BIN}»). Откройте композицию, чтобы добавить его в неё.`;
    return `«${i.item.name}» добавлен${r.alignedToMarker ? " — маркер шаблона на текущем времени" : " в текущее время"}${r.reused ? " (из проекта, без повторного импорта)" : ""}.${undoHint}`;
  },
});

export const makePreview = hostTool<{ item: LibItem; outDir: string; sample: "text" | "shape" }>({
  name: "ae.makePreview",
  title: (i) => (i.item ? `Превью: ${i.item.name}` : "Превью"),
  description: "Внутренний инструмент: снять кадры пресета для превью.",
  inputSchema: { type: "object", properties: {} },
  mutates: false,
  toArgs: (i) => ({ preset: i.item.path, outDir: i.outDir, base: i.item.name, sample: i.sample, frames: 10, sampleText: "Текст" }),
  done: (r, i) => `Превью «${i.item.name}»${Number.isFinite(Number(r.frames)) ? `: ${Number(r.frames)} кадров` : ""}.`,
});

export const removeItems = hostTool<{ ids: number[] }>({
  name: "ae.removeItems", title: () => "Уборка", description: "Внутренний инструмент.", inputSchema: { type: "object", properties: {} }, mutates: false, done: () => "",
});

export const savePresetDialog = hostTool<Record<string, never>>({
  name: "ae.savePresetDialog", title: () => "Сохранить пресет", description: "Открывает диалог AE «Save Animation Preset».",
  inputSchema: { type: "object", properties: {} }, mutates: false, done: () => "Сохраните пресет в папку библиотеки — он сразу появится в панели.",
});

export const pickFolder = hostTool<{ prompt: string }>({
  name: "ae.pickFolder",
  title: () => "Выбор папки",
  description: "Внутренний инструмент: диалог выбора папки.",
  inputSchema: { type: "object", properties: {} },
  mutates: false,
  done: () => "",
});

export const reveal = hostTool<{ path: string }>({
  name: "ae.reveal",
  title: () => "Показать в папке",
  description: "Внутренний инструмент: открыть папку в Проводнике.",
  inputSchema: { type: "object", properties: {} },
  mutates: false,
  done: () => "Открыто в Проводнике.",
});

/** Для чата: список библиотеки и добавление по имени. */
export function libraryTools(getItems: () => LibItem[]): Tool<any>[] {
  return [
    {
      name: "library.list", title: "Библиотека", mutates: false,
      description: "Только чтение. Список элементов библиотеки пользователя (его папки с шаблонами, переходами, пресетами, звуками): имя, категория, тип. Можно отфильтровать по тексту.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "Часть имени или категории." } } },
      async run(i: { query?: string }) {
        const q = (i.query ?? "").toLowerCase();
        const list = getItems().filter((x) => !q || `${x.name} ${x.category}`.toLowerCase().includes(q)).slice(0, 80)
          .map((x) => ({ name: x.name, category: x.category, type: KIND_LABEL[x.kind] }));
        return { ok: true, undoable: false, message: `Найдено: ${list.length}`, data: { ok: true, items: list } };
      },
    },
    {
      name: "library.add", title: "Из библиотеки", mutates: true,
      description: "Добавляет элемент библиотеки по имени (и категории, если имена совпадают): шаблон — в активную композицию в текущее время, пресет — на выделенные слои, звук/видео/картинку — в текущее время.",
      inputSchema: { type: "object", properties: { name: { type: "string", description: "Имя элемента." }, category: { type: "string", description: "Категория (необязательно)." } }, required: ["name"] },
      describe: (i: { name: string }) => `Из библиотеки: ${i.name}`,
      async run(i: { name: string; category?: string }) {
        const n = i.name.toLowerCase(), c = i.category?.toLowerCase();
        const item = getItems().find((x) => x.name.toLowerCase() === n && (!c || x.category.toLowerCase() === c))
          ?? getItems().find((x) => x.name.toLowerCase().includes(n));
        if (!item) return { ok: false, undoable: false, message: `В библиотеке нет «${i.name}».` };
        return libImport.run({ item });
      },
    },
  ];
}
