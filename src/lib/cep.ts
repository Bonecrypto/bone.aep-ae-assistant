// Мост панель → After Effects. В CEP это window.__adobe_cep__.evalScript.
// В обычном браузере (npm run dev) — заглушка, чтобы можно было верстать без AE.

type CepBridge = { evalScript: (script: string, cb?: (result: string) => void) => void };

declare global {
  interface Window { __adobe_cep__?: CepBridge }
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
      if (raw === "EvalScript error.") {
        resolve({ ok: false, code: "HOST_NOT_LOADED" });
        return;
      }
      try {
        resolve(JSON.parse(raw) as HostResult);
      } catch {
        resolve({ ok: false, code: "BAD_RESPONSE", raw });
      }
    });
  });
}

function mockHost(name: string): Promise<HostResult> {
  return new Promise((r) =>
    setTimeout(() => r(name === "system.ping"
      ? { ok: true, appVersion: "браузер", hasComp: false }
      : { ok: true, changed: 2, skipped: { locked: 0, noPosition: 0, expression: 0 }, mock: true }), 250),
  );
}
