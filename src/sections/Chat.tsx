import { useEffect, useRef, useState } from "react";
import { apiName, chatConfig, ChatError, complete, SYSTEM_PROMPT, type ApiMessage } from "../chat/client";
import { getStatusBusy, setBusy } from "../lib/busy";
import { getPrefs, setPrefs, setStatus } from "../lib/store";
import { tools } from "../tools/registry";
import type { Tool } from "../tools/types";
import { IconSend } from "../ui/icons";

type ToolCard = { id: string; tool: Tool<any>; args: Record<string, unknown>; state: "ask" | "running" | "done" | "rejected" | "error"; result?: string };
type Item = { kind: "user" | "assistant" | "error"; text: string } | { kind: "tool"; card: ToolCard };

const MAX_STEPS = 6;

export function ChatSection({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const history = useRef<ApiMessage[]>([{ role: "system", content: SYSTEM_PROMPT }]);
  const decisions = useRef(new Map<string, (ok: boolean) => void>());
  const abort = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cfg = chatConfig();
  const configured = !!cfg.baseUrl && (!cfg.provider.needsKey || !!cfg.key);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [items, thinking]);
  useEffect(() => () => abort.current?.abort(), []);

  const push = (it: Item) => setItems((x) => [...x, it]);
  const updateCard = (id: string, patch: Partial<ToolCard>) =>
    setItems((x) => x.map((it) => (it.kind === "tool" && it.card.id === id ? { kind: "tool", card: { ...it.card, ...patch } } : it)));

  const ask = (card: ToolCard) => new Promise<boolean>((resolve) => { decisions.current.set(card.id, resolve); push({ kind: "tool", card }); });
  const decide = (id: string, ok: boolean) => { decisions.current.get(id)?.(ok); decisions.current.delete(id); };

  async function runCall(id: string, name: string, rawArgs: string): Promise<string> {
    const tool = tools.find((t) => apiName(t.name) === name);
    if (!tool) return JSON.stringify({ ok: false, error: `Нет инструмента ${name}` });
    let args: Record<string, unknown> = {};
    try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch { return JSON.stringify({ ok: false, error: "Аргументы не JSON" }); }

    const card: ToolCard = { id, tool, args, state: tool.mutates && getPrefs().chatConfirm ? "ask" : "running" };
    if (card.state === "ask") {
      const ok = await ask(card);
      if (!ok) { updateCard(id, { state: "rejected" }); return JSON.stringify({ ok: false, error: "Пользователь отменил действие" }); }
      updateCard(id, { state: "running" });
    } else if (tool.mutates) {
      push({ kind: "tool", card });
    }
    while (getStatusBusy()) await new Promise((r) => setTimeout(r, 100));
    setBusy(true);
    try {
      const r = await tool.run(args);
      if (tool.mutates) setStatus({ kind: r.ok ? "ok" : "error", text: r.message });
      if (tool.mutates || !r.ok) updateCard(id, { state: r.ok ? "done" : "error", result: r.message });
      return JSON.stringify(r.data ?? { ok: r.ok, message: r.message });
    } finally {
      setBusy(false);
    }
  }

  const send = async () => {
    const t = text.trim();
    if (!t || thinking) return;
    setText("");
    push({ kind: "user", text: t });
    history.current.push({ role: "user", content: t });
    setThinking(true);
    abort.current = new AbortController();
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const msg = await complete(history.current, tools, abort.current.signal);
        history.current.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
        if (msg.content) push({ kind: "assistant", text: msg.content });
        if (!msg.tool_calls?.length) break;
        for (const call of msg.tool_calls) {
          const result = await runCall(call.id, call.function.name, call.function.arguments);
          history.current.push({ role: "tool", tool_call_id: call.id, content: result });
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") push({ kind: "error", text: e instanceof ChatError ? e.message : `Ошибка: ${String(e)}` });
    } finally {
      setThinking(false);
    }
  };

  const reset = () => {
    abort.current?.abort();
    decisions.current.forEach((d) => d(false));
    history.current = [{ role: "system", content: SYSTEM_PROMPT }];
    setItems([]);
  };

  return (
    <section className="chat">
      <div className="chat-head">
        <span className="hint">{cfg.provider.title} · {cfg.model || "модель не выбрана"}</span>
        <div className="inline">
          <label className="toggle small" title="Спрашивать перед каждым изменением проекта">
            <input type="checkbox" checked={getPrefs().chatConfirm} onChange={(e) => setPrefs({ chatConfirm: e.target.checked })} />
            <span className="switch" /> Подтверждать
          </label>
          {items.length > 0 && <button className="link" onClick={reset}>Новый чат</button>}
        </div>
      </div>
      <div className="messages" ref={listRef}>
        {items.length === 0 && (
          <div className="empty">
            {configured ? (
              <>Спросите об анимации или поручите действие: «сделай влёт слева с пружиной», «поставь wiggle послабее», «разложи слои по маркерам».</>
            ) : (
              <>Чтобы чат заработал, подключите модель: OpenRouter, Gemini или локальную Ollama.<br /><button className="btn primary" onClick={onOpenSettings}>Открыть настройки</button></>
            )}
          </div>
        )}
        {items.map((it, i) => it.kind === "tool" ? <ToolCardView key={it.card.id} card={it.card} decide={decide} /> : <div key={i} className={`msg ${it.kind}`}>{it.text}</div>)}
        {thinking && <div className="msg assistant typing">…</div>}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишите сообщение…" />
        <button type="submit" disabled={!text.trim() || thinking} title="Отправить (Enter)"><IconSend /></button>
      </form>
    </section>
  );
}

function ToolCardView({ card, decide }: { card: ToolCard; decide: (id: string, ok: boolean) => void }) {
  const title = card.tool.describe ? card.tool.describe(card.args) : card.tool.title;
  const code = typeof card.args.code === "string" ? card.args.code : null;
  const label = { ask: "Применить?", running: "Выполняю…", done: "Готово", rejected: "Отменено", error: "Ошибка" }[card.state];
  return (
    <div className={`toolcard ${card.state}`}>
      <div className="toolcard-head"><b>{title}</b><span>{label}</span></div>
      {code && <pre className="code">{code}</pre>}
      {!code && Object.keys(card.args).length > 0 && card.state === "ask" && <div className="toolcard-args">{summarize(card.args)}</div>}
      {card.result && <div className="toolcard-result">{card.result}</div>}
      {card.state === "ask" && (
        <div className="row between">
          <button className="btn" onClick={() => decide(card.id, false)}>Отмена</button>
          <button className="btn primary" onClick={() => decide(card.id, true)}>Применить</button>
        </div>
      )}
    </div>
  );
}

const summarize = (a: Record<string, unknown>) =>
  Object.entries(a).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");
