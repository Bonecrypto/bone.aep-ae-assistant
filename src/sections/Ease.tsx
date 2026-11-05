import { useState } from "react";
import { runTool } from "../lib/actions";
import { EASE_PRESETS, type Curve } from "../presets/ease";
import { ease, readEase, type Manual } from "../tools/ae/ease";
import { CurveThumb } from "../ui/AnimPreview";
import { CurveEditor } from "../ui/CurveEditor";
import { Btn, Num, Row, Seg, Tile } from "../ui/ui";

export function EaseSection() {
  const [curve, setCurve] = useState<Curve>(EASE_PRESETS[0].curve);
  const [mode, setMode] = useState<"curve" | "manual">("curve");
  const [manual, setManual] = useState<Manual>({ outSpeed: 0, outInfluence: 75, inSpeed: 0, inInfluence: 75 });
  const set = (i: number, v: number) => setCurve(curve.map((c, j) => (j === i ? v : c)) as Curve);
  const setM = (k: keyof Manual, v: number) => setManual({ ...manual, [k]: v });

  const read = async () => {
    const r = await runTool(readEase, {});
    if (r?.ok && r.data && r.data.ok) {
      setCurve((r.data.curve as number[]).map((v) => Math.round(v * 100) / 100) as Curve);
      setManual(r.data.manual as Manual);
    }
  };

  return (
    <section className="section">
      <div className="toolbar">
        <Seg value={mode} onChange={setMode} options={[{ value: "curve", label: "Кривая" }, { value: "manual", label: "Speed / Influence" }]} />
        <span className="hint">на выделенные ключи</span>
      </div>

      {mode === "curve" ? (
        <div className="ease-editor">
          <CurveEditor curve={curve} onChange={setCurve} />
          <div className="ease-fields">
            <Num label="x1" value={curve[0]} min={0} max={1} step={0.01} onChange={(v) => set(0, Math.min(1, Math.max(0, v)))} />
            <Num label="y1" value={curve[1]} step={0.01} onChange={(v) => set(1, v)} />
            <Num label="x2" value={curve[2]} min={0} max={1} step={0.01} onChange={(v) => set(2, Math.min(1, Math.max(0, v)))} />
            <Num label="y2" value={curve[3]} step={0.01} onChange={(v) => set(3, v)} />
          </div>
        </div>
      ) : (
        <div className="manual-grid">
          <b>Выход из 1-го ключа</b><b>Вход во 2-й ключ</b>
          <Num label="Influence" suffix="%" value={manual.outInfluence} min={0.1} max={100} onChange={(v) => setM("outInfluence", v)} />
          <Num label="Influence" suffix="%" value={manual.inInfluence} min={0.1} max={100} onChange={(v) => setM("inInfluence", v)} />
          <Num label="Speed" value={manual.outSpeed} onChange={(v) => setM("outSpeed", v)} hint="Единиц в секунду (px/с для позиции)" />
          <Num label="Speed" value={manual.inSpeed} onChange={(v) => setM("inSpeed", v)} hint="Единиц в секунду (px/с для позиции)" />
        </div>
      )}

      <Row between>
        <Btn onClick={read} hint="Считать график с первой выделенной пары ключей">Считать с ключей</Btn>
        <Btn primary onClick={() => runTool(ease, mode === "curve" ? { curve } : { manual })} hint="Применить к выделенным парам ключей">Применить</Btn>
      </Row>

      <div className="grid grid-tight">
        {EASE_PRESETS.map((p) => (
          <Tile key={p.id} title={p.title} hint={`${p.title}: ${p.hint}. Клик — применить к выделенным ключам`} compact
            onClick={() => { setCurve(p.curve); setMode("curve"); runTool(ease, { preset: p.id }); }}>
            <CurveThumb curve={p.curve} />
          </Tile>
        ))}
      </div>
    </section>
  );
}
