// Собирает папку расширения: client/ (Vite) + CSXS/manifest.xml + host/index.jsx + .debug
import fs from "node:fs";
import path from "node:path";
import { bundleHost } from "./host-bundle.mjs";

const root = path.resolve(".");
const out = path.join(root, "dist", "com.aeassistant.panel");
fs.cpSync(path.join(root, "cep/CSXS"), path.join(out, "CSXS"), { recursive: true });
fs.cpSync(path.join(root, "cep/.debug"), path.join(out, ".debug"));
fs.mkdirSync(path.join(out, "host"), { recursive: true });
fs.writeFileSync(path.join(out, "host", "index.jsx"), bundleHost(root));
console.log(`Расширение собрано: ${out}`);
