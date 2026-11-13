import { useState } from "react";
import { runTool } from "../lib/actions";
import { useBusy } from "../lib/busy";
import { MOD, isMac } from "../lib/platform";
import { setPrefs, usePrefs } from "../lib/store";
import { COMP_PRESETS, DEFAULT_TEMPLATE, destinations, startArgs } from "../lib/project";
import { orderLayers, organize, projectStart, safeZone, safeZoneToggle } from "../tools/ae/project";
import { Slider } from "../ui/Controls";
import { Seg } from "../ui/ui";

const ZONES = [
  { kind: "reels", label: "Reels", name: "PA Safe Reels" },
  { kind: "tiktok", label: "TikTok", name: "PA Safe TikTok" },
  { kind: "shorts", label: "Shorts", name: "PA Safe Shorts" },
  { kind: "title16x9", label: "16:9 Title/Action", name: "PA Safe 16x9" },
  { kind: "grid3", label: "Сетка 3×3", name: "PA Safe Grid" },
];

const Toggle = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) => (
  <label className="toggle" title={hint}><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /><span className="switch" /> {label}</label>
);

export function ProjectSection() {
  const p = usePrefs();
  const busy = useBusy();
  const [tplOpen, setTplOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const alt = isMac ? "Option" : "Alt";

  const addPath = () => {
    const v = newPath.trim().replace(/\s*\/\s*/g, "/");
    if (!v || p.projectTemplate.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    setPrefs({ projectTemplate: [...p.projectTemplate, v].sort((a, b) => a.localeCompare(b, "en", { numeric: true })) });
    setNewPath("");
  };

  return (
    <section className="section project">
      <div className="panel">
        <div className="panel-title">Старт проекта</div>
        <button className="btn primary big" disabled={busy} onClick={() => runTool(projectStart, startArgs(p.projectMakeComp))}
          title="Папки по шаблону + главная композиция + раскладка того, что уже в проекте. Повторно ничего не дублирует">
          Подготовить проект
        </button>
        <div className="toggles">
          <Toggle on={p.projectAutoFolders} set={(v) => setPrefs({ projectAutoFolders: v })} label="Папки — в каждом новом проекте"
            hint="Пустой новый проект готовится сам, один раз (удалённое не возвращается)" />
          <Toggle on={p.projectAutoOrganize} set={(v) => setPrefs({ projectAutoOrganize: v })} label="Раскладывать при импорте"
            hint="Импортировали файлы — они сами уходят в нужные папки (проверка раз в 4 секунды)" />
          <Toggle on={p.projectMakeComp} set={(v) => setPrefs({ projectMakeComp: v })} label="Главная композиция"
            hint="Создать главную композицию в 01 Comps/Main (если её ещё нет)" />
        </div>
        {p.projectMakeComp && (
          <div className="comp-setup">
            <label className="field"><span>Имя</span><input value={p.compName} onChange={(e) => setPrefs({ compName: e.target.value })} /></label>
            <Seg value={p.compPreset} onChange={(v) => setPrefs({ compPreset: v })} options={COMP_PRESETS.map((c) => ({ value: c.id, label: c.label, hint: c.hint }))} />
            <Seg value={p.compFps} onChange={(v) => setPrefs({ compFps: v })} options={[24, 25, 30, 60].map((f) => ({ value: f, label: `${f} fps` }))} />
            <Slider label="Длительность" value={p.compDuration} min={1} max={600} step={1} unit="с" onChange={(v) => setPrefs({ compDuration: v })} />
          </div>
        )}
        <div className="row between">
          <button className="link" onClick={() => setTplOpen(!tplOpen)}>Настроить шаблон папок {tplOpen ? "▴" : "▾"}</button>
          <button className="btn" disabled={busy} onClick={() => runTool(organize, { dest: destinations(p.projectTemplate), mainName: p.compName })}
            title="Видео, фото, PNG, векторы, звук (музыка/SFX/голос), логотипы, solid-ы и композиции из корня проекта — по папкам">
            Разложить по папкам
          </button>
        </div>
        {tplOpen && (
          <div className="template">
            {p.projectTemplate.map((path) => (
              <div key={path} className="tpl-row" style={{ paddingLeft: (path.split("/").length - 1) * 14 }}>
                <span>{path.split("/").pop()}</span>
                <button className="link danger" title="Убрать из шаблона" onClick={() => setPrefs({ projectTemplate: p.projectTemplate.filter((x) => x !== path) })}>✕</button>
              </div>
            ))}
            <div className="row">
              <input className="tpl-input" value={newPath} placeholder="Например: 02 Footage/Drone" onChange={(e) => setNewPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPath()} />
              <button className="btn" onClick={addPath}>Добавить</button>
            </div>
            <button className="link" onClick={() => setPrefs({ projectTemplate: DEFAULT_TEMPLATE })}>Вернуть стандартный</button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">Безопасные зоны</div>
        <div className="panel-hint">Направляющий слой (Guide Layer): виден, пока работаешь, и не попадает в рендер. Ставится в активную композицию.</div>
        <div className="chip-row">
          {ZONES.map((z) => <button key={z.kind} className="chip" disabled={busy} onClick={() => runTool(safeZone, { kind: z.kind, name: z.name })}>{z.label}</button>)}
        </div>
        <div className="row">
          <button className="btn" onClick={() => runTool(safeZoneToggle, { action: "hide" })}>Скрыть</button>
          <button className="btn" onClick={() => runTool(safeZoneToggle, { action: "show" })}>Показать</button>
          <button className="btn danger" onClick={() => runTool(safeZoneToggle, { action: "delete" })}>Удалить</button>
        </div>
        <div className="panel-hint small">Reels — по гайдам Instagram; TikTok и Shorts — ориентировочно, интерфейсы приложений меняются.</div>
      </div>

      <div className="panel">
        <div className="panel-title">Порядок слоёв по времени</div>
        <div className="panel-hint">Клипы из Premiere лежат вразнобой — выстроим их «лесенкой» по времени начала.</div>
        <Seg value={p.orderDirection} onChange={(v) => setPrefs({ orderDirection: v })} options={[{ value: "down", label: "Ранние сверху ↘" }, { value: "up", label: "Ранние снизу ↗" }]} />
        <Seg value={p.orderAudio} onChange={(v) => setPrefs({ orderAudio: v })} options={[{ value: "bottom", label: "Звук вниз" }, { value: "together", label: "Вместе" }, { value: "top", label: "Звук наверх" }]} />
        <div className="row between">
          <Seg value={scope} onChange={setScope} options={[{ value: "all", label: "Все слои" }, { value: "selected", label: "Выделенные" }]} />
          <button className="btn primary" disabled={busy} onClick={() => runTool(orderLayers, { direction: p.orderDirection, scope, audio: p.orderAudio })}>Упорядочить</button>
        </div>
        <button className="link" onClick={() => setTipsOpen(!tipsOpen)}>Как это делается вручную {tipsOpen ? "▴" : "▾"}</button>
        {tipsOpen && (
          <ul className="tips">
            <li><b>Слой выше / ниже на одну позицию:</b> {MOD}] и {MOD}[.</li>
            <li><b>В самый верх / самый низ:</b> {MOD}Shift+] и {MOD}Shift+[.</li>
            <li><b>Сортировки по времени в AE нет</b> — поэтому кнопка «Упорядочить» выше.</li>
            <li><b>Поставить клипы друг за другом по времени:</b> выделить по порядку → Animation → Keyframe Assistant → Sequence Layers (или «Сервис → По очереди»).</li>
            <li><b>Начало / конец слоя к указателю:</b> [ и ] — сдвигают слой; {alt}+[ и {alt}+] — обрезают.</li>
            <li><b>Перейти к началу / концу выделенного слоя:</b> I и O.</li>
            <li><b>Убрать лишнее из вида:</b> пометить слои «Shy» и включить кнопку Shy в таймлайне; аудио-копии можно сразу отправить вниз — «Звук вниз».</li>
          </ul>
        )}
      </div>
    </section>
  );
}
