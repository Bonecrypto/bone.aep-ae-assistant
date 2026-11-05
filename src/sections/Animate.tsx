import { runTool } from "../lib/actions";
import { setPrefs, usePrefs } from "../lib/store";
import { sec } from "../lib/format";
import { animate, animTitle, motionBlur, type AnimateInput } from "../tools/ae/animate";
import { AnimPreview } from "../ui/AnimPreview";
import { Seg, Tile } from "../ui/ui";

export const ANIM_PRESETS: Omit<AnimateInput, "mode" | "duration" | "spring">[] = [
  { kind: "slide", direction: "left" },
  { kind: "slide", direction: "right" },
  { kind: "slide", direction: "up" },
  { kind: "slide", direction: "down" },
  { kind: "fade" },
  { kind: "scale" },
  { kind: "rotate" },
];
export const DURATIONS = [0.3, 0.6, 1, 1.5];

export function AnimateSection() {
  const p = usePrefs();
  return (
    <section className="section">
      <div className="toolbar">
        <Seg label="Режим" value={p.animMode} onChange={(v) => setPrefs({ animMode: v })}
          options={[{ value: "in", label: "Влёт", hint: "Слой появляется: от текущего времени к его текущему положению" }, { value: "out", label: "Улёт", hint: "Слой исчезает: от текущего положения за кадр" }]} />
        <Seg label="Длительность" value={p.duration} onChange={(v) => setPrefs({ duration: v })}
          options={DURATIONS.map((d) => ({ value: d, label: sec(d), hint: `Длительность ${sec(d)}` }))} />
      </div>
      <div className="grid">
        {ANIM_PRESETS.map((preset) => {
          const input: AnimateInput = { ...preset, mode: p.animMode, duration: p.duration, spring: p.spring };
          const title = animTitle({ ...input, spring: false });
          return (
            <Tile key={title} title={title} onClick={() => runTool(animate, input)}
              hint={`${animTitle(input)}: выделенные слои, от текущего времени, ${sec(p.duration)}. Один Ctrl+Z отменит.`}>
              <AnimPreview input={input} />
            </Tile>
          );
        })}
        <Tile title="Моушн-блюр" hint="Включить моушн-блюр у выделенных слоёв и в композиции" onClick={() => runTool(motionBlur, { on: true })}>
          <svg className="preview" viewBox="0 0 90 44" aria-hidden="true">
            <rect width="90" height="44" rx="6" className="pv-bg" />
            <rect x="26" y="15" width="14" height="14" rx="3" className="pv-ghost" />
            <rect x="34" y="15" width="14" height="14" rx="3" className="pv-ghost" />
            <rect x="44" y="15" width="14" height="14" rx="3" className="pv-solid" />
          </svg>
        </Tile>
      </div>
      <label className="toggle" title="Влёт с перелётом за конечное значение и возвратом. Для улёта и прозрачности не применяется">
        <input type="checkbox" checked={p.spring} onChange={(e) => setPrefs({ spring: e.target.checked })} />
        <span className="switch" /> Пружина (перелёт и возврат)
      </label>
    </section>
  );
}
