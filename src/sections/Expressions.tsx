import { useState } from "react";
import { runTool } from "../lib/actions";
import { EXPR_PRESETS } from "../presets/expressions";
import { clearExpression, expression } from "../tools/ae/expression";
import { Btn, Num, Row, Tile } from "../ui/ui";

export function ExpressionsSection() {
  const [id, setId] = useState(EXPR_PRESETS[0].id);
  const [values, setValues] = useState<Record<string, Record<string, number>>>({});
  const preset = EXPR_PRESETS.find((p) => p.id === id)!;
  const vals = values[id] ?? {};

  return (
    <section className="section">
      <div className="grid grid-tight">
        {EXPR_PRESETS.map((p) => (
          <Tile key={p.id} title={p.title} hint={p.hint} compact active={p.id === id} onClick={() => setId(p.id)} />
        ))}
      </div>
      <div className="panel">
        <div className="panel-title">{preset.title}</div>
        <div className="panel-hint">{preset.hint}</div>
        {preset.params.length > 0 && (
          <div className="params">
            {preset.params.map((x) => (
              <Num key={x.key} label={x.label} value={vals[x.key] ?? x.value} min={x.min} max={x.max} step={x.step}
                onChange={(v) => setValues({ ...values, [id]: { ...vals, [x.key]: v } })} hint="Потом можно менять ползунком в эффектах слоя" />
            ))}
          </div>
        )}
        <Row between>
          <Btn danger onClick={() => runTool(clearExpression, {})} hint="Удалить выражения с выделенных свойств">Убрать выражения</Btn>
          <Btn primary onClick={() => runTool(expression, { preset: id, params: vals })}>Применить</Btn>
        </Row>
      </div>
    </section>
  );
}
