import { useState } from "react";
import { runTool } from "../lib/actions";
import { setPrefs, usePrefs } from "../lib/store";
import { EFFECT_ITEMS, ELEMENT_ITEMS, LAYER_ITEMS } from "../presets/create";
import { addEffect, createLayer, element } from "../tools/ae/create";
import { ElementThumb } from "../ui/AnimPreview";
import { Chips, Color, Num, Tile } from "../ui/ui";

type Sub = "layers" | "effects" | "elements";

const layerIcon: Record<string, JSX.Element> = {
  solid: <rect x="30" y="10" width="30" height="24" rx="3" className="pv-solid" />,
  adjustment: <><rect x="30" y="10" width="30" height="24" rx="3" className="pv-ghost" /><path d="M36 28 L45 16 L54 28" className="pv-line" /></>,
  null: <><rect x="35" y="12" width="20" height="20" className="pv-line" /><path d="M35 12 L55 32 M55 12 L35 32" className="pv-line" /></>,
  camera: <><rect x="28" y="14" width="24" height="16" rx="3" className="pv-line" /><path d="M52 19 L62 14 V30 L52 25" className="pv-line" /></>,
  vignette: <><rect x="22" y="8" width="46" height="28" rx="3" className="pv-solid" style={{ opacity: 0.35 }} /><ellipse cx="45" cy="22" rx="17" ry="10" className="pv-bgfill" /></>,
};

export function CreateSection() {
  const p = usePrefs();
  const [sub, setSub] = useState<Sub>("layers");
  return (
    <section className="section">
      <div className="toolbar">
        <Chips value={sub} onChange={setSub} items={[{ value: "layers", label: "Слои" }, { value: "effects", label: "Эффекты" }, { value: "elements", label: "Элементы" }]} />
        {sub === "layers" && <Color value={p.solidColor} onChange={(v) => setPrefs({ solidColor: v })} hint="Цвет для Solid" />}
        {sub === "elements" && (
          <div className="inline">
            <Num label="Толщина" value={p.elementWidth} min={1} max={100} onChange={(v) => setPrefs({ elementWidth: v })} />
            <Color value={p.elementColor} onChange={(v) => setPrefs({ elementColor: v })} hint="Цвет линии" />
          </div>
        )}
      </div>

      {sub === "layers" && (
        <div className="grid">
          {LAYER_ITEMS.map((it) => (
            <Tile key={it.kind} title={it.title} hint={it.hint} onClick={() => runTool(createLayer, { kind: it.kind, color: p.solidColor })}>
              <svg className="preview" viewBox="0 0 90 44" aria-hidden="true">
                <rect width="90" height="44" rx="6" className="pv-bg" />
                <g style={it.kind === "solid" ? { fill: p.solidColor } : undefined}>{layerIcon[it.kind]}</g>
              </svg>
            </Tile>
          ))}
        </div>
      )}

      {sub === "effects" && (
        <>
          <div className="grid grid-tight">
            {EFFECT_ITEMS.map((it) => (
              <Tile key={it.matchName} title={it.title} compact hint={`${it.hint}: на выделенные слои, без выделения — новым корректирующим слоем`}
                onClick={() => runTool(addEffect, { matchName: it.matchName })} />
            ))}
          </div>
          <p className="hint">Нет выделенных слоёв — эффект ляжет на новый корректирующий слой.</p>
        </>
      )}

      {sub === "elements" && (
        <div className="grid">
          {ELEMENT_ITEMS.map((it) => (
            <Tile key={it.kind} title={it.title} hint={`${it.hint}. Прорисовка от текущего времени за ${String(p.duration).replace(".", ",")} с`}
              onClick={() => runTool(element, { kind: it.kind, color: p.elementColor, width: p.elementWidth, duration: Math.max(0.3, p.duration) })}>
              <ElementThumb kind={it.kind} />
            </Tile>
          ))}
        </div>
      )}
    </section>
  );
}
