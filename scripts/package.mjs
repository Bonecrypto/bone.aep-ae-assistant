// Готовит архив для релиза: AE-Assistant-win.zip = панель + install.cmd + uninstall.cmd
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const id = "com.aeassistant.panel";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const built = path.resolve("dist", id);
if (!fs.existsSync(path.join(built, "CSXS", "manifest.xml"))) {
  console.error("Сначала соберите панель: npm run build");
  process.exit(1);
}

const stage = path.resolve("dist", "release", "AE-Assistant");
fs.rmSync(path.dirname(stage), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(built, path.join(stage, id), { recursive: true });
for (const f of ["install.cmd", "uninstall.cmd"]) {
  // .cmd должны иметь окончания строк CRLF, иначе cmd.exe может споткнуться
  const text = fs.readFileSync(path.resolve("release", f), "utf8").replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(path.join(stage, f), text);
}

const zip = path.resolve("dist", "release", `AE-Assistant-${pkg.version}-win.zip`);
const cwd = path.dirname(stage);
if (process.platform === "win32") execFileSync("tar", ["-a", "-cf", zip, "AE-Assistant"], { cwd });
else execFileSync("zip", ["-qr", zip, "AE-Assistant"], { cwd });
console.log(`Архив готов: ${zip}`);
