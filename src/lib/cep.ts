// Мост панель → After Effects. В CEP это window.__adobe_cep__.evalScript.
// В обычном браузере (npm run dev) — заглушка, чтобы можно было верстать без AE.

type CepBridge = {
  evalScript: (script: string, cb?: (result: string) => void) => void;
  registerKeyEventsInterest?: (json: string) => void;
};

declare global {
  interface Window {
    __adobe_cep__?: CepBridge;
    cep?: { util?: { openURLInDefaultBrowser?: (url: string) => void } };
  }
}

export const inAE = (): boolean => typeof window !== "undefined" && !!window.__adobe_cep__;

export type HostResult = { ok: true; [k: string]: unknown } | { ok: false; code: string; [k: string]: unknown };

/** Вызывает AEA.run(name, args) в ExtendScript и возвращает разобранный ответ. */
export function callHost(name: string, args: Record<string, unknown> = {}): Promise<HostResult> {
  // JSON — валидный литерал объекта для ES3, поэтому передаём аргументы как есть.
  const script = `AEA.run(${JSON.stringify(name)}, ${JSON.stringify(args)})`;
  const bridge = window.__adobe_cep__;
  if (!bridge) return mockHost(name);

  return new Promise((resolve) => {
    bridge.evalScript(script, (raw) => {
      if (raw === "EvalScript error.") { resolve({ ok: false, code: "HOST_NOT_LOADED" }); return; }
      try { resolve(JSON.parse(raw) as HostResult); } catch { resolve({ ok: false, code: "BAD_RESPONSE", raw }); }
    });
  });
}

/** Открыть ссылку в браузере по умолчанию (в AE) или в новой вкладке (в браузере). */
export function openUrl(url: string) {
  const open = window.cep?.util?.openURLInDefaultBrowser;
  if (open) open(url); else window.open(url, "_blank", "noopener");
}

/**
 * Просим AE отдавать панели сочетания клавиш, иначе Ctrl+K откроет настройки композиции.
 * Коды клавиш Windows: K = 75. На macOS — 40.
 */
export function registerShortcuts() {
  const reg = window.__adobe_cep__?.registerKeyEventsInterest;
  if (!reg) return;
  const digitsWin = [49, 50, 51, 52, 53, 54, 55, 56, 57];      // 1..9 на Windows
  const digitsMac = [18, 19, 20, 21, 23, 22, 26, 28, 25];      // 1..9 на macOS
  reg(JSON.stringify([
    { keyCode: 75, ctrlKey: true },
    { keyCode: 40, metaKey: true },
    ...digitsWin.map((keyCode) => ({ keyCode, ctrlKey: true })),
    ...digitsMac.map((keyCode) => ({ keyCode, metaKey: true })),
  ]));
}

function mockHost(name: string): Promise<HostResult> {
  const fake: Record<string, HostResult> = {
    "system.ping": { ok: true, appVersion: "браузер", hasComp: false },
    "ae.readEase": { ok: true, curve: [0.33, 0, 0.67, 1], property: "Position", manual: { outSpeed: 0, outInfluence: 33, inSpeed: 0, inInfluence: 33 } },
    "ae.textCopyStyle": { ok: true, style: { font: "Inter-Bold", fontSize: 96 }, from: "Заголовок" },
    "ae.compInfo": { ok: true, comp: { name: "Демо", width: 1920, height: 1080, fps: 25, duration: 10, time: 1, numLayers: 2, selectedCount: 1, markers: [], layers: [{ index: 1, name: "Логотип", kind: "image", selected: true }, { index: 2, name: "Фон", kind: "solid", selected: false }] } },
    "ae.create": { ok: true, layer: "Слой", parented: 0 },
    "ae.element": { ok: true, layer: "Элемент" },
    "ae.precompose": { ok: true, comp: "Прекомпоз", changed: 2 },
    "ae.projectStart": { ok: true, folders: 17, comp: "Main Edit v01", compCreated: true, width: 1080, height: 1920, fps: 30, moved: 4, by: { video: 2, music: 1, png: 1 } },
    "ae.organize": { ok: true, moved: 3, by: { video: 2, sfx: 1 } },
    "ae.animCapture": { ok: true, anim: { v: 1, from: "Заголовок", text: true, groups: [], markers: [{ c: "TR In", d: 0, edge: "in", t: 0.8 }], stats: { props: 4, keys: 6, effects: 2, animators: 1, markers: 1 } } },
    "ae.safeZone": { ok: true, layer: "PA Safe Reels" },
    "ae.projectInfo": { ok: true, numItems: 5, file: null, revision: 40 },
    "ae.unprecompose": { ok: true, precomps: 3, layers: 7, removedComps: 3, remap: 0, stretch: 0, effects: 0 },
  };
  const r = fake[name] ?? { ok: true, changed: 2, skipped: { locked: 0, noPosition: 0, expression: 0 }, mock: true };
  return new Promise((res) => setTimeout(() => res(r), 200));
}
