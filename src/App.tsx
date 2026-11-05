import { useEffect, useMemo, useState } from "react";
import { buildCommands } from "./commands";
import { callHost, inAE, registerShortcuts } from "./lib/cep";
import { setPrefs, setStatus, usePrefs, useStatus } from "./lib/store";
import { fetchReleases, isNewer, type Release } from "./lib/update";
import { AnimateSection } from "./sections/Animate";
import { ChatSection } from "./sections/Chat";
import { CreateSection } from "./sections/Create";
import { EaseSection } from "./sections/Ease";
import { ExpressionsSection } from "./sections/Expressions";
import { ServiceSection } from "./sections/Service";
import { SettingsSection } from "./sections/Settings";
import { TextSection } from "./sections/Text";
import { Palette } from "./ui/Palette";
import { IconBraces, IconChat, IconCurve, IconGear, IconPlus, IconSearch, IconSparkles, IconText, IconWrench } from "./ui/icons";

const TABS = [
  { id: "animate", title: "Анимация", icon: IconSparkles },
  { id: "ease", title: "Скорость (графики)", icon: IconCurve },
  { id: "expr", title: "Выражения", icon: IconBraces },
  { id: "create", title: "Создать: слои, эффекты, элементы", icon: IconPlus },
  { id: "text", title: "Текст", icon: IconText },
  { id: "service", title: "Сервис", icon: IconWrench },
  { id: "chat", title: "Чат с ассистентом", icon: IconChat },
  { id: "settings", title: "Настройки и обновления", icon: IconGear },
] as const;

export function App() {
  const { tab } = usePrefs();
  const status = useStatus();
  const [palette, setPalette] = useState(false);
  const [update, setUpdate] = useState<Release | null>(null);
  const goTo = (id: string) => setPrefs({ tab: id });
  const commands = useMemo(() => buildCommands(goTo), []);

  useEffect(() => {
    registerShortcuts();
    callHost("system.ping").then((r) => {
      if (!r.ok) { setStatus({ kind: "error", text: "Скрипт панели не загрузился в AE. Переоткройте панель." }); return; }
      const ver = String(r.appVersion).split("x")[0];
      setStatus({ kind: "idle", text: inAE() ? `After Effects ${ver} · готов · Ctrl+K — поиск действий` : "Режим браузера: AE не подключён" });
    });
    // тихая проверка обновлений при запуске
    if (inAE()) fetchReleases().then((l) => setUpdate(l.find(isNewer) ?? null)).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") { e.preventDefault(); setPalette((v) => !v); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="app">
      <header className="header">
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === current.id} className={`tab${t.id === current.id ? " active" : ""}`} title={t.title} onClick={() => goTo(t.id)}>
              <t.icon />
            </button>
          ))}
        </nav>
        <button className="tab search" title="Поиск действий (Ctrl+K)" onClick={() => setPalette(true)}><IconSearch /></button>
      </header>
      <div className="title-row"><h1>{current.title.split(" (")[0].split(":")[0]}</h1>
        {update && <button className="update-pill" onClick={() => goTo("settings")} title="Открыть настройки обновлений">Обновление {update.version}</button>}
      </div>

      <main className="main">
        {current.id === "animate" && <AnimateSection />}
        {current.id === "ease" && <EaseSection />}
        {current.id === "expr" && <ExpressionsSection />}
        {current.id === "create" && <CreateSection />}
        {current.id === "text" && <TextSection />}
        {current.id === "service" && <ServiceSection />}
        {current.id === "chat" && <ChatSection onOpenSettings={() => goTo("settings")} />}
        {current.id === "settings" && <SettingsSection />}
      </main>

      <footer className={`status status-${status.kind}`} role="status" title={status.text}>
        <span className="status-dot" />
        <span className="status-text">{status.text}</span>
      </footer>

      {palette && <Palette commands={commands} onClose={() => setPalette(false)} />}
    </div>
  );
}
