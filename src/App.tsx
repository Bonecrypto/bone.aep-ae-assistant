import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { callHost, inAE } from "./lib/cep";
import { animate, animTitle, type AnimateInput, type AnimMode } from "./tools/ae/animate";
import { stubProvider, type ChatMessage } from "./chat/provider";
import { AnimPreview } from "./ui/AnimPreview";
import { IconChat, IconSend, IconSparkles } from "./ui/icons";

type Tab = "actions" | "chat";
type Status = { kind: "idle" | "busy" | "ok" | "error"; text: string };

// Удобства для одного пользователя: помним вкладку, режим и длительность.
const load = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(`aea.${key}`); return v === null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
};
const save = (key: string, v: unknown) => { try { localStorage.setItem(`aea.${key}`, JSON.stringify(v)); } catch { /* нет хранилища */ } };

export function App() {
  const [tab, setTab] = useState<Tab>(() => load<Tab>("tab", "actions"));
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "Подключение к After Effects…" });

  useEffect(() => save("tab", tab), [tab]);
  useEffect(() => {
    callHost("system.ping").then((r) => {
      if (!r.ok) { setStatus({ kind: "error", text: "Скрипт панели не загрузился в AE. Переоткройте панель." }); return; }
      const ver = String(r.appVersion).split("x")[0];
      setStatus({ kind: "idle", text: inAE() ? `After Effects ${ver} · готов` : "Режим браузера: AE не подключён" });
    });
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand"><span className="dot" />Ассистент</div>
        <nav className="tabs" role="tablist">
          <TabButton active={tab === "actions"} onClick={() => setTab("actions")} title="Действия"><IconSparkles /></TabButton>
          <TabButton active={tab === "chat"} onClick={() => setTab("chat")} title="Чат с ассистентом"><IconChat /></TabButton>
        </nav>
      </header>

      <main className="main">
        {tab === "actions" ? <Actions setStatus={setStatus} /> : <Chat />}
      </main>

      <footer className={`status status-${status.kind}`} role="status" title={status.text}>
        <span className="status-dot" />
        <span className="status-text">{status.text}</span>
      </footer>
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={props.active} className={`tab ${props.active ? "active" : ""}`} onClick={props.onClick} title={props.title}>
      {props.children}
    </button>
  );
}

const PRESETS: Omit<AnimateInput, "mode" | "duration">[] = [
  { kind: "slide", direction: "left" },
  { kind: "slide", direction: "right" },
  { kind: "slide", direction: "up" },
  { kind: "slide", direction: "down" },
  { kind: "fade" },
  { kind: "scale" },
];
const DURATIONS = [0.3, 0.6, 1];

function Actions({ setStatus }: { setStatus: (s: Status) => void }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AnimMode>(() => load<AnimMode>("mode", "in"));
  const [duration, setDuration] = useState<number>(() => load("duration", 0.6));
  useEffect(() => save("mode", mode), [mode]);
  useEffect(() => save("duration", duration), [duration]);

  const run = async (input: AnimateInput) => {
    if (busy) return;
    setBusy(true);
    setStatus({ kind: "busy", text: `${animTitle(input)}…` });
    try {
      const r = await animate.run(input);
      setStatus({ kind: r.ok ? "ok" : "error", text: r.message });
    } catch (e) {
      setStatus({ kind: "error", text: `Не удалось выполнить: ${String(e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="actions">
      <div className="toolbar">
        <div className="segmented" role="radiogroup" aria-label="Режим">
          {(["in", "out"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}
              title={m === "in" ? "Слой появляется: ключи от текущего времени к его текущему положению" : "Слой исчезает: от текущего положения за кадр"}>
              {m === "in" ? "Влёт" : "Улёт"}
            </button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Длительность">
          {DURATIONS.map((d) => (
            <button key={d} role="radio" aria-checked={duration === d} className={duration === d ? "on" : ""} onClick={() => setDuration(d)}
              title={`Длительность ${String(d).replace(".", ",")} с`}>
              {String(d).replace(".", ",")} с
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        {PRESETS.map((p) => {
          const input: AnimateInput = { ...p, mode, duration };
          const title = animTitle(input);
          const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(input); } };
          return (
            <div key={title} role="button" tabIndex={0} aria-disabled={busy} className={`tile ${busy ? "disabled" : ""}`}
              onClick={() => run(input)} onKeyDown={onKey}
              title={`${title}: выделенные слои, от текущего времени, ${String(duration).replace(".", ",")} с. Один Ctrl+Z отменит.`}>
              <AnimPreview input={input} />
              <div className="tile-label">{title}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages, thinking]);

  const send = async () => {
    const t = text.trim();
    if (!t || thinking) return;
    const history: ChatMessage[] = [...messages, { role: "user", text: t }];
    setMessages(history);
    setText("");
    setThinking(true);
    try {
      const reply = await stubProvider.reply(history);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <section className="chat">
      <div className="messages" ref={listRef}>
        {messages.length === 0 && <div className="empty">Спросите что-нибудь об анимации или вашей композиции.</div>}
        {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
        {thinking && <div className="msg assistant typing">…</div>}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишите сообщение…" />
        <button type="submit" disabled={!text.trim() || thinking} title="Отправить (Enter)"><IconSend /></button>
      </form>
    </section>
  );
}
