import { useEffect, useRef, type JSX } from "react";
import { runTool } from "../lib/actions";
import { useBusy } from "../lib/busy";
import { useLibrary, type LibItem } from "../lib/library";
import { getPrefs, setPrefs, usePrefs } from "../lib/store";
import { frequent, recordUse } from "../lib/usage";
import { TABS_PRESETS } from "../presets/all";
import { ALL_EASE_PRESETS, type Curve } from "../presets/ease";
import { libraryTransitions } from "../presets/transitions";
import { defaults, type Preset } from "../presets/types";
import { ease } from "../tools/ae/ease";
import { libImport } from "../tools/ae/library";
import { applyPreset } from "./Browser";
import { IconBraces, IconCurve, IconFolder, IconLayers, IconPlus, IconSparkles, IconStar, IconText, IconWave, IconWrench } from "./icons";

// Панель быстрого доступа слева: избранное (звёздочки) сверху, частые ниже. Клик — применить сразу.
type Entry = { key: string; title: string; group: string; glyph: JSX.Element; run: () => void };

const TAB_ICON: Record<string, (p: any) => JSX.Element> = {
  library: IconFolder, ease: IconCurve, text: IconText, transitions: IconLayers, styles: IconSparkles,
  shakes: IconWave, expr: IconBraces, create: IconPlus, service: IconWrench,
};
const TAB_NAME: Record<string, string> = {
  library: "Библиотека", ease: "Скорость", text: "Текст", transitions: "Переходы", styles: "Стили",
  shakes: "Тряска", expr: "Выражения", create: "Создать", service: "Сервис",
};

/** Сокращение названия: «Выпрыгивание по очереди» → «ВП», «Зум» → «Зу». */
const abbr = (title: string) => {
  const w = title.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] ?? "?").slice(0, 2)).replace(/^./, (c) => c.toUpperCase());
};

const MiniCurve = ({ c }: { c: Curve }) => {
  const X = (x: number) => 4 + x * 22, Y = (y: number) => 24 - y * 18;
  return <svg viewBox="0 0 30 30" width="26" height="26"><path d={`M${X(0)} ${Y(0)} C${X(c[0])} ${Y(c[1])} ${X(c[2])} ${Y(c[3])} ${X(1)} ${Y(1)}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
};

const Glyph = ({ tab, title }: { tab: string; title: string }) => {
  const Icon = TAB_ICON[tab] ?? IconStar;
  return <span className="dock-glyph"><Icon /><b>{abbr(title)}</b></span>;
};

function resolve(key: string, libItems: LibItem[]): Entry | null {
  const i = key.indexOf(":");
  const tab = key.slice(0, i), id = key.slice(i + 1);
  const values = () => getPrefs().lastValues[key];

  if (tab === "ease") {
    const c = [...ALL_EASE_PRESETS, ...getPrefs().customCurves].find((x) => x.id === id);
    if (!c) return null;
    return { key, title: c.title, group: TAB_NAME.ease, glyph: <MiniCurve c={c.curve} />, run: () => { recordUse(key); runTool(ease, { curve: c.curve }); } };
  }
  if (tab === "lib") {
    const it = libItems.find((x) => x.path === id);
    if (!it) return null;
    return { key, title: it.name, group: `Библиотека · ${it.category}`, glyph: <Glyph tab="library" title={it.name} />, run: () => { recordUse(key); runTool(libImport, { item: it }); } };
  }
  const list: Preset[] = [...(TABS_PRESETS[tab]?.presets ?? []), ...(tab === "transitions" ? libraryTransitions(libItems) : [])];
  const p = list.find((x) => x.id === id);
  if (!p) return null;
  return {
    key, title: p.title, group: TAB_NAME[tab] ?? tab, glyph: <Glyph tab={tab} title={p.title} />,
    run: () => { const v = { ...defaults(p), ...(values() ?? {}) }; recordUse(key, v); applyPreset(p, v); },
  };
}

export function Dock() {
  const { favorites, usage } = usePrefs();
  const lib = useLibrary();
  const busy = useBusy();
  void usage; // перерисовка при изменении статистики
  const pinned = favorites.map((k) => resolve(k, lib.items)).filter(Boolean) as Entry[];
  const often = frequent(6, favorites).map((k) => resolve(k, lib.items)).filter(Boolean) as Entry[];
  const unpin = (key: string) => setPrefs({ favorites: getPrefs().favorites.filter((f) => f !== key) });
  const pin = (key: string) => setPrefs({ favorites: [...getPrefs().favorites, key] });

  // Ctrl+1…9 — первые девять кнопок колонки
  const all = [...pinned, ...often];
  const ref = useRef(all);
  ref.current = all;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey) || !/^Digit[1-9]$/.test(ev.code)) return;
      const e = ref.current[Number(ev.code.slice(5)) - 1];
      if (e) { ev.preventDefault(); e.run(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // перетаскивание: меняет порядок избранного
  const drag = useRef<string | null>(null);
  const drop = (target: string) => {
    const from = drag.current;
    drag.current = null;
    if (!from || from === target) return;
    const list = getPrefs().favorites.filter((f) => f !== from);
    list.splice(list.indexOf(target), 0, from);
    setPrefs({ favorites: list });
  };

  const btn = (e: Entry, isPinned: boolean, n: number) => (
    <button key={e.key} className="dock-btn" disabled={busy} onClick={e.run}
      draggable={isPinned} onDragStart={() => { drag.current = e.key; }} onDragOver={(ev) => isPinned && ev.preventDefault()} onDrop={() => isPinned && drop(e.key)}
      onContextMenu={(ev) => { ev.preventDefault(); isPinned ? unpin(e.key) : pin(e.key); }}
      title={`${e.title} — ${e.group}${n <= 9 ? `  (Ctrl+${n})` : ""}\nКлик — применить с последними настройками\nПравый клик — ${isPinned ? "убрать из избранного" : "закрепить"}${isPinned ? "\nПеретащите, чтобы поменять порядок" : ""}`}>
      {e.glyph}
    </button>
  );

  return (
    <nav className="dock" aria-label="Быстрый доступ">
      {pinned.length === 0 && often.length === 0 && (
        <div className="dock-empty" title="Отмечайте пресеты звёздочкой — они появятся здесь. Частые действия добавятся сами."><IconStar /></div>
      )}
      {pinned.map((e, i) => btn(e, true, i + 1))}
      {often.length > 0 && <div className="dock-sep" title="Часто используемые" />}
      {often.map((e, i) => btn(e, false, pinned.length + i + 1))}
    </nav>
  );
}
