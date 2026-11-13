import { layersWord, plural } from "../../lib/format";
import { hostTool, undoHint } from "../host-tool";

const BY: Record<string, string> = { main: "Main", precomps: "Precomps", video: "Video", photo: "Photo", png: "PNG", vectors: "Vectors", music: "Music", sfx: "SFX", voice: "Voice", logos: "Logos", solids: "Solids & Nulls" };
const byText = (by: Record<string, number> | undefined) => Object.entries(by ?? {}).map(([k, n]) => `${BY[k] ?? k}: ${n}`).join(", ");

type StartArgs = { folders: string[]; dest: Record<string, string>; organize: boolean; comp: { name: string; width: number; height: number; fps: number; duration: number } | null; mainName: string };

export const projectStart = hostTool<StartArgs>({
  name: "ae.projectStart",
  title: () => "Старт проекта",
  description: "Готовит проект: папки по шаблону (без дублей), главная композиция в 01 Comps/Main, раскладка элементов из корня по папкам. Одна отмена.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => {
    const parts = [`Создано папок: ${Number(r.folders) || 0}`];
    if (r.comp) parts.push(`${r.compCreated ? "композиция" : "композиция уже была"} ${r.comp} ${r.width}×${r.height} ${Math.round(Number(r.fps) * 100) / 100} fps`);
    if (Number(r.moved)) parts.push(`разложено: ${r.moved} (${byText(r.by as Record<string, number>)})`);
    return `${parts.join(", ")}.${undoHint}`;
  },
});

export const organize = hostTool<{ dest: Record<string, string>; mainName: string }>({
  name: "ae.organize",
  title: () => "Разложить по папкам",
  description: "Раскладывает элементы из корня проекта по папкам шаблона (видео, фото, PNG, векторы, музыка/SFX/голос, логотипы, solid-ы, композиции). Свои папки не трогает.",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => (Number(r.moved) ? `Разложено ${Number(r.moved)} ${plural(Number(r.moved), "элемент", "элемента", "элементов")}: ${byText(r.by as Record<string, number>)}.${undoHint}` : "В корне проекта нечего раскладывать."),
});

export const safeZone = hostTool<{ kind: string; name: string }>({
  name: "ae.safeZone",
  title: (i) => `Безопасная зона ${i.name ?? ""}`,
  description: "Создаёт в активной композиции направляющий слой безопасной зоны (Guide Layer — не попадает в рендер).",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r) => `«${String(r.layer)}» — направляющий слой: виден в работе, в рендер не попадает.${undoHint}`,
});

export const safeZoneToggle = hostTool<{ action: "hide" | "show" | "delete" }>({
  name: "ae.safeZoneToggle",
  title: (i) => (i.action === "delete" ? "Удалить зоны" : i.action === "hide" ? "Скрыть зоны" : "Показать зоны"),
  description: "Скрывает, показывает или удаляет слои «PA Safe».",
  inputSchema: { type: "object", properties: {} },
  mutates: true,
  done: (r, i) => `${i.action === "delete" ? "Удалено" : i.action === "hide" ? "Скрыто" : "Показано"}: ${layersWord(Number(r.changed) || 0)}.${undoHint}`,
});

export const orderLayers = hostTool<{ direction: "down" | "up"; scope: "all" | "selected"; audio: "together" | "bottom" | "top" }>({
  name: "ae.orderLayers",
  title: () => "Порядок слоёв по времени",
  description: "Упорядочивает слои в таймлайне по времени начала: direction=down — ранние сверху (лесенка вниз), up — ранние снизу. audio=bottom/top — звук отдельным блоком. Залоченные и «PA Safe» не трогает.",
  inputSchema: { type: "object", properties: {
    direction: { type: "string", enum: ["down", "up"], description: "Лесенка вниз или вверх." },
    scope: { type: "string", enum: ["all", "selected"], description: "Все слои или выделенные." },
    audio: { type: "string", enum: ["together", "bottom", "top"], description: "Куда звук." } }, required: ["direction"] },
  mutates: true,
  done: (r) => `Упорядочено: ${layersWord(Number(r.changed) || 0)}.${undoHint}`,
});
