import { callHost } from "./cep";
import { getStatusBusy } from "./busy";
import { getPrefs, setPrefs, setStatus } from "./store";
import { organize, projectStart } from "../tools/ae/project";

// Шаблон папок проекта (имена — на английском, как в индустрии).
export const DEFAULT_TEMPLATE = [
  "01 Comps", "01 Comps/Main", "01 Comps/Precomps",
  "02 Footage", "02 Footage/Video", "02 Footage/Photo",
  "03 Audio", "03 Audio/Music", "03 Audio/SFX", "03 Audio/Voice",
  "04 Graphics", "04 Graphics/Logos", "04 Graphics/PNG", "04 Graphics/Vectors",
  "05 Solids & Nulls", "06 Renders", "07 Archive",
];

const LEAF: Record<string, string> = {
  main: "Main", precomps: "Precomps", video: "Video", photo: "Photo", png: "PNG", vectors: "Vectors",
  music: "Music", sfx: "SFX", voice: "Voice", logos: "Logos", solids: "Solids & Nulls",
};

/** Куда класть каждый вид элементов: самая глубокая папка шаблона с нужным именем, иначе — стандартная. */
export function destinations(template: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, leaf] of Object.entries(LEAF)) {
    const hits = template.filter((p) => p.split("/").pop()!.trim().toLowerCase() === leaf.toLowerCase());
    hits.sort((a, b) => b.split("/").length - a.split("/").length);
    out[key] = hits[0] ?? DEFAULT_TEMPLATE.find((p) => p.endsWith(leaf))!;
  }
  return out;
}

export const COMP_PRESETS = [
  { id: "reels", label: "1080×1920", hint: "Reels / TikTok / Shorts", w: 1080, h: 1920 },
  { id: "hd", label: "1920×1080", hint: "YouTube 16:9", w: 1920, h: 1080 },
  { id: "square", label: "1080×1080", hint: "Квадрат", w: 1080, h: 1080 },
  { id: "4k", label: "3840×2160", hint: "4K", w: 3840, h: 2160 },
];

export function startArgs(withComp: boolean) {
  const p = getPrefs(), preset = COMP_PRESETS.find((x) => x.id === p.compPreset) ?? COMP_PRESETS[0];
  return {
    folders: p.projectTemplate,
    dest: destinations(p.projectTemplate),
    organize: true,
    comp: withComp ? { name: p.compName || "Main Edit v01", width: preset.w, height: preset.h, fps: p.compFps, duration: p.compDuration } : null,
    mainName: p.compName || "Main Edit v01",
  };
}

/*
 * Автоматика: раз в 4 с дешёвый запрос (число элементов, файл, ревизия).
 *  - «Папки в каждом новом проекте»: пустой новый проект (ревизия маленькая) или пустой сохранённый,
 *    который ещё не готовили — один раз.
 *  - «Раскладывать при импорте»: если элементов стало больше — разложить корень.
 */
let lastCount = -1, lastFile: string | null | undefined;
export function startProjectWatcher() {
  let stop = false;
  const tick = async () => {
    if (stop) return;
    const p = getPrefs();
    if ((p.projectAutoFolders || p.projectAutoOrganize) && !document.hidden && !getStatusBusy()) {
      const info = await callHost("ae.projectInfo");
      if (info.ok) {
        const n = Number(info.numItems), file = (info.file as string | null) ?? null, rev = Number(info.revision);
        const fresh = n === 0 && (file === null ? rev <= 3 : !p.projectsDone.includes(file));
        if (p.projectAutoFolders && fresh) {
          const r = await projectStart.run(startArgs(p.projectMakeComp));
          if (r.ok) setStatus({ kind: "ok", text: `Новый проект подготовлен. ${r.message}` });
          if (file) setPrefs({ projectsDone: [...getPrefs().projectsDone, file].slice(-200) });
        } else if (p.projectAutoOrganize && file === lastFile && lastCount >= 0 && n > lastCount) {
          const r = await organize.run({ dest: destinations(p.projectTemplate), mainName: p.compName || "Main Edit v01" });
          if (r.ok && Number(r.data && r.data.ok && r.data.moved)) setStatus({ kind: "ok", text: r.message });
        }
        lastCount = n; lastFile = file;
      }
    }
    setTimeout(tick, 4000);
  };
  tick();
  return () => { stop = true; };
}
