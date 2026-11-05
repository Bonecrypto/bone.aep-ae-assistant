import type { Ctl, Values } from "../presets/types";
import { Color } from "./ui";

export function Slider(props: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{props.label}</span>
        <span className="slider-val">
          <input type="number" value={props.value} step={props.step} min={props.min} max={props.max}
            onChange={(e) => { const v = parseFloat(e.target.value.replace(",", ".")); if (Number.isFinite(v)) props.onChange(v); }}
            onFocus={(e) => e.target.select()} aria-label={props.label} />
          {props.unit && <em>{props.unit}</em>}
        </span>
      </div>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} style={{ "--p": `${pct}%` } as React.CSSProperties}
        onChange={(e) => props.onChange(parseFloat(e.target.value))} />
    </label>
  );
}

/** Карточка с настройками пресета. */
export function Controls({ controls, values, onChange }: { controls: Ctl[]; values: Values; onChange: (v: Values) => void }) {
  if (!controls.length) return null;
  const set = (k: string, v: unknown) => onChange({ ...values, [k]: v });
  return (
    <div className="controls">
      {controls.map((c) => {
        if (c.type === "slider") return <Slider key={c.key} label={c.label} value={values[c.key]} min={c.min} max={c.max} step={c.step} unit={c.unit} onChange={(v) => set(c.key, v)} />;
        if (c.type === "seg") return (
          <div key={c.key} className="ctl-row">
            <span>{c.label}</span>
            <div className="segmented">
              {c.options.map((o) => <button key={o.value} className={values[c.key] === o.value ? "on" : ""} onClick={() => set(c.key, o.value)}>{o.label}</button>)}
            </div>
          </div>
        );
        if (c.type === "toggle") return (
          <label key={c.key} className="ctl-row toggle-row">
            <span>{c.label}</span>
            <span className="toggle"><input type="checkbox" checked={!!values[c.key]} onChange={(e) => set(c.key, e.target.checked)} /><span className="switch" /></span>
          </label>
        );
        return (
          <div key={c.key} className="ctl-row"><span>{c.label}</span><Color value={values[c.key]} onChange={(v) => set(c.key, v)} hint={c.label} /></div>
        );
      })}
    </div>
  );
}
