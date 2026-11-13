import type { JSX } from "react";

// Иконки функций (свои, 24×24, линия 1.8 — в стиле панели). Используются в списках, колонке быстрого доступа и поиске.
type G = () => JSX.Element;
const S = (...children: (JSX.Element | string)[]): G => () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children.map((c, i) => (typeof c === "string" ? <path key={i} d={c} /> : <g key={i}>{c}</g>))}
  </svg>
);
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;
const T = (t: string, size = 9): JSX.Element => <text x="12" y="16" textAnchor="middle" fontSize={size} fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">{t}</text>;

export const GLYPH: Record<string, G> = {
  // переходы слоёв
  pop: S(rect(9, 9, 6, 6), "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"),
  zoom: S(circle(11, 11, 6), "M20 20l-4.5-4.5M8 11h6M11 8v6"),
  whip: S("M3 12h12M11 7l5 5-5 5M3 7h5M3 17h5"),
  spin: S("M20 12a8 8 0 1 1-2.6-5.9", "M20 4v5h-5"),
  defocus: S(circle(12, 12, 3), circle(12, 12, 7), "M12 2v1M12 21v1M2 12h1M21 12h1"),
  fly: S(rect(6, 5, 15, 14), "M1 12h9M7 9l3 3-3 3"),
  fade: S(rect(4, 4, 16, 16), "M4 14l10-10M4 20L20 4M10 20l10-10"),
  rise: S("M12 20V7M7 12l5-5 5 5M5 3h14"),
  drop: S("M12 4v13M7 12l5 5 5-5M5 21h14"),
  popSeq: S(rect(3, 14, 4, 6), rect(10, 9, 4, 11), rect(17, 4, 4, 16)),
  slideSeq: S("M3 6h10M6 12h10M9 18h10M17 4l2 2-2 2"),
  fadeSeq: S(circle(5, 12, 2), circle(12, 12, 2), circle(19, 12, 2), "M5 6v1M12 6v1M19 6v1"),
  // между сценами
  dip: S(rect(3, 5, 18, 14), "M3 19L21 5", "M12 5v14"),
  flash: S("M13 2L5 14h6l-1 8 8-12h-6z"),
  blurCut: S(circle(8, 12, 4), circle(16, 12, 4), "M12 4v16"),
  zoomIn: S("M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"),
  zoomOut: S("M10 4v6H4M14 20v-6h6M4 4l6 6M20 20l-6-6"),
  whipCut: S("M2 12h8M14 12h8M6 8l-4 4 4 4M18 8l4 4-4 4M12 4v16"),
  spinCut: S("M12 4a8 8 0 0 1 8 8M12 20a8 8 0 0 1-8-8", "M20 8v4h-4M4 16v-4h4"),
  carousel: S(rect(2, 8, 4, 8), rect(8, 5, 8, 14), rect(18, 8, 4, 8)),
  carouselCover: S(rect(2, 9, 4, 6), rect(8, 4, 8, 16), rect(18, 9, 4, 6)),
  morph: S(rect(3, 7, 8, 8), circle(18, 13, 4), "M11 11h3"),
  // текст
  hero: S("M5 5h14M12 5v14M8 19h8", "M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"),
  "text:rise": S("M4 7h9M8.5 7v12M18 20V9M15 12l3-3 3 3"),
  slide: S("M10 6h9M14.5 6v13M2 12h6M5 9l3 3-3 3"),
  "text:pop": S("M7 6h10M12 6v12", circle(12, 12, 9)),
  letters: S("M3 18l4-12 4 12M4.5 14h5", "M14 18v-8h4a2 2 0 0 1 0 4h-4M14 14h4.5a2 2 0 0 1 0 4H14"),
  wordBounce: S("M3 17c2-8 4-8 6 0M11 17c1.5-5 3-5 4.5 0M17.5 17c1-3 2-3 3 0", "M2 20h20"),
  blurIn: S("M6 6h12M12 6v12", "M3 3l2 2M21 3l-2 2M3 21l2-2M21 21l-2-2"),
  burst: S("M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"),
  typewriter: S("M4 6h8M8 6v12M15 6v12M13 6h4M13 18h4"),
  "text:drop": S("M5 4h9M9.5 4v10M18 4v10M15 11l3 3 3-3M4 20h16"),
  rotate: S("M6 7h8M10 7v11", "M19 9a6 6 0 1 1-4-4", "M19 3v4h-4"),
  skew: S("M8 5h11M13.5 5L9 19M5 19h7"),
  lines: S("M4 6h16M4 12h12M4 18h8"),
  tracking: S("M9 7h6M12 7v10M3 12h3M18 12h3M5 10l-2 2 2 2M19 10l2 2-2 2"),
  copyStyle: S(rect(8, 8, 12, 12), "M4 16V4h12"),
  pasteStyle: S(rect(5, 4, 14, 17), "M9 4V3h6v1M9 10h6M9 14h6M9 18h3"),
  subtitles: S(rect(3, 5, 18, 12), "M7 13h4M13 13h4M7 9h10M8 17l-2 3"),
  // тряска
  bump: S("M12 3v4l-3 3 6 3-6 3 3 3v2"),
  punch: S(circle(12, 12, 4), "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"),
  "shakes:whip": S("M3 12h3l3-6 3 12 3-12 3 6h3"),
  slam: S("M12 3l2 6 6-1-4 5 4 5-6-1-2 6-2-6-6 1 4-5-4-5 6 1z"),
  jitter: S("M2 12h2l1-3 2 6 2-6 2 6 2-6 2 6 2-6 1 3h2"),
  // стили
  shadow: S(rect(4, 4, 12, 12), "M20 8v12H8"),
  glow: S(circle(12, 12, 4), "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"),
  sweep: S(rect(3, 5, 18, 14), "M9 5l-4 14M15 5l-4 14"),
  blur: S("M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"),
  tint: S(circle(12, 12, 8), "M12 4v16", "M12 4a8 8 0 0 1 0 16"),
  grain: S("M5 5h.01M10 7h.01M16 5h.01M7 11h.01M13 12h.01M19 10h.01M5 17h.01M11 18h.01M17 16h.01M20 20h.01"),
  bw: S(circle(12, 12, 8), "M12 4a8 8 0 0 0 0 16z"),
  // выражения
  wiggle: S("M2 12c2-6 3 6 5 0s3-6 5 0 3 6 5 0 3-6 5 0"),
  "expr:shake": S(rect(3, 7, 13, 10), "M16 10l5-3v10l-5-3", "M1 4l2 1M1 20l2-1"),
  loopCycle: S("M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5", "M18 3v4h-4M6 21v-4h4"),
  loopPingpong: S("M4 9h16M16 5l4 4-4 4M20 15H4M8 11l-4 4 4 4"),
  loopOffset: S("M3 19l5-5 4 2 5-6 4-4", "M16 4h5v5"),
  inertia: S("M2 12h4c2 0 2-7 4-7s2 12 4 12 2-6 4-6 2 2 4 2"),
  bounce: S(circle(17, 5, 2), "M3 20c2-12 4-12 6 0 1.5-7 3-7 4.5 0 1-4 2-4 3 0", "M2 20h20"),
  elastic: S("M3 12c1-4 2-4 3 0s2 4 3 0 2-4 3 0 2 4 3 0 2-4 3 0 2 4 3 0"),
  lookAt: S("M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z", circle(12, 12, 3)),
  "expr:spin": S("M20 12a8 8 0 1 1-2.6-5.9", "M20 4v5h-5", circle(12, 12, 1)),
  pulse: S("M2 12h4l2-5 4 10 2-5h8"),
  throw: S("M4 20c2-10 10-16 16-16", "M14 4h6v6"),
  breathe: S(circle(12, 12, 8), circle(12, 12, 4)),
  beatPulse: S("M9 18V5l10-2v13", circle(6, 18, 3), circle(16, 16, 3)),
  sine: S("M2 12c2.5-8 5.5-8 8 0s5.5 8 8 0 2-2 4-2"),
  float: S("M7 15a4 4 0 0 1 .5-8A5 5 0 0 1 17 8a3.5 3.5 0 0 1 0 7z", "M8 19h8"),
  flicker: S("M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"),
  autoFade: S("M3 18L9 6h6l6 12"),
  clear: S("M20 20H8l-5-5 10-10 8 8-6 7", "M9 10l6 6"),
  // создать
  glass: S("M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M6 9l3-3M6 13l7-7"),
  glassColor: S("M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", circle(12, 12, 3)),
  glassPill: S("M7 8h10a4 4 0 0 1 0 8H7a4 4 0 0 1 0-8z", "M7 12h3"),
  solid: () => <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" /></svg>,
  adjustment: S(rect(4, 6, 16, 12), "M4 18L20 6"),
  null: S(rect(5, 5, 14, 14), "M5 5l14 14M19 5L5 19"),
  camera: S(rect(2, 7, 14, 10), "M16 11l6-3v8l-6-3"),
  vignette: S(rect(2, 4, 20, 16), circle(12, 12, 5)),
  underline: S("M7 4v7a5 5 0 0 0 10 0V4M4 21h16"),
  arrow: S("M4 12h16M14 6l6 6-6 6"),
  circle: S(circle(12, 12, 8)),
  frame: S(rect(3, 6, 18, 12)),
  cross: S("M5 5l14 14M19 5L5 19"),
  "create:burst": S("M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"),
  fx: S("M4 18V6h6M4 12h5M13 6l7 12M20 6l-7 12"),
  count: S(T("123")),
  percent: S("M19 5L5 19", circle(7, 7, 2.5), circle(17, 17, 2.5)),
  money: S(circle(12, 12, 9), T("₽", 11)),
  timer: S(circle(12, 13, 8), "M12 9v4l3 2M9 2h6"),
  // сервис
  beats: S("M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4"),
  anchor: S(circle(12, 12, 3), "M12 2v5M12 17v5M2 12h5M17 12h5"),
  align: S("M4 3v18M8 7h12M8 12h7M8 17h10"),
  distribute: S(rect(3, 8, 4, 8), rect(10, 8, 4, 8), rect(17, 8, 4, 8), "M2 4h20M2 20h20"),
  quickEase: S("M3 20C10 20 9 4 21 4", "M3 20h4M21 4h-4"),
  clone: S("M8 6l4 4-4 4-4-4z", "M16 10l4 4-4 4-4-4z"),
  reverse: S("M4 8h14l-3-3M20 16H6l3 3"),
  unprecompose: S(rect(7, 7, 10, 10), "M3 3l4 4M21 3l-4 4M3 21l4-4M21 21l-4-4"),
  dedupeFx: S(rect(3, 3, 11, 11), "M17 8h4v13H8v-4", "M6 6l5 5M11 6l-5 5"),
  merge: S(rect(3, 3, 10, 10), rect(11, 11, 10, 10)),
  toShapes: S("M3 6h8M7 6v12", "M14 18l3.5-6 3.5 6z", "M15 6h6v4h-6z"),
  split: S("M3 7h4M5 7v10M11 7h4M13 7v10M19 7h2M20 7v10"),
  precomp: S(rect(3, 3, 18, 18), rect(8, 8, 8, 8)),
  seq: S("M3 6h6M7 11h6M11 16h6M15 21h6"),
  markers: S("M5 21V4M5 4h10l-2 3 2 3H5"),
  mblur: S(rect(13, 7, 8, 10), "M2 9h8M4 12h6M2 15h8"),
  labels: S("M4 4h8l8 8-8 8-8-8z", circle(9, 9, 1.5)),
  clean: S("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"),
  // библиотека
  "lib:template": S(rect(3, 5, 18, 14), "M3 9h18M7 5v4M17 5v4"),
  "lib:preset": S("M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"),
  "lib:audio": S("M9 18V5l10-2v13", circle(6, 18, 3), circle(16, 16, 3)),
  "lib:video": S(rect(3, 5, 18, 14), "M10 9l5 3-5 3z"),
  "lib:image": S(rect(3, 5, 18, 14), circle(9, 10, 2), "M21 16l-5-5-8 8"),
};

// Пресет -> иконка: сначала «вкладка:id», потом «id», для эффектов/элементов — по виду.
export function glyphFor(tab: string, id: string): G | null {
  if (GLYPH[`${tab}:${id}`]) return GLYPH[`${tab}:${id}`];
  if (id.startsWith("fx-")) {
    const m: Record<string, string> = { "ADBE Glo2": "glow", "ADBE Gaussian Blur 2": "blur", "ADBE Drop Shadow": "shadow", "ADBE Tint": "tint", "ADBE Fill": "solid", "ADBE Black&White": "bw", "ADBE Noise": "grain" };
    return GLYPH[m[id.slice(3)] ?? "fx"];
  }
  if (id.startsWith("el-")) return GLYPH[id.slice(3) === "burst" ? "create:burst" : id.slice(3)] ?? null;
  if (id.startsWith("lib:")) return GLYPH["lib:template"];
  return GLYPH[id] ?? null;
}

/** Миниатюра кривой скорости (cubic-bezier) — иконка для кривых. */
export function MiniCurve({ c, size = 18 }: { c: [number, number, number, number]; size?: number }) {
  const X = (x: number) => 4 + x * 16, Y = (y: number) => 20 - y * 16;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={`M${X(0)} ${Y(0)} C${X(c[0])} ${Y(c[1])} ${X(c[2])} ${Y(c[3])} ${X(1)} ${Y(1)}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
