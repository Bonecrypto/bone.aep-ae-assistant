import type { ReactNode } from "react";
import { useBusy } from "../lib/busy";

export function Seg<T extends string | number>(props: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={props.value === o.value} className={props.value === o.value ? "on" : ""}
          onClick={() => props.onChange(o.value)} title={o.hint ?? o.label}>{o.label}</button>
      ))}
    </div>
  );
}

export function Color(props: { value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <label className="color" title={props.hint}>
      <input type="color" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      <span style={{ background: props.value }} />
    </label>
  );
}

export function Btn(props: { children: ReactNode; onClick: () => void; primary?: boolean; hint?: string; danger?: boolean }) {
  const busy = useBusy();
  return (
    <button className={`btn${props.primary ? " primary" : ""}${props.danger ? " danger" : ""}`} disabled={busy} onClick={props.onClick} title={props.hint}>
      {props.children}
    </button>
  );
}

export const Row = (p: { children: ReactNode; between?: boolean }) => <div className={`row${p.between ? " between" : ""}`}>{p.children}</div>;
