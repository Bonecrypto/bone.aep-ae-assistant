// Кривые для живых превью и для выражений в AE (одни и те же формулы).
export type EaseKind = "smooth" | "expo" | "back" | "elastic" | "linear";

export const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Кривая «выхода» (появление): быстро стартует, мягко останавливается. */
export function easeOut(kind: EaseKind, p: number): number {
  p = clamp01(p);
  switch (kind) {
    case "linear": return p;
    case "expo": return p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    case "back": { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
    case "elastic": return p === 0 || p === 1 ? p : Math.pow(2, -10 * p) * Math.sin(((p * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
    default: return 1 - Math.pow(1 - p, 3);
  }
}
/** Зеркальная кривая для исчезания: медленно стартует, уходит на скорости. */
export const easeIn = (kind: EaseKind, p: number) => 1 - easeOut(kind, 1 - clamp01(p));

/** Те же кривые текстом для выражений AE (переменная p уже в 0..1). */
export const EASE_EXPR: Record<EaseKind, string> = {
  linear: "p",
  smooth: "1 - Math.pow(1 - p, 3)",
  expo: "(p == 1 ? 1 : 1 - Math.pow(2, -10 * p))",
  back: "(1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2))",
  elastic: "((p == 0 || p == 1) ? p : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * 2 * Math.PI / 3) + 1)",
};

/** cubic-bezier(x1, y1, x2, y2) как функция времени — для превью кривых. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    x = clamp01(x);
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1;
    if (Math.abs(X(t) - x) > 1e-4) { t = x; for (let i = 0; i < 30; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return Y(t);
  };
}
