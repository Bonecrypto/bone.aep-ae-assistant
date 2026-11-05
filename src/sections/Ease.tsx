import { useState } from "react";
import { runTool } from "../lib/actions";
import { useBusy } from "../lib/busy";
import { useSelection } from "../lib/selection";
import { setPrefs, usePrefs } from "../lib/store";
import { ALL_EASE_PRESETS, type Curve } from "../presets/ease";
import type { Preset } from "../presets/types";
import { ease, readEase, type Manual } from "../tools/ae/ease";
import { CurveEditor } from "../ui/CurveEditor";
import { Sidebar, useWide } from "../ui/Browser";
import { Controls } from "../ui/Controls";
import { Seg } from "../ui/ui";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Вкладка «Скорость»: библиотека кривых слева, редактор и cubic-bezier справа. */
export function EaseSection() {
  const wide = useWide();
  const busy = useBusy();
  const sel = useSelection();
  const { customCurves, lastPreset } = usePrefs();
  const all = [...ALL_EASE_PRESETS, ...customCurves.map((c) => ({ ...c, hint: "Своя кривая", group: "Мои кривые" }))];
  const list: Preset[] = all.map((p) => ({ id: p.id, title: p.title, subtitle: p.hint, group: p.group, controls: [] }));
  const [cur, setCur] = useState(lastPreset.ease ?? all[0].id);
  const [curve, setCurve] = useState<Curve>(all.find((p) => p.id === cur)?.curve ?? all[0].curve);
  const [mode, setMode] = useState<"curve" | "manual">("curve");
  const [manual, setManual] = useState<Manual>({ outSpeed: 0, outInfluence: 75, inSpeed: 0, inInfluence: 75 });
  const [open, setOpen] = useState(false);
  const preset = all.find((p) => p.id === cur);
  const edited = !preset || preset.curve.some((v, i) => v !== curve[i]);

  const pick = (id: string) => {
    const p = all.find((x) => x.id === id);
    if (p) { setCur(id); setCurve(p.curve); setMode("curve"); setOpen(false); setPrefs({ lastPreset: { ...lastPreset, ease: id } }); }
  };
  const read = async () => {
    const r = await runTool(readEase, {});
    if (r?.ok && r.data?.ok) { setCurve((r.data.curve as number[]).map(r2) as Curve); setManual(r.data.manual as Manual); }
  };
  const save = () => {
    const title = `Кривая ${customCurves.length + 1}`;
    const id = `my${Date.now()}`;
    setPrefs({ customCurves: [...customCurves, { id, title, curve }] });
    setCur(id);
  };
  const remove = () => { setPrefs({ customCurves: customCurves.filter((c) => c.id !== cur) }); pick(all[0].id); };
  const isCustom = customCurves.some((c) => c.id === cur);
  const sidebar = <Sidebar title="Кривые" presets={list} current={cur} onPick={pick} favKey="ease" />;

  return (
    <div className={`browser${wide ? "" : " narrow"}`}>
      {wide && sidebar}
      <section className="detail">
        <header className="detail-head">
          {wide ? <div><h2>{edited ? "Своя кривая" : preset?.title}</h2><p>{edited ? "Изменена вручную" : preset?.hint}</p></div>
            : <button className="picker" onClick={() => setOpen(!open)}><span><b>{edited ? "Своя кривая" : preset?.title}</b><small>{preset?.hint}</small></span><i>▾</i></button>}
          <div className="inline">
            <button className="pill" onClick={read} disabled={busy} title="Считать график с первой выделенной пары ключей">Считать</button>
            {isCustom ? <button className="pill" onClick={remove}>Удалить</button> : <button className="pill" onClick={save} title="Сохранить в «Мои кривые»">Сохранить</button>}
          </div>
        </header>
        {!wide && open && <div className="picker-pop" onMouseLeave={() => setOpen(false)}>{sidebar}</div>}
        <div className="detail-body">
          <Seg value={mode} onChange={setMode} options={[{ value: "curve", label: "Кривая" }, { value: "manual", label: "Speed / Influence" }]} />
          {mode === "curve" ? (
            <>
              <div className="stage curve-stage"><CurveEditor curve={curve} onChange={setCurve} /></div>
              <div className="code-row">
                <code>cubic-bezier({curve.map(r2).join(", ")})</code>
                <button className="pill" onClick={() => navigator.clipboard?.writeText(`cubic-bezier(${curve.map(r2).join(", ")})`)}>Копировать</button>
              </div>
            </>
          ) : (
            <Controls values={manual} onChange={(v) => setManual(v as Manual)} controls={[
              { type: "slider", key: "outInfluence", label: "Выход из 1-го ключа · Influence", min: 0.1, max: 100, step: 0.1, unit: "%", value: 75 },
              { type: "slider", key: "outSpeed", label: "Выход · Speed", min: -5000, max: 5000, step: 1, value: 0 },
              { type: "slider", key: "inInfluence", label: "Вход во 2-й ключ · Influence", min: 0.1, max: 100, step: 0.1, unit: "%", value: 75 },
              { type: "slider", key: "inSpeed", label: "Вход · Speed", min: -5000, max: 5000, step: 1, value: 0 },
            ]} />
          )}
          <p className="hint">Тяните ручки, чтобы сделать свою кривую. Применяется настоящим ease, без лишних ключей.</p>
        </div>
        <footer className="detail-foot">
          <span>{sel.keys ? `Выделено ключей: ${sel.keys}` : "Выделите минимум два соседних ключа"}</span>
          <button className="btn primary" disabled={busy} onClick={() => runTool(ease, mode === "curve" ? { curve } : { manual })}>Применить</button>
        </footer>
      </section>
    </div>
  );
}
