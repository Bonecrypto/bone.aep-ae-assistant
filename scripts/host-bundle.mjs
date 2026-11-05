// Склеивает host/src/*.jsx (по порядку имён) в один ExtendScript-файл.
import fs from "node:fs";
import path from "node:path";

export function bundleHost(root = process.cwd()) {
  const dir = path.join(root, "host", "src");
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsx")).sort();
  return files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n").replace("__AEA_VERSION__", version);
}
