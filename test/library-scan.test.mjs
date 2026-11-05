// Сканер библиотеки на настоящей файловой системе (как User Presets из AE).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "test/.cache/library.mjs");
buildSync({ entryPoints: [path.join(root, "src/lib/library.ts")], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error", external: ["react"], define: { __APP_VERSION__: '"t"', __BUILD__: '"0"' } });
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = {};
const { scanRoot } = await import(pathToFileURL(out).href);
const req = createRequire(import.meta.url);

test("User Presets: все уровни, имена с точками, превью, ссылки (OneDrive), скрытое не показывается", () => {
  const lib = fs.mkdtempSync(path.join(os.tmpdir(), "aea-lib-"));
  const put = (rel, data = "x") => { const f = path.join(lib, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return f; };
  put("01_Text/01_Text Animations/bone.aep_left side bounce characters.ffx");
  put("01_Text/01_Text Animations/juan text animation 1.ffx");
  put("01_Text/02_Text_FX/gold.ffx");
  put("02_Transitions/01_Clean/Зум.aep"); put("02_Transitions/01_Clean/Зум.mp4");
  put("02_Transitions/01_Clean/_previews/Хлыст.gif"); put("02_Transitions/01_Clean/Хлыст.aep");
  put("03_Shakes/99_Archive/Shake Preset 10.ffx");
  put("a/b/c/d/e/f/глубоко.ffx");
  put("_служебное/скрыто.ffx"); put(".git/x.ffx"); put("01_Text/_черновик.ffx");
  // «файл только в облаке» в Node выглядит как ссылка: Dirent.isFile() === false
  const real = put("../aea-real-" + path.basename(lib) + ".ffx");
  fs.mkdirSync(path.join(lib, "04_Effects"), { recursive: true });
  fs.symlinkSync(real, path.join(lib, "04_Effects", "облачный.ffx"));

  const problems = [];
  const items = scanRoot(req, lib, problems);
  const names = items.map((i) => `${i.category} :: ${i.name}`).sort();
  assert.deepEqual(names, [
    "01_Text / 01_Text Animations :: bone.aep_left side bounce characters",
    "01_Text / 01_Text Animations :: juan text animation 1",
    "01_Text / 02_Text_FX :: gold",
    "02_Transitions / 01_Clean :: Зум",
    "02_Transitions / 01_Clean :: Хлыст",
    "03_Shakes / 99_Archive :: Shake Preset 10",
    "04_Effects :: облачный",
    "a / b / c / d / e / f :: глубоко",
  ]);
  assert.equal(problems.length, 0);
  assert.match(items.find((i) => i.name === "Зум").preview, /Зум\.mp4$/);
  assert.match(items.find((i) => i.name === "Хлыст").preview, /_previews.Хлыст\.gif$/);
  assert.equal(items.find((i) => i.name === "gold").kind, "preset");
});
