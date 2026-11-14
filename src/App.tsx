import { useEffect, useMemo, useState } from "react";
import { buildCommands } from "./commands";
import { BUILD, VERSION } from "./config";
import { callHost, inAE, registerShortcuts } from "./lib/cep";
import { startSelectionPolling, useSelection } from "./lib/selection";
import { setPrefs, setStatus, usePrefs, useStatus } from "./lib/store";
import { fetchReleases, isNewer, type Release } from "./lib/update";
import { hexToRgb, plural } from "./lib/format";
import { MOD } from "./lib/platform";
import { TABS_PRESETS } from "./presets/all";
import { ChatSection } from "./sections/Chat";
import { EaseSection } from "./sections/Ease";
import { LibrarySection } from "./sections/Library";
import { ProjectSection } from "./sections/Project";
import { startProjectWatcher } from "./lib/project";
import { libraryTransitions } from "./presets/transitions";
import { useLibrary } from "./lib/library";
import { SettingsSection } from "./sections/Settings";
import { MyAnimsSection } from "./sections/MyAnims";
import { Browser } from "./ui/Browser";
import { Palette } from "./ui/Palette";
import { Dock } from "./ui/Dock";
import { IconProject, IconFolder, IconBookmark, IconBraces, IconChat, IconCurve, IconGear, IconLayers, IconPlus, IconSearch, IconSparkles, IconText, IconWave, IconWrench } from "./ui/icons";

const TABS = [
  { id: "project", title: "Старт проекта", icon: IconProject },
  { id: "library", title: "Библиотека", icon: IconFolder },
  { id: "ease", title: "Скорость", icon: IconCurve },
  { id: "myanims", title: "Мои анимации", icon: IconBookmark },
  { id: "text", title: "Текст", icon: IconText },
  { id: "transitions", title: "Переходы", icon: IconLayers },
  { id: "styles", title: "Стили", icon: IconSparkles },
  { id: "shakes", title: "Тряска", icon: IconWave },
  { id: "expr", title: "Выражения", icon: IconBraces },
  { id: "create", title: "Создать", icon: IconPlus },
  { id: "service", title: "Сервис", icon: IconWrench },
  { id: "chat", title: "Чат с ассистентом", icon: IconChat },
] as const;

export function App() {
  const { tab, accent, theme, dock } = usePrefs();
  const status = useStatus();
  const sel = useSelection();
  const [palette, setPalette] = useState(false);
  const [update, setUpdate] = useState<Release | null>(null);
  const [recent, setRecent] = useState(false);
  const goTo = (id: string) => setPrefs({ tab: id });
  const commands = useMemo(() => buildCommands(goTo, { ...Object.fromEntries(TABS.map((t) => [t.id, t.title])), settings: "Настройки" }), []);

  useEffect(() => {
    registerShortcuts();
    callHost("system.ping").then((r) => { if (!r.ok) setStatus({ kind: "error", text: "Скрипт панели не загрузился в AE. Переоткройте панель." }); });
    const stop = startSelectionPolling();
    const stopProject = startProjectWatcher();
    if (inAE()) fetchReleases().then((l) => setUpdate(l.find(isNewer) ?? null)).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") { e.preventDefault(); setPalette((v) => !v); } };
    document.addEventListener("keydown", onKey);
    return () => { stop(); stopProject(); document.removeEventListener("keydown", onKey); };
  }, []);

  // сообщение о действии висит в строке состояния 6 секунд, потом снова видна композиция
  useEffect(() => {
    if (status.kind === "idle") return;
    setRecent(true);
    if (status.kind === "busy") return;
    const t = setTimeout(() => setRecent(false), 6000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accent);
    const [r, g, b] = hexToRgb(accent).map((x) => Math.round(x * 255));
    const mix = (k: number, to: number) => `rgb(${[r, g, b].map((c) => Math.round(c + (to - c) * k)).join(",")})`;
    root.style.setProperty("--accent-soft", `rgba(${r},${g},${b},.22)`);
    root.style.setProperty("--accent-glow", `rgba(${r},${g},${b},.4)`);
    root.style.setProperty("--accent-light", mix(0.35, 255));
    root.style.setProperty("--accent-text", theme === "light" ? mix(0.25, 0) : mix(0.55, 255));
    // текст на акцентном фоне: тёмный для светлых акцентов (Soft Lilac), иначе белый
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    root.style.setProperty("--on-accent", lum > 0.62 ? "#11001c" : "#ffffff");
    root.dataset.theme = theme;
  }, [accent, theme]);

  const current = tab === "settings" ? null : TABS.find((t) => t.id === tab) ?? TABS[0];
  const lib = useLibrary();
  const base = current && TABS_PRESETS[current.id];
  // во вкладку «Переходы» добавляются переходы из библиотеки пользователя
  const browser = base && current!.id === "transitions" ? { ...base, presets: [...base.presets, ...libraryTransitions(lib.items)] } : base;

  const info = sel.comp
    ? `${sel.comp}${sel.selected ? ` · ${sel.selected} ${plural(sel.selected, "слой", "слоя", "слоёв")}` : ""}`
    : inAE() ? "Нет активной композиции" : "Режим браузера";

  return (
    <div className="app">
      <header className="topbar">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === current?.id} className={`tab${t.id === current?.id ? " active" : ""}`} title={t.title} onClick={() => goTo(t.id)}>
              <t.icon />
            </button>
          ))}
        </nav>
        <div className="top-right">
          {update && <button className="update-dot" title={`Доступно обновление ${update.version}`} onClick={() => goTo("settings")} />}
          <button className="round" title={`Поиск действий (${MOD}K)`} onClick={() => setPalette(true)}><IconSearch /></button>
          <button className={`round${tab === "settings" ? " on" : ""}`} title="Настройки и обновления" onClick={() => goTo("settings")}><IconGear /></button>
        </div>
      </header>

      <div className="body">
      {dock && <Dock />}
      <main className="main">
        {tab === "settings" && <SettingsSection />}
        {current?.id === "ease" && <EaseSection />}
        {current?.id === "library" && <LibrarySection />}
        {current?.id === "project" && <ProjectSection />}
        {current?.id === "myanims" && <MyAnimsSection />}
        {current?.id === "chat" && <ChatSection onOpenSettings={() => goTo("settings")} />}
        {browser && <Browser key={current!.id} id={current!.id} title={browser.title} presets={browser.presets} />}
      </main>
      </div>

      <footer className={`statusbar status-${recent ? status.kind : sel.connected || !inAE() ? "ok" : "error"}`} title={recent ? status.text : info}>
        <span className="status-dot" />
        <span className="status-text">{recent ? status.text : `${sel.connected ? "Подключено" : inAE() ? "Нет связи с AE" : "Демо"} · ${info}`}</span>
        <span className="status-ver">AE Assistant {VERSION}{BUILD ? ` · ${BUILD}` : ""}</span>
      </footer>

      {palette && <Palette commands={commands} onClose={() => setPalette(false)} />}
    </div>
  );
}
