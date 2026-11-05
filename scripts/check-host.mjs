// Проверка host-скрипта: синтаксис, только ES3, только ASCII в коде.
import { bundleHost } from "./host-bundle.mjs";

const src = bundleHost();
// Убираем комментарии, но не трогаем «//» внутри строк (простой разбор кавычек).
function stripComments(text) {
  let out = "", i = 0, q = null;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (q) { out += c; if (c === "\\") { out += n ?? ""; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'") { q = c; out += c; i++; continue; }
    if (c === "/" && n === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; continue; }
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && /[(,=:!&|?{};\n]\s*$/.test(out)) { // литерал регулярного выражения
      out += c; i++; while (i < text.length && text[i] !== "/") { if (text[i] === "\\") { out += text[i]; i++; } out += text[i]; i++; } out += "/"; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
const code = stripComments(src);
const problems = [];
const m = code.match(/[^\x00-\x7f]/);
if (m) problems.push(`не-ASCII символ в коде «${m[0]}» — используйте \\uXXXX или передавайте текст из панели`);
if (/=>|\blet\b|\bconst\b|`/.test(code)) problems.push("синтаксис новее ES3 (=>, let, const, `)");
if (/\.(forEach|map|filter|trim)\(/.test(code)) problems.push("методы ES5 (forEach/map/filter/trim) в ExtendScript недоступны");
// indexOf/lastIndexOf есть у строк (ES3), но не у массивов: строковые вызовы помечаются комментарием «// строка»
for (const line of src.split("\n")) {
  if (/\.(indexOf|lastIndexOf)\(/.test(line.replace(/\/\/.*$/, "")) && !/\/\/ строка/.test(line)) problems.push(`indexOf без пометки «// строка» (у массивов в ES3 его нет): ${line.trim()}`);
}
try { new Function(src.replace(/\$\.global/g, "globalThis")); } catch (e) { problems.push(`синтаксическая ошибка — ${e.message}`); }
if (problems.length) { for (const p of problems) console.error("host:", p); process.exit(1); }
console.log("host: ок");
