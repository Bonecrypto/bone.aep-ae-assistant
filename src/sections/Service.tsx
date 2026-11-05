import { useEffect, useState } from "react";
import { runTool } from "../lib/actions";
import { setPrefs, usePrefs } from "../lib/store";
import { labelByType, precompose, removeUnused, sequence } from "../tools/ae/service";
import { Num, Tile } from "../ui/ui";

export function ServiceSection() {
  const p = usePrefs();
  const [confirmClean, setConfirmClean] = useState(false);
  useEffect(() => {
    if (!confirmClean) return;
    const t = setTimeout(() => setConfirmClean(false), 4000);
    return () => clearTimeout(t);
  }, [confirmClean]);

  return (
    <section className="section">
      <div className="grid grid-tight">
        <Tile compact title="Прекомпоз" hint="Собрать выделенные слои в новую композицию" onClick={() => runTool(precompose, { name: "Прекомпоз" })} />
        <Tile compact title="По очереди" hint={`Каждый следующий выделенный слой начинается через ${p.stepFrames} кадров`} onClick={() => runTool(sequence, { mode: "time", stepFrames: p.stepFrames })} />
        <Tile compact title="Снизу вверх" hint="По очереди, но начиная с нижнего слоя" onClick={() => runTool(sequence, { mode: "time", stepFrames: p.stepFrames, reverse: true })} />
        <Tile compact title="По маркерам" hint="Каждый выделенный слой начинается на очередном маркере композиции" onClick={() => runTool(sequence, { mode: "markers" })} />
        <Tile compact title="Цвет по типу" hint="Покрасить метки слоёв по типу. Без выделения — все слои" onClick={() => runTool(labelByType, {})} />
        <Tile compact active={confirmClean} title={confirmClean ? "Точно? Ещё раз" : "Очистить проект"}
          hint="Убрать из проекта неиспользуемые исходники. Файлы на диске не удаляются"
          onClick={() => { if (confirmClean) { setConfirmClean(false); runTool(removeUnused, {}); } else setConfirmClean(true); }} />
      </div>
      <div className="inline">
        <Num label="Шаг" suffix="кадров" value={p.stepFrames} min={0} max={500} onChange={(v) => setPrefs({ stepFrames: Math.max(0, Math.round(v)) })} />
      </div>
      <p className="hint">Цвета меток: текст — красный, шейпы — жёлтый, прекомпы — голубой, null — розовый, корректирующие — лавандовый, solid — персиковый, видео — синий.</p>
    </section>
  );
}
