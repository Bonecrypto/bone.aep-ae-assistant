import { useRef, useState } from "react";
import { runTool } from "../lib/actions";
import { useBusy } from "../lib/busy";
import { useSelection } from "../lib/selection";
import { setStatus } from "../lib/store";
import { addAnim, animSummary, exportJson, importJson, removeAnim, renameAnim, useAnims, type Anim, type SavedAnim } from "../lib/myanims";
import { animApply, animCapture } from "../tools/ae/anims";
import { Seg } from "../ui/ui";

const Toggle = ({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) => (
  <label className="toggle" title={hint}><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /><span className="switch" /> {label}</label>
);

const nodeRequire = (): ((m: string) => any) | null => {
  const w = window as any;
  return typeof w.require === "function" ? w.require : typeof w.cep_node?.require === "function" ? w.cep_node.require : null;
};

/** Мои анимации: снять анимацию со слоя, сохранить под именем и накладывать на любые слои. */
export function MyAnimsSection() {
  const anims = useAnims();
  const busy = useBusy();
  const sel = useSelection();
  const [name, setName] = useState("");
  const [effects, setEffects] = useState(true);
  const [at, setAt] = useState<"layer" | "playhead">("layer");
  const [relative, setRelative] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const capture = async () => {
    const r = await runTool(animCapture, { effects });
    const anim = r?.ok ? ((r.data as any)?.anim as Anim | undefined) : undefined;
    if (!anim) return;
    const item = addAnim(name.trim() || anim.from, anim);
    setName("");
    setStatus({ kind: "ok", text: `Сохранено: «${item.name}» — ${animSummary(anim)}. Выделите другие слои и нажмите «Наложить».` });
  };
  const apply = (a: SavedAnim) => runTool(animApply, { title: a.name, anim: a.anim, at, relative });

  const exportAll = (items: SavedAnim[]) => {
    const req = nodeRequire();
    if (!req) { setStatus({ kind: "error", text: "Экспорт работает только внутри After Effects." }); return; }
    const fs = req("fs"), path = req("path"), os = req("os");
    const dir = path.join(os.homedir(), "Desktop");
    const base = items.length === 1 ? items[0].name.replace(/[\\/:*?"<>|]/g, "_") : "Мои анимации";
    const file = path.join(fs.existsSync(dir) ? dir : os.homedir(), `${base}.aeanim.json`);
    fs.writeFileSync(file, exportJson(items), "utf8");
    setStatus({ kind: "ok", text: `Файл сохранён: ${file}. Отправьте его — на другом компьютере «Импорт».` });
  };
  const onImport = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { const n = importJson(String(rd.result)); setStatus({ kind: n ? "ok" : "error", text: n ? `Добавлено анимаций: ${n}.` : "В файле нет анимаций AE Assistant." }); }
      catch { setStatus({ kind: "error", text: "Не получилось прочитать файл анимаций." }); }
    };
    rd.readAsText(f);
  };

  return (
    <section className="section myanims">
      <div className="panel">
        <div className="panel-title">Сохранить анимацию со слоя</div>
        <div className="panel-hint">Выделите слой с готовой анимацией — сохранятся ключи и выражения трансформации, эффекты, текстовые аниматоры и маркеры (TR In / TR Out). Сам текст и позиция слоя не меняются.</div>
        <label className="field"><span>Имя</span>
          <input value={name} placeholder={sel.selected ? "по имени слоя" : "выделите слой"} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") capture(); }} />
        </label>
        <Toggle on={effects} set={setEffects} label="Вместе с эффектами" hint="Эффекты слоя со всеми настройками (Glow, Light Sweep, ползунки выражений…)" />
        <div className="row"><button className="btn primary" disabled={busy || !sel.selected} onClick={capture}>Сохранить</button></div>
      </div>

      <div className="panel">
        <div className="panel-title">Мои анимации{anims.length ? ` · ${anims.length}` : ""}</div>
        <Seg value={at} onChange={setAt} options={[
          { value: "layer", label: "От начала слоя", hint: "Каждый слой получает анимацию от своего начала — удобно для слов «лесенкой»" },
          { value: "playhead", label: "От указателя", hint: "Первый ключ встанет на текущее время" },
        ]} />
        <Toggle on={relative} set={setRelative} label="Позиция — от места слоя" hint="Ключи позиции переносятся как смещение: слой двигается от того места, где стоит, а не прыгает туда, где был исходный" />
        {!anims.length && <div className="panel-hint">Пока пусто. Сохраните анимацию со слоя — она появится здесь, и её можно будет наложить на любое количество выделенных слоёв.</div>}
        <ul className="anim-list">
          {anims.map((a) => (
            <li key={a.id} className="anim-row">
              <div className="anim-info">
                {editing === a.id ? (
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => { renameAnim(a.id, draft); setEditing(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { renameAnim(a.id, draft); setEditing(null); } if (e.key === "Escape") setEditing(null); }} />
                ) : (
                  <b title="Двойной щелчок — переименовать" onDoubleClick={() => { setEditing(a.id); setDraft(a.name); }}>{a.name}</b>
                )}
                <small>{animSummary(a.anim)} · со слоя «{a.anim.from}»</small>
              </div>
              <div className="anim-actions">
                {confirmDel === a.id ? (
                  <>
                    <button className="pill" onClick={() => setConfirmDel(null)}>Оставить</button>
                    <button className="pill danger" onClick={() => { removeAnim(a.id); setConfirmDel(null); }}>Удалить</button>
                  </>
                ) : (
                  <>
                    <button className="pill" title="Сохранить в файл на рабочий стол" onClick={() => exportAll([a])}>Файл</button>
                    <button className="pill" title="Удалить из списка" onClick={() => setConfirmDel(a.id)}>✕</button>
                    <button className="btn primary" disabled={busy || !sel.selected} title={sel.selected ? "" : "Выделите слои"} onClick={() => apply(a)}>Наложить</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="btn" onClick={() => fileRef.current?.click()}>Импорт…</button>
          {anims.length > 1 && <button className="btn" onClick={() => exportAll(anims)}>Экспорт всех</button>}
          <input ref={fileRef} type="file" accept=".json,.aeanim" style={{ display: "none" }} onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="panel-hint small">Наложили дважды — эффекты и аниматоры добавятся ещё раз; лишнее уберёт «Сервис → Убрать дубли эффектов». Отмена — одним шагом.</div>
      </div>
    </section>
  );
}
