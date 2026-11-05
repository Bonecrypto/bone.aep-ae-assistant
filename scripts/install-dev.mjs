// Установка панели для разработки (без подписи .zxp).
// 1) включает PlayerDebugMode для CEP 11–13, 2) копирует сборку в папку расширений пользователя.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const id = "com.aeassistant.panel";
const src = path.resolve("dist", id);
if (!fs.existsSync(path.join(src, "CSXS", "manifest.xml"))) {
  console.error("Сначала соберите панель: npm run build");
  process.exit(1);
}

let extDir;
if (process.platform === "win32") {
  for (const v of [11, 12, 13]) {
    execFileSync("reg", ["add", `HKCU\\Software\\Adobe\\CSXS.${v}`, "/v", "PlayerDebugMode", "/t", "REG_SZ", "/d", "1", "/f"], { stdio: "ignore" });
  }
  extDir = path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Adobe", "CEP", "extensions");
} else if (process.platform === "darwin") {
  for (const v of [11, 12, 13]) execFileSync("defaults", ["write", `com.adobe.CSXS.${v}`, "PlayerDebugMode", "1"]);
  extDir = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");
} else {
  console.error("After Effects работает только на Windows и macOS.");
  process.exit(1);
}

const dest = path.join(extDir, id);
fs.mkdirSync(extDir, { recursive: true });
fs.rmSync(dest, { recursive: true, force: true }); // удаляем только свою прошлую копию панели
fs.cpSync(src, dest, { recursive: true });
console.log(`Установлено в: ${dest}`);
console.log("Перезапустите After Effects → Окно → Расширения → AE Assistant.");
console.log("Отладка панели: http://localhost:8860");
