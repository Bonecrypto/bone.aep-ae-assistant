import { TABS_PRESETS } from "../presets/all";
import { defaults } from "../presets/types";
import type { Tool } from "./types";

// Один инструмент для ИИ: применить любой пресет любой вкладки с нужными параметрами.
const catalog = Object.entries(TABS_PRESETS).map(([tab, t]) =>
  `${tab}: ` + t.presets.filter((p) => p.build).map((p) => `${p.id} (${p.title}${p.controls.length ? `; ${p.controls.map((c) => c.key).join(",")}` : ""})`).join(", "),
).join("\n");

export const applyPreset: Tool<{ tab: string; preset: string; params?: Record<string, unknown> }> = {
  name: "ae.applyPreset",
  title: "Пресет",
  description:
    "Применяет пресет панели к выделенному в AE (от текущего времени). Параметры, которых нет, берутся по умолчанию. " +
    "Общие параметры: mode=in|out (появление/исчезание), duration (с). Каталог (вкладка: id (название; параметры)):\n" + catalog,
  inputSchema: {
    type: "object",
    properties: {
      tab: { type: "string", enum: Object.keys(TABS_PRESETS), description: "Вкладка." },
      preset: { type: "string", description: "id пресета из каталога." },
      params: { type: "object", description: "Значения параметров, например { mode: \"in\", duration: 0.8, blur: 20 }." },
    },
    required: ["tab", "preset"],
  },
  mutates: true,
  describe: (i) => {
    const p = TABS_PRESETS[i.tab]?.presets.find((x) => x.id === i.preset);
    return p ? `${TABS_PRESETS[i.tab].title}: ${p.title}` : "Пресет";
  },
  async run(i) {
    const p = TABS_PRESETS[i.tab]?.presets.find((x) => x.id === i.preset);
    if (!p?.build) return { ok: false, undoable: false, message: `Нет пресета ${i.tab}/${i.preset}` };
    const a = p.build({ ...defaults(p), ...(i.params ?? {}) });
    return a.tool.run(a.input);
  },
};
