import { useEffect, useRef, useState } from "react";
import { callHost, inAE } from "./lib/cep";
import { tools } from "./tools/registry";
import type { Tool } from "./tools/types";
import { stubProvider, type ChatMessage } from "./chat/provider";
import { IconArrowRight, IconChat, IconSend, IconSparkles } from "./ui/icons";

type Tab = "actions" | "chat";
type Status = { kind: "idle" | "busy" | "ok" | "error"; text: string };

export function App() {
  const [tab, setTab] = useState<Tab>("actions");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "Подключение к After Effects…" });

  useEffect(() => {
    callHost("system.ping").then((r) => {
      if (r.ok) setStatus({ kind: "idle", text: inAE() ? `After Effects ${String(r.appVersion)} · готов` : "Режим браузера: AE не подключён" });
      else setStatus({ kind: "error", text: "Скрипт панели не загрузился в AE. Переоткройте панель." });
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

      <footer className={`status status-${status.kind}`} role="status">
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

function Actions({ setStatus }: { setStatus: (s: Status) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (tool: Tool<any>, input: Record<string, unknown>) => {
    setBusy(tool.name);
    setStatus({ kind: "busy", text: `${tool.title}…` });
    try {
      const r = await tool.run(input);
      setStatus({ kind: r.ok ? "ok" : "error", text: r.message });
    } catch (e) {
      setStatus({ kind: "error", text: `Не удалось выполнить: ${String(e)}` });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="actions">
      <div className="chips"><span className="chip active">Анимации</span></div>
      <div className="grid">
        {tools.map((t) => (
          <button key={t.name} className="tile" disabled={busy !== null} onClick={() => run(t, { direction: "left" })}
            title={`${t.title}: выделенные слои влетают из-за левого края в текущую позицию за 0,6 с от текущего времени. Один Ctrl+Z отменит.`}>
            <div className="preview"><span className="ghost" /><span className="box" /></div>
            <div className="tile-label"><IconArrowRight />{busy === t.name ? "Применяю…" : t.title}</div>
          </button>
        ))}
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
