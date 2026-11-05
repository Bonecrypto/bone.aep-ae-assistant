// Каждый пресет каждой вкладки: кнопка «Применить» -> панель -> evalScript -> host на имитации AE.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeContext } from "./ae-mock.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "test/.cache/e2e.mjs");
buildSync({ stdin: { contents: `export { TABS_PRESETS } from "./src/presets/all.ts"; export { SCENE_TRANSITIONS } from "./src/presets/transitions.ts";`, resolveDir: root, loader: "ts" },
  bundle: true, format: "esm", platform: "node", outfile: out, jsx: "automatic", logLevel: "error", define: { __APP_VERSION__: '"t"', __BUILD__: '"0"' } });

let h;
globalThis.window = { location: { href: "file:///x" }, __adobe_cep__: { evalScript: (script, cb) => cb(new Function("AEA", "return " + script)(h.ctx.AEA)) } };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { TABS_PRESETS } = await import(pathToFileURL(out).href);
const defaults = (p) => Object.fromEntries(p.controls.map((c) => [c.key, c.value]));

function fresh() {
  h = makeContext([]);
  const a = h.comp.attach(new h.Layer({ name: "A" }));
  const t = h.comp.attach(h.makeText("Текст", { text: "Привет мир", font: "Arial", fontSize: 50, applyFill: true, fillColor: [1, 1, 1] }));
  const pos = a.property("ADBE Transform Group").property("ADBE Position");
  pos.setValueAtTime(0, [0, 0]); pos.setValueAtTime(2, [500, 0]); pos.selectedKeysList = [1, 2];
  a.selectedProperties = [pos];
  pos.expression = "wiggle(1, 1)";
  h.comp.markerProperty.setValueAtTime(1, null); h.comp.markerProperty.setValueAtTime(2, null);
  return { a, t };
}

for (const [tab, t] of Object.entries(TABS_PRESETS)) {
  for (const p of t.presets) {
    if (!p.build) continue;
    test(`${tab}/${p.id} — ${p.title}`, async () => {
      fresh();
      const v = defaults(p);
      if ("sure" in v) v.sure = true;
      const a = p.build(v);
      const r = await a.tool.run(a.input);
      assert.equal(r.ok, true, `${r.message} ${JSON.stringify(r.data)}`);
      assert.ok(!/undefined|NaN|\[object/.test(r.message), `сообщение: ${r.message}`);
    });
  }
}
