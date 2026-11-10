// Архивы для релиза:
//   AE-Assistant-<версия>-win.zip — панель + install.cmd / uninstall.cmd
//   AE-Assistant-<версия>-mac.zip — панель + install.command / uninstall.command (исполняемые)
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
const outDir = path.resolve("dist", "release");
fs.rmSync(outDir, { recursive: true, force: true });

function pack(platform, scripts, newline, mode) {
  const stageRoot = path.join(outDir, platform);
  const stage = path.join(stageRoot, "AE-Assistant");
  fs.mkdirSync(stage, { recursive: true });
  fs.cpSync(built, path.join(stage, id), { recursive: true });
  for (const f of scripts) {
    const text = fs.readFileSync(path.resolve("release", f), "utf8").replace(/\r?\n/g, newline);
    fs.writeFileSync(path.join(stage, f), text, { mode });
  }
  const zip = path.join(outDir, `AE-Assistant-${pkg.version}-${platform}.zip`);
  if (process.platform === "win32") execFileSync("tar", ["-a", "-cf", zip, "AE-Assistant"], { cwd: stageRoot });
  else execFileSync("zip", ["-qrX", zip, "AE-Assistant"], { cwd: stageRoot }); // zip сохраняет права: .command остаются исполняемыми
  console.log(`Архив готов: ${zip}`);
}

pack("win", ["install.cmd", "uninstall.cmd"], "\r\n", 0o644);
pack("mac", ["install.command", "uninstall.command"], "\n", 0o755);
