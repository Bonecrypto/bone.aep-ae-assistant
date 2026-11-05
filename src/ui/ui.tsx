import type { KeyboardEvent, ReactNode } from "react";
import { useBusy } from "../lib/busy";

/** Плитка-кнопка. div вместо button: в CEF внутри AE кнопки-flex рисуются ненадёжно. */
export function Tile(props: { title: string; hint: string; onClick: () => void; children?: ReactNode; active?: boolean; compact?: boolean; disabled?: boolean }) {
  const busy = useBusy();
  const disabled = props.disabled || busy;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!disabled) props.onClick(); } };
  return (
    <div role="button" tabIndex={0} aria-disabled={disabled} title={props.hint}
      className={`tile${props.active ? " active" : ""}${props.compact ? " compact" : ""}${disabled ? " disabled" : ""}`}
      onClick={() => !disabled && props.onClick()} onKeyDown={onKey}>
      {props.children}
      <div className="tile-label">{props.title}</div>
    </div>
  );
}

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

export function Chips<T extends string>(props: { value: T; items: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="chips">
      {props.items.map((c) => (
        <button key={c.value} className={`chip${props.value === c.value ? " active" : ""}`} onClick={() => props.onChange(c.value)}>{c.label}</button>
      ))}
    </div>
  );
}

export function Num(props: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: string; suffix?: string }) {
  return (
    <label className="num" title={props.hint ?? props.label}>
      <span>{props.label}</span>
      <input type="number" value={Number.isFinite(props.value) ? props.value : 0} min={props.min} max={props.max} step={props.step ?? 1}
        onChange={(e) => { const v = parseFloat(e.target.value.replace(",", ".")); if (Number.isFinite(v)) props.onChange(v); }} />
      {props.suffix && <em>{props.suffix}</em>}
    </label>
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
