// Быстрая проверка host/*.jsx: синтаксис и отсутствие не-ASCII символов.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("host");
let bad = false;
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".jsx"))) {
  const src = fs.readFileSync(path.join(dir, f), "utf8");
  // Комментарии на русском допустимы, а строки в коде — нет.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const m = code.match(/[^\x00-\x7f]/);
  if (m) { console.error(`${f}: не-ASCII символ в коде «${m[0]}» — используйте \\uXXXX`); bad = true; }
  try { new Function(src.replace(/\$\.global/g, "globalThis")); }
  catch (e) { console.error(`${f}: синтаксическая ошибка — ${e.message}`); bad = true; }
  if (/=>|\blet\b|\bconst\b|`/.test(code)) { console.error(`${f}: синтаксис новее ES3 (=>, let, const, \`)`); bad = true; }
}
if (bad) process.exit(1);
console.log("host: ок");
