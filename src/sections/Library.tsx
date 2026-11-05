import { useRef, useState } from "react";
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

  const newItems = lib.items.filter(isNew);

  const shown = lib.items.filter((it) => {
    if (cat === NEW && !isNew(it)) return false;
    if (cat === FAV && !fav(it)) return false;
    if (cat !== ALL && cat !== NEW && cat !== FAV && it.category !== cat && !it.category.startsWith(cat + " / ")) return false;
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

  const tree = buildTree(lib.items);
  const special = (
    <>
      <button className={`cat${cat === ALL ? " on" : ""}`} onClick={() => setCat(ALL)}><span>Всё</span><em>{lib.items.length}</em></button>
      {newItems.length > 0 && <button className={`cat${cat === NEW ? " on" : ""}`} onClick={() => setCat(NEW)}><span>Новое</span><em>{newItems.length}</em></button>}
      {favorites.some((f) => f.startsWith("lib:")) && <button className={`cat${cat === FAV ? " on" : ""}`} onClick={() => setCat(FAV)}><span>Избранное</span><em>{lib.items.filter(fav).length}</em></button>}
    </>
  );
  const categories = (
    <>
      {special}
      <div className="cat-sep" />
      <Tree nodes={tree} current={cat} onPick={setCat} />
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
        {!wide && (
          <div className="cat-select">
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value={ALL}>Всё ({lib.items.length})</option>
              {newItems.length > 0 && <option value={NEW}>Новое ({newItems.length})</option>}
              {favorites.some((f) => f.startsWith("lib:")) && <option value={FAV}>Избранное</option>}
              {flatten(tree).map(({ node, depth }) => <option key={node.path} value={node.path}>{"\u00a0\u00a0".repeat(depth)}{node.name} ({node.count})</option>)}
            </select>
          </div>
        )}
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
        {lib.problems.length > 0 && (
          <div className="lib-error" title={lib.problems.slice(0, 10).map((p) => `${p.path}: ${p.message}`).join("\n")}>
            Не удалось прочитать: {lib.problems.length} (подробности — в журнале ошибок в настройках). Если папка в OneDrive — включите «Всегда хранить на этом устройстве».
          </div>
        )}
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

// ---------- дерево папок ----------
type Node = { name: string; path: string; count: number; children: Node[] };

/** Категории "A / B / C" -> дерево со счётчиками (включая вложенное). */
function buildTree(items: LibItem[]): Node[] {
  const roots: Node[] = [];
  for (const it of items) {
    let level = roots, acc = "";
    for (const part of it.category.split(" / ")) {
      acc = acc ? `${acc} / ${part}` : part;
      let n = level.find((x) => x.name === part);
      if (!n) { n = { name: part, path: acc, count: 0, children: [] }; level.push(n); }
      n.count++;
      level = n.children;
    }
  }
  const sort = (ns: Node[]) => { ns.sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true })); ns.forEach((n) => sort(n.children)); };
  sort(roots);
  return roots;
}

const flatten = (ns: Node[], depth = 0): { node: Node; depth: number }[] => ns.flatMap((n) => [{ node: n, depth }, ...flatten(n.children, depth + 1)]);

function Tree({ nodes, current, onPick, depth = 0 }: { nodes: Node[]; current: string; onPick: (p: string) => void; depth?: number }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <>
      {nodes.map((n) => {
        const isOpen = open[n.path] ?? (current === n.path || current.startsWith(n.path + " / "));
        return (
          <div key={n.path}>
            <div className={`cat tree${current === n.path ? " on" : ""}`} style={{ paddingLeft: 6 + depth * 12 }} onClick={() => onPick(n.path)} role="button" tabIndex={0}>
              {n.children.length > 0
                ? <button className={`twisty${isOpen ? " open" : ""}`} onClick={(e) => { e.stopPropagation(); setOpen({ ...open, [n.path]: !isOpen }); }}>▸</button>
                : <span className="twisty" />}
              <span>{n.name}</span><em>{n.count}</em>
            </div>
            {isOpen && n.children.length > 0 && <Tree nodes={n.children} current={current} onPick={onPick} depth={depth + 1} />}
          </div>
        );
      })}
    </>
  );
}
