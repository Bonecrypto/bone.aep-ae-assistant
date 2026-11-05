import { runTool } from "../lib/actions";
import { setPrefs, setStatus, usePrefs } from "../lib/store";
import { sec } from "../lib/format";
import { TEXT_ANIMS, textAnimate, textCopyStyle, textPasteStyle } from "../tools/ae/text";
import { Btn, Row, Seg, Tile } from "../ui/ui";
import { DURATIONS } from "./Animate";

const describe = (s: Record<string, unknown> | null) => {
  if (!s) return "Стиль ещё не скопирован";
  const parts = [s.font, s.fontSize ? `${Math.round(Number(s.fontSize))} px` : "", s.tracking ? `трекинг ${s.tracking}` : ""].filter(Boolean);
  return parts.join(" · ");
};

export function TextSection() {
  const p = usePrefs();
  const copy = async () => {
    const r = await runTool(textCopyStyle, {});
    if (r?.ok && r.data?.ok) setPrefs({ textStyle: r.data.style as Record<string, unknown>, textStyleFrom: String(r.data.from) });
  };
  const paste = () => {
    if (!p.textStyle) { setStatus({ kind: "error", text: "Сначала скопируйте стиль с текстового слоя." }); return; }
    runTool(textPasteStyle, { style: p.textStyle });
  };

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-title">Стиль текста</div>
        <div className="panel-hint" title={p.textStyleFrom ? `Скопирован с «${p.textStyleFrom}»` : undefined}>{describe(p.textStyle)}</div>
        <Row between>
          <Btn onClick={copy} hint="Шрифт, размер, цвет, обводка, трекинг, выравнивание первого выделенного текстового слоя">Копировать</Btn>
          <Btn primary onClick={paste} hint="Применить к выделенным текстовым слоям (сам текст не меняется)">Вставить на выделенные</Btn>
        </Row>
      </div>

      <div className="toolbar">
        <Seg value={p.animMode} onChange={(v) => setPrefs({ animMode: v })} options={[{ value: "in", label: "Появление" }, { value: "out", label: "Исчезание" }]} />
        <Seg value={p.duration} onChange={(v) => setPrefs({ duration: v })} options={DURATIONS.map((d) => ({ value: d, label: sec(d) }))} />
      </div>
      <div className="grid">
        {TEXT_ANIMS.map((a) => (
          <Tile key={a.id} title={a.title} hint={`По буквам: ${a.title.toLowerCase()}. Добавляет аниматор на выделенные текстовые слои`}
            onClick={() => runTool(textAnimate, { preset: a.id, mode: p.animMode, duration: p.duration })}>
            <svg className="preview" viewBox="0 0 90 44" aria-hidden="true">
              <rect width="90" height="44" rx="6" className="pv-bg" />
              {["A", "B", "C"].map((ch, i) => (
                <text key={ch} x={30 + i * 13} y={28} className={`pv-char pv-char-${a.id}`} style={{ animationDelay: `${i * 0.15}s` }}>{ch}</text>
              ))}
            </svg>
          </Tile>
        ))}
      </div>
    </section>
  );
}
