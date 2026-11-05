// Проверка host-скрипта: синтаксис, только ES3, только ASCII в коде.
import { bundleHost } from "./host-bundle.mjs";

const src = bundleHost();
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const problems = [];
const m = code.match(/[^\x00-\x7f]/);
if (m) problems.push(`не-ASCII символ в коде «${m[0]}» — используйте \\uXXXX или передавайте текст из панели`);
if (/=>|\blet\b|\bconst\b|`/.test(code)) problems.push("синтаксис новее ES3 (=>, let, const, `)");
if (/\.(forEach|map|filter|indexOf|trim)\(/.test(code)) problems.push("методы ES5 (forEach/map/filter/indexOf/trim) в ExtendScript недоступны");
try { new Function(src.replace(/\$\.global/g, "globalThis")); } catch (e) { problems.push(`синтаксическая ошибка — ${e.message}`); }
if (problems.length) { for (const p of problems) console.error("host:", p); process.exit(1); }
console.log("host: ок");
