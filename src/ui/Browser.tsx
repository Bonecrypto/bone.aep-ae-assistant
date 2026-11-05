import { useEffect, useMemo, useState } from "react";
import { useSelection } from "../lib/selection";
import { setPrefs, usePrefs } from "../lib/store";
import { useBusy } from "../lib/busy";
import { defaults, type Preset, type Values } from "../presets/types";
import { Controls } from "./Controls";
import { Preview } from "./Preview";
import { IconStar } from "./icons";

/** Ширина панели: на узкой список пресетов сворачивается в выпадающий. */
export function useWide(min = 470) {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return w >= min;
}

export function Sidebar({ title, presets, current, onPick, favKey }: { title: string; presets: Preset[]; current: string; onPick: (id: string) => void; favKey: string }) {
  const { favorites } = usePrefs();
  const fav = (id: string) => favorites.includes(`${favKey}:${id}`);
  const toggle = (id: string) => {
    const k = `${favKey}:${id}`;
    setPrefs({ favorites: favorites.includes(k) ? favorites.filter((f) => f !== k) : [...favorites, k] });
  };
  const favs = presets.filter((p) => fav(p.id));
  const groups: { name: string; items: Preset[] }[] = [];
  if (favs.length) groups.push({ name: "Избранное", items: favs });
  for (const p of presets) {
    const g = p.group ?? "";
    let grp = groups.find((x) => x.name === g && x.name !== "Избранное");
    if (!grp) { grp = { name: g, items: [] }; groups.push(grp); }
    grp.items.push(p);
  }
  return (
    <aside className="sidebar">
      <div className="sidebar-head"><span>{title}</span><em>{presets.length}</em></div>
      <div className="sidebar-list">
        {groups.map((g) => (
          <div key={g.name || "_"}>
            {g.name && <div className="sidebar-group">{g.name}</div>}
            {g.items.map((p) => (
              <div key={`${g.name}-${p.id}`} className={`sb-item${p.id === current ? " on" : ""}`} onClick={() => onPick(p.id)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onPick(p.id)}>
                <span className="sb-dot" />
                <span className="sb-text"><b>{p.title}</b><small>{p.subtitle}</small></span>
                <button className={`sb-fav${fav(p.id) ? " on" : ""}`} title="В избранное" onClick={(e) => { e.stopPropagation(); toggle(p.id); }}><IconStar /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Вкладка-браузер: список пресетов + превью + ползунки + «Применить». */
export function Browser({ id, title, presets, footerHint }: { id: string; title: string; presets: Preset[]; footerHint?: string }) {
  const wide = useWide();
  const sel = useSelection();
  const busy = useBusy();
  const { lastPreset } = usePrefs();
  const [cur, setCur] = useState(() => lastPreset[id] && presets.some((p) => p.id === lastPreset[id]) ? lastPreset[id] : presets[0].id);
  const [values, setValues] = useState<Record<string, Values>>({});
  const [replay, setReplay] = useState(0);
  const [open, setOpen] = useState(false);
  const preset = presets.find((p) => p.id === cur) ?? presets[0];
  const v = values[preset.id] ?? defaults(preset);
  const spec = useMemo(() => preset.preview?.(v), [preset, v]);
  const pick = (pid: string) => { setCur(pid); setOpen(false); setReplay((r) => r + 1); setPrefs({ lastPreset: { ...lastPreset, [id]: pid } }); };

  return (
    <div className={`browser${wide ? "" : " narrow"}`}>
      {wide && <Sidebar title={title} presets={presets} current={preset.id} onPick={pick} favKey={id} />}
      <section className="detail">
        <header className="detail-head">
          {wide ? (
            <div><h2>{preset.title}</h2><p>{preset.subtitle}</p></div>
          ) : (
            <button className="picker" onClick={() => setOpen(!open)}><span><b>{preset.title}</b><small>{preset.subtitle}</small></span><i>▾</i></button>
          )}
          {spec && spec.kind !== "node" && <button className="pill" onClick={() => setReplay((r) => r + 1)} title="Проиграть превью заново">Повтор ↻</button>}
        </header>
        {!wide && open && (
          <div className="picker-pop" onMouseLeave={() => setOpen(false)}>
            <Sidebar title={title} presets={presets} current={preset.id} onPick={pick} favKey={id} />
          </div>
        )}
        <div className="detail-body">
          {spec && <Preview spec={spec} replay={replay} />}
          {preset.code && <pre className="code">{preset.code(v)}</pre>}
          <Controls controls={preset.controls} values={v} onChange={(nv) => setValues({ ...values, [preset.id]: nv })} />
        </div>
        <footer className="detail-foot">
          <span>{preset.hint ? preset.hint(v, sel) : footerHint}</span>
          <button className="btn primary" disabled={busy} onClick={() => preset.run(v)}>{preset.applyLabel ?? "Применить"}</button>
        </footer>
      </section>
    </div>
  );
}
