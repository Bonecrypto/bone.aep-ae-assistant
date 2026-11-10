import { BUILD, REPO, VERSION } from "../config";
import { callHost } from "./cep";
import { isMac } from "./platform";

// Обновления через GitHub Releases. Тег релиза: v<версия>-b<номер сборки>, архив: AE-Assistant-<версия>-win.zip.
export type Release = { tag: string; version: string; build: number; date: string; zipUrl: string | null; pageUrl: string; notes: string };

const parseTag = (tag: string) => {
  const m = /^v?(\d+\.\d+\.\d+)(?:-b(\d+))?/.exec(tag);
  return { version: m?.[1] ?? "0.0.0", build: Number(m?.[2] ?? 0) };
};
const cmpVer = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

export const isNewer = (r: Release) => {
  const c = cmpVer(r.version, VERSION);
  return c > 0 || (c === 0 && r.build > BUILD);
};
export const isCurrent = (r: Release) => cmpVer(r.version, VERSION) === 0 && r.build === BUILD;

export async function fetchReleases(): Promise<Release[]> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, { headers: { Accept: "application/vnd.github+json" } });
  if (res.status === 404) throw new Error("Репозиторий с релизами ещё не создан или закрыт.");
  if (!res.ok) throw new Error(`GitHub ответил ${res.status}.`);
  const list = (await res.json()) as any[];
  return list.filter((r) => !r.draft).map((r) => {
    const { version, build } = parseTag(r.tag_name);
    // архив под свою систему (старые релизы были только для Windows)
    const zip = (r.assets as any[]).find((a) => (isMac ? /-mac\.zip$/i : /-win\.zip$/i).test(a.name));
    return { tag: r.tag_name, version, build, date: String(r.published_at ?? "").slice(0, 10), zipUrl: zip?.browser_download_url ?? null, pageUrl: r.html_url, notes: String(r.body ?? "") };
  });
}

// ---------- установка поверх (нужен Node.js в CEP: --enable-nodejs в манифесте) ----------
type NodeRequire = (m: string) => any;
const nodeRequire = (): NodeRequire | null => {
  const w = window as any;
  return typeof w.require === "function" ? w.require : typeof w.cep_node?.require === "function" ? w.cep_node.require : null;
};
export const canSelfUpdate = () => !!nodeRequire();

function download(req: NodeRequire, url: string, dest: string, redirects = 5): Promise<void> {
  const https = req("https"), fs = req("fs");
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "AE-Assistant", Accept: "application/octet-stream" } }, (res: any) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        download(req, res.headers.location, dest, redirects - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`Загрузка: код ${res.statusCode}`)); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
      file.on("error", reject);
    }).on("error", reject);
  });
}

function copyDir(req: NodeRequire, from: string, to: string) {
  const fs = req("fs"), path = req("path");
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(req, a, b); else fs.copyFileSync(a, b);
  }
}

/** Папка установленного расширения (…/com.aeassistant.panel). */
function extensionDir(req: NodeRequire): string {
  const path = req("path");
  let p = decodeURIComponent(new URL(window.location.href).pathname);
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1); // /C:/Users/... -> C:/Users/...
  return path.resolve(path.dirname(p), "..");
}

/** Скачивает архив релиза, распаковывает и копирует поверх установленной панели. Потом перезагружает панель. */
export async function installRelease(r: Release, onStep: (s: string) => void) {
  const req = nodeRequire();
  if (!req || !r.zipUrl) throw new Error("NO_NODE");
  const fs = req("fs"), path = req("path"), os = req("os"), cp = req("child_process");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aea-update-"));
  const zip = path.join(tmp, "update.zip");
  const out = path.join(tmp, "x");
  onStep("Скачиваю…");
  await download(req, r.zipUrl, zip);

  onStep("Распаковываю…");
  if (process_platform(req) === "win32") {
    const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
    cp.execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -LiteralPath ${q(zip)} -DestinationPath ${q(out)} -Force`], { windowsHide: true });
  } else {
    cp.execFileSync("ditto", ["-x", "-k", zip, out]);
  }
  const src = path.join(out, "AE-Assistant", "com.aeassistant.panel");
  if (!fs.existsSync(path.join(src, "CSXS", "manifest.xml"))) throw new Error("В архиве нет панели.");

  onStep("Устанавливаю…");
  const dest = extensionDir(req);
  if (!fs.existsSync(path.join(dest, "CSXS", "manifest.xml"))) throw new Error(`Не нашёл папку панели: ${dest}`);
  // Сначала копируем новое поверх (старые файлы не трогаем, пока всё не скопировано),
  // потом убираем устаревшие бандлы, которых нет в новой версии.
  copyDir(req, src, dest);
  const newAssets = new Set<string>(fs.readdirSync(path.join(src, "client", "assets")));
  for (const f of fs.readdirSync(path.join(dest, "client", "assets"))) {
    if (!newAssets.has(f)) { try { fs.rmSync(path.join(dest, "client", "assets", f)); } catch { /* не критично */ } }
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  onStep("Перезапускаю панель…");
  await callHost("system.ping"); // убеждаемся, что AE свободен
  const hostFile = path.join(dest, "host", "index.jsx").replace(/\\/g, "/");
  await new Promise<void>((res) => window.__adobe_cep__?.evalScript(`$.evalFile(new File(${JSON.stringify(hostFile)}))`, () => res()) ?? res());
  window.location.reload();
}

const process_platform = (req: NodeRequire): string => req("os").platform();
