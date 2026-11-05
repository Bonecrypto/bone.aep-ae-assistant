import { useEffect, useSyncExternalStore } from "react";
import { getPrefs, setPrefs } from "./store";

/*
 * Библиотека пользователя: папка на диске (можно в облаке — Google Drive, Dropbox, OneDrive).
 *   Подпапки = категории. Файл = элемент. Превью = файл с тем же именем (.mp4/.webm/.gif/.png/.jpg)
 *   рядом или в подпапке _previews. Файлы и папки, начинающиеся с «.» или «_», не показываются.
 * Панель следит за папкой и помечает новое и изменённое.
 */
export type LibKind = "template" | "preset" | "video" | "image" | "audio";
export type LibItem = { path: string; name: string; ext: string; kind: LibKind; category: string; root: string; preview?: string; mtime: number; size: number };

const KIND: Record<string, LibKind> = {
  aep: "template", aepx: "template", ffx: "preset",
  mp4: "video", mov: "video", webm: "video", avi: "video", m4v: "video", mxf: "video",
  png: "image", jpg: "image", jpeg: "image", psd: "image", ai: "image", gif: "image", tif: "image", tiff: "image", exr: "image", tga: "image",
  wav: "audio", mp3: "audio", aif: "audio", aiff: "audio", m4a: "audio", aac: "audio",
};
const PREVIEW_EXT = ["mp4", "webm", "gif", "png", "jpg", "jpeg"];
export const KIND_LABEL: Record<LibKind, string> = { template: "Шаблон", preset: "Пресет", video: "Видео", image: "Картинка", audio: "Звук" };
export const hostKind = (k: LibKind) => (k === "template" ? "template" : k === "preset" ? "preset" : "footage");

type NodeRequire = (m: string) => any;
const nodeRequire = (): NodeRequire | null => {
  const w = window as any;
  return typeof w.require === "function" ? w.require : typeof w.cep_node?.require === "function" ? w.cep_node.require : null;
};
export const libraryAvailable = () => !!nodeRequire();

/** Путь -> file:// URL (для превью). Кириллица, пробелы и # кодируются. */
export function fileUrl(p: string) {
  const parts = p.replace(/\\/g, "/").split("/");
  return "file:///" + parts.filter((x, i) => x || i > 0).map((s, i) => (i === 0 && /^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join("/").replace(/^\/+/, "");
}

function scanRoot(req: NodeRequire, root: string): LibItem[] {
  const fs = req("fs"), path = req("path");
  const items: LibItem[] = [];
  const walk = (dir: string, depth: number) => {
    let entries: any[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const files = entries.filter((e) => e.isFile()).map((e) => e.name as string);
    const previewsDir = path.join(dir, "_previews");
    const previewFiles: string[] = fs.existsSync(previewsDir) ? fs.readdirSync(previewsDir) : [];
    const baseOf = (f: string) => f.replace(/\.[^.]+$/, "");
    const extOf = (f: string) => (f.includes(".") ? f.split(".").pop()!.toLowerCase() : "");
    // база имён шаблонов/пресетов: медиафайл с таким же именем рядом — это превью, а не отдельный элемент
    const mainBases = new Set(files.filter((f) => ["template", "preset"].includes(KIND[extOf(f)])).map((f) => baseOf(f).toLowerCase()));
    for (const f of files) {
      if (f.startsWith(".") || f.startsWith("_")) continue;
      const ext = extOf(f), kind = KIND[ext];
      if (!kind) continue;
      const isMain = kind === "template" || kind === "preset";
      if (!isMain && PREVIEW_EXT.includes(ext) && mainBases.has(baseOf(f).toLowerCase())) continue;
      const full = path.join(dir, f);
      let st: any;
      try { st = fs.statSync(full); } catch { continue; }
      const findPreview = () => {
        const b = baseOf(f).toLowerCase();
        for (const pe of PREVIEW_EXT) {
          const same = files.find((x) => x !== f && x.toLowerCase() === `${b}.${pe}`);
          if (same) return path.join(dir, same);
          const inDir = previewFiles.find((x) => x.toLowerCase() === `${b}.${pe}`);
          if (inDir) return path.join(previewsDir, inDir);
        }
        return kind === "image" && ["png", "jpg", "jpeg", "gif"].includes(ext) ? full : kind === "video" && ["mp4", "webm"].includes(ext) ? full : undefined;
      };
      const rel = path.relative(root, dir).split(path.sep).filter(Boolean).join(" / ");
      items.push({ path: full, name: baseOf(f), ext, kind, category: rel || "Разное", root, preview: findPreview(), mtime: st.mtimeMs, size: st.size });
    }
    if (depth < 4) for (const e of entries) if (e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_")) walk(path.join(dir, e.name), depth + 1);
  };
  walk(root, 0);
  return items;
}

// ---------- хранилище со слежением за папками ----------
type State = { items: LibItem[]; scanning: boolean; error: string };
let state: State = { items: [], scanning: false, error: "" };
const ls = new Set<() => void>();
const set = (s: Partial<State>) => { state = { ...state, ...s }; ls.forEach((l) => l()); };
let watchers: any[] = [];
let timer: any = null;

export function rescan() {
  const req = nodeRequire();
  const folders = getPrefs().libraryFolders;
  if (!req) { set({ items: demoItems(), scanning: false, error: "" }); return; }
  set({ scanning: true });
  const fs = req("fs");
  const items: LibItem[] = [];
  const missing: string[] = [];
  for (const f of folders) { if (fs.existsSync(f)) items.push(...scanRoot(req, f)); else missing.push(f); }
  items.sort((a, b) => a.category.localeCompare(b.category, "ru") || a.name.localeCompare(b.name, "ru"));
  // первый просмотр папки: всё, что уже было, не считается «новым»
  const p = getPrefs();
  const fresh = folders.filter((f) => !p.libraryKnownRoots.includes(f));
  if (fresh.length) {
    const seen = { ...p.librarySeen };
    for (const it of items) if (fresh.includes(it.root)) seen[it.path] = it.mtime;
    setPrefs({ librarySeen: seen, libraryKnownRoots: [...p.libraryKnownRoots, ...fresh] });
  }
  set({ items, scanning: false, error: missing.length ? `Папка не найдена: ${missing.join(", ")}` : "" });
}

function watchAll() {
  const req = nodeRequire();
  watchers.forEach((w) => { try { w.close(); } catch { /* уже закрыт */ } });
  watchers = [];
  if (!req) return;
  const fs = req("fs");
  for (const f of getPrefs().libraryFolders) {
    try {
      watchers.push(fs.watch(f, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rescan, 700); }));
    } catch { /* папка недоступна — увидим при сканировании */ }
  }
}

export function useLibrary() {
  const folders = getPrefs().libraryFolders.join("|");
  useEffect(() => { rescan(); watchAll(); }, [folders]);
  return useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l); }, () => state);
}

export const isNew = (it: LibItem) => { const s = getPrefs().librarySeen[it.path]; return !s || s < it.mtime; };
export function markSeen(items: LibItem[]) {
  const seen = { ...getPrefs().librarySeen };
  for (const it of items) seen[it.path] = it.mtime;
  setPrefs({ librarySeen: seen });
}

export function addFolder(path: string) {
  const p = getPrefs();
  if (!p.libraryFolders.includes(path)) setPrefs({ libraryFolders: [...p.libraryFolders, path] });
}
export function removeFolder(path: string) {
  const p = getPrefs();
  setPrefs({ libraryFolders: p.libraryFolders.filter((f) => f !== path) });
}

/** Создаёт в папке подпапки-образец и памятку (ничего не удаляет и не перезаписывает). */
export function createStructure(root: string) {
  const req = nodeRequire();
  if (!req) return;
  const fs = req("fs"), path = req("path");
  for (const d of ["Шаблоны", "Переходы", "Пресеты", "Элементы", "Звуки", "Фоны"]) fs.mkdirSync(path.join(root, d), { recursive: true });
  const readme = path.join(root, "_КАК ПОЛЬЗОВАТЬСЯ.txt");
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, README, "utf8");
}

const README = `Библиотека AE Assistant
========================

Подпапки — это категории в панели. Кладите файлы, панель увидит их сама и пометит как «Новое».

Что можно класть:
  .aep          шаблон: его главная композиция встанет в активную композицию в текущее время.
                Главная = композиция с тем же именем, что и файл (иначе та, что не вложена в другие).
                Если в главной композиции есть маркер — этот момент совпадёт с текущим временем.
                Для переходов ставьте маркер на момент склейки.
  .ffx          пресет анимации: применится к выделенным слоям
                (без выделения — на новый корректирующий слой от текущего времени).
  видео, картинки, звуки — добавятся в композицию в текущее время.

Превью: файл с тем же именем рядом или в подпапке _previews:
  Переход зум.aep  +  Переход зум.mp4   (или .webm, .gif, .png, .jpg)

Папки «Переходы» (и любые с «переход» в названии) показываются ещё и во вкладке «Переходы».
Файлы и папки, начинающиеся с «_» или «.», не показываются.
Папку можно держать в Google Drive / Dropbox / OneDrive — тогда она обновляется на всех компьютерах.
`;

function demoItems(): LibItem[] {
  const mk = (name: string, ext: string, category: string, mtime = 1): LibItem => ({ path: `C:/Библиотека/${category}/${name}.${ext}`, name, ext, kind: KIND[ext], category, root: "C:/Библиотека", mtime, size: 1 });
  return [
    mk("Зум-переход", "aep", "Переходы"), mk("Хлыст вправо", "aep", "Переходы"), mk("Свет-вспышка", "ffx", "Переходы"),
    mk("Титр Lower Third", "aep", "Шаблоны"), mk("Заголовок неон", "aep", "Шаблоны", Date.now()),
    mk("Вжух", "wav", "Звуки"), mk("Клик", "wav", "Звуки"), mk("Стрелка", "png", "Элементы"), mk("Пыль", "mp4", "Фоны"),
    mk("Плавный въезд", "ffx", "Пресеты"),
  ];
}

export const getLibraryItems = () => state.items;
