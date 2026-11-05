import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// CEF внутри AE открывает панель через file://, а module-скрипты с file:// блокируются.
// Поэтому собираем обычный IIFE-бандл и убираем type="module"/crossorigin из index.html.
const cepHtml = (): Plugin => ({
  name: "cep-html",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html
        .replace(/<script type="module" crossorigin/g, "<script defer")
        .replace(/ crossorigin/g, ""),
  },
});

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD__: JSON.stringify(process.env.GITHUB_RUN_NUMBER ?? "0"),
  },
  plugins: [react(), cepHtml()],
  build: {
    outDir: "dist/com.aeassistant.panel/client",
    emptyOutDir: true,
    target: "chrome88",
    modulePreload: false,
    rollupOptions: {
      output: { format: "iife", inlineDynamicImports: true },
    },
  },
});
