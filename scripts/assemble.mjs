// Собирает папку расширения: client/ (Vite) + CSXS/manifest.xml + host/ + .debug
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const out = path.join(root, "dist", "com.aeassistant.panel");
const copy = (from, to) => fs.cpSync(path.join(root, from), path.join(out, to), { recursive: true });

copy("cep/CSXS", "CSXS");
copy("cep/.debug", ".debug");
copy("host", "host");
console.log(`Расширение собрано: ${out}`);
