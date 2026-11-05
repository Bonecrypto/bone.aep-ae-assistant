import { useMemo, useRef, useState } from "react";
import { runTool } from "../lib/actions";
import { useBusy } from "../lib/busy";
import { addFolder, createStructure, fileUrl, isNew, KIND_LABEL, libraryAvailable, markSeen, removeFolder, rescan, useLibrary, type LibItem } from "../lib/library";
import { useSelection } from "../lib/selection";
import { setPrefs, setStatus, usePrefs } from "../lib/store";
import { plural } from "../lib/format";
import { libImport, pickFolder, reveal } from "../tools/ae/library";
import { useWide } from "../ui/Browser";
import { recordUse } from "../lib/usage";
import { MediaPreview } from "../ui/Preview";
import { IconSearch, IconStar } from "../ui/icons";

const ALL = "__all", NEW = "__new", FAV = "__fav";

export function LibrarySection() {
  const lib = useLibrary();
  const { libraryFolders, favorites } = usePrefs();
  const busy = useBusy();
  const sel = useSelection();
  const wide = useWide(520);
  const [cat, setCat] = useState(ALL);
  const [q, setQ] = useState("");
  const [cur, setCur] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);

  const fav = (it: LibItem) => favorites.includes(`lib:${it.path}`);
  const toggleFav = (it: LibItem) => {
    const k = `lib:${it.path}`;
    setPrefs({ favorites: favorites.includes(k) ? favorites.filter((f) => f !== k) : [...favorites, k] });
  };

  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of lib.items) m.set(it.category, (m.get(it.category) ?? 0) + 1);
    return [...m.entries()];
  }, [lib.items]);
  const newItems = lib.items.filter(isNew);

  const shown = lib.items.filter((it) => {
    if (cat === NEW && !isNew(it)) return false;
    if (cat === FAV && !fav(it)) return false;
    if (cat !== ALL && cat !== NEW && cat !== FAV && it.category !== cat) return false;
    const s = q.trim().toLowerCase();
    return !s || `${it.name} ${it.category} ${KIND_LABEL[it.kind]}`.toLowerCase().includes(s);
  });
  const item = shown.find((x) => x.path === cur) ?? null;

  const pick = async () => {
    const r = await runTool(pickFolder, { prompt: "Папка библиотеки AE Assistant" });
    const path = r?.data?.ok ? (r.data.path as string | null) : null;
    if (path) { addFolder(path); setStatus({ kind: "ok", text: `Библиотека: ${path}` }); }
  };
  const apply = async (it: LibItem) => {
    recordUse(`lib:${it.path}`);
    const r = await runTool(libImport, { item: it });
    if (r?.ok) markSeen([it]);
  };

  if (!libraryAvailable() && libraryFolders.length === 0 && lib.items.length === 0) {
    return <Empty onPick={pick} note="Библиотека работает в After Effects (нужен доступ к файлам)." />;
  }
  if (libraryFolders.length === 0 && libraryAvailable()) return <Empty onPick={pick} />;

  const catButton = (id: string, label: string, n: number) => (
    <button key={id} className={`cat${cat === id ? " on" : ""}`} onClick={() => setCat(id)}><span>{label}</span><em>{n}</em></button>
  );
  const categories = (
    <>
      {catButton(ALL, "Всё", lib.items.length)}
      {newItems.length > 0 && catButton(NEW, "Новое", newItems.length)}
      {favorites.some((f) => f.startsWith("lib:")) && catButton(FAV, "Избранное", lib.items.filter(fav).length)}
      {cats.map(([c, n]) => catButton(c, c, n))}
    </>
  );

  return (
    <div className={`browser library${wide ? "" : " narrow"}`}>
      {wide && (
        <aside className="sidebar">
          <div className="sidebar-head"><span>Библиотека</span><em>{lib.items.length}</em></div>
          <div className="sidebar-list cats">{categories}</div>
          <div className="sidebar-foot">
            <button className="link" onClick={() => setShowFolders(!showFolders)}>Папки ({libraryFolders.length})</button>
          </div>
        </aside>
      )}
      <section className="detail">
        <header className="lib-head">
          <label className="search"><IconSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск в библиотеке" /></label>
          <button className="pill" onClick={() => rescan()} title="Перечитать папки">↻</button>
          {!wide && <button className="pill" onClick={() => setShowFolders(!showFolders)}>Папки</button>}
          {newItems.length > 0 && <button className="pill" onClick={() => markSeen(newItems)} title="Снять отметки «Новое»">Просмотрено</button>}
        </header>
        {!wide && <div className="cat-row">{categories}</div>}
        {showFolders && (
          <div className="folders">
            {libraryFolders.map((f) => (
              <div key={f} className="folder-row">
                <span title={f}>{f}</span>
                <button className="link" onClick={() => runTool(reveal, { path: f })}>Открыть</button>
                <button className="link" onClick={() => { createStructure(f); rescan(); setStatus({ kind: "ok", text: "Созданы папки-образцы и памятка «_КАК ПОЛЬЗОВАТЬСЯ.txt»." }); }}>Создать структуру</button>
                <button className="link danger" onClick={() => removeFolder(f)} title="Убрать из панели (файлы не удаляются)">Убрать</button>
              </div>
            ))}
            <button className="btn" onClick={pick}>+ Добавить папку</button>
          </div>
        )}
        {lib.error && <div className="lib-error">{lib.error}</div>}
        <div className="lib-grid">
          {shown.length === 0 && <div className="empty">{lib.scanning ? "Читаю папку…" : q ? "Ничего не нашлось" : "Здесь пока пусто — положите файлы в папку библиотеки"}</div>}
          {shown.map((it) => (
            <LibTile key={it.path} it={it} on={it.path === cur} fav={fav(it)} isNew={isNew(it)}
              onPick={() => setCur(it.path)} onApply={() => apply(it)} onFav={() => toggleFav(it)} />
          ))}
        </div>
        <footer className="detail-foot">
          <span>{item ? `${KIND_LABEL[item.kind]} · ${item.category} · ${hintFor(item, sel.selected)}` : `${shown.length} ${plural(shown.length, "элемент", "элемента", "элементов")} · двойной клик — добавить`}</span>
          <button className="btn primary" disabled={!item || busy} onClick={() => item && apply(item)}>{item?.kind === "preset" ? "Применить" : "Добавить"}</button>
        </footer>
      </section>
    </div>
  );
}

const hintFor = (it: LibItem, selected: number) =>
  it.kind === "preset" ? (selected ? `на ${selected} ${plural(selected, "слой", "слоя", "слоёв")}` : "на новый корректирующий слой")
    : it.kind === "template" ? "в текущее время (по маркеру)" : "в текущее время";

function LibTile(p: { it: LibItem; on: boolean; fav: boolean; isNew: boolean; onPick: () => void; onApply: () => void; onFav: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const { it } = p;
  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audio.current;
    if (!a) return;
    if (a.paused) { a.currentTime = 0; a.play().then(() => setPlaying(true)).catch(() => setStatus({ kind: "error", text: "Этот формат звука панель не проигрывает — в AE он добавится нормально." })); }
    else { a.pause(); setPlaying(false); }
  };
  return (
    <div className={`lib-tile${p.on ? " on" : ""}`} onClick={p.onPick} onDoubleClick={p.onApply} role="button" tabIndex={0} title={`${it.name}.${it.ext}\n${it.path}`}>
      <div className={`lib-thumb kind-${it.kind}`}>
        {it.preview ? <MediaPreview path={it.preview} hover /> : <span className="lib-ext">{it.kind === "audio" ? "♪" : it.ext.toUpperCase()}</span>}
        {it.kind === "audio" && (
          <>
            <audio ref={audio} src={fileUrl(it.path)} onEnded={() => setPlaying(false)} preload="none" />
            <button className="play" onClick={toggleAudio} title="Прослушать">{playing ? "❚❚" : "▶"}</button>
          </>
        )}
        {p.isNew && <span className="badge-new">Новое</span>}
        <button className={`lib-fav${p.fav ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); p.onFav(); }} title="В избранное"><IconStar /></button>
      </div>
      <div className="lib-name">{it.name}</div>
      <div className="lib-kind">{KIND_LABEL[it.kind]}</div>
    </div>
  );
}

function Empty({ onPick, note }: { onPick: () => void; note?: string }) {
  return (
    <section className="section lib-empty">
      <div className="panel">
        <div className="panel-title">Своя библиотека</div>
        <p className="panel-hint">Выберите папку — подпапки станут категориями, а всё, что вы туда положите, появится здесь с пометкой «Новое».</p>
        <ul className="lib-help">
          <li><b>.aep</b> — шаблоны и переходы: встают в композицию в текущее время. Маркер в шаблоне совпадёт с текущим временем — для переходов ставьте его на склейку.</li>
          <li><b>.ffx</b> — пресеты анимации: на выделенные слои.</li>
          <li><b>Видео, картинки, звуки</b> — в композицию в текущее время.</li>
          <li><b>Превью</b> — файл с тем же именем рядом: <code>Зум.aep</code> + <code>Зум.mp4</code>.</li>
          <li>Папка «Переходы» видна ещё и во вкладке «Переходы».</li>
        </ul>
        {note && <p className="panel-hint">{note}</p>}
        <button className="btn primary" onClick={onPick}>Выбрать папку</button>
      </div>
    </section>
  );
}
