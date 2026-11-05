import { useEffect, useMemo, useRef, useState } from "react";
import { matchScore, type Command } from "../commands";
import { setPrefs, usePrefs } from "../lib/store";
import { IconSearch, IconStar } from "./icons";

/** Палитра команд (Ctrl+K): поиск по всем действиям, понимает неправильную раскладку. */
export function Palette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { favorites } = usePrefs();

  const items = useMemo(() => {
    if (!q.trim()) {
      const fav = commands.filter((c) => favorites.includes(c.id));
      const rest = commands.filter((c) => !favorites.includes(c.id));
      return [...fav, ...rest];
    }
    return commands.map((c) => ({ c, s: matchScore(c, q) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || Number(favorites.includes(b.c.id)) - Number(favorites.includes(a.c.id))).map((x) => x.c);
  }, [q, commands, favorites]);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => setSel(0), [q]);
  useEffect(() => { list.current?.querySelector(".pal-item.sel")?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const run = (c?: Command) => { if (!c) return; onClose(); c.run(); };
  const toggleFav = (id: string) => setPrefs({ favorites: favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id] });

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pal-search">
          <IconSearch />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти действие… (влёт, wiggle, null)"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(items[sel]); }
              else if (e.key === "Escape") onClose();
            }} />
        </div>
        <div className="pal-list" ref={list}>
          {items.length === 0 && <div className="empty">Ничего не нашлось</div>}
          {items.map((c, i) => (
            <div key={c.id} className={`pal-item${i === sel ? " sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              <span className="pal-title">{c.title}</span>
              <span className="pal-group">{c.group}</span>
              <button className={`pal-fav${favorites.includes(c.id) ? " on" : ""}`} title="В избранное — будет сверху"
                onClick={(e) => { e.stopPropagation(); toggleFav(c.id); }}><IconStar /></button>
            </div>
          ))}
        </div>
        <div className="pal-foot">↑↓ выбрать · Enter выполнить · Esc закрыть</div>
      </div>
    </div>
  );
}
