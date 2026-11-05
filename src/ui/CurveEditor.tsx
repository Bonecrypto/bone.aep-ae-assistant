import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Curve } from "../presets/ease";

// Редактор кривой скорости: тянем две ручки cubic-bezier. По x — время (0..1), по y — значение.
const PAD = 0.08, YMIN = -0.5, YMAX = 1.5;
const W = 1 + PAD * 2, H = YMAX - YMIN;
const sx = (x: number) => x + PAD;
const sy = (y: number) => YMAX - y;
const round = (v: number) => Math.round(v * 100) / 100;

export function CurveEditor({ curve, onChange }: { curve: Curve; onChange: (c: Curve) => void }) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  // SVG растянут по ширине (preserveAspectRatio="none"), поэтому ручки рисуем эллипсами,
  // которые на экране выглядят кругами: радиус в пикселях переводим в единицы по каждой оси.
  const [px, setPx] = useState({ x: 0.01, y: 0.01 });
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const update = () => { const r = el.getBoundingClientRect(); if (r.width && r.height) setPx({ x: W / r.width, y: H / r.height }); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [x1, y1, x2, y2] = curve;

  const move = (e: PointerEvent) => {
    if (drag === null || !svg.current) return;
    const ctm = svg.current.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = round(Math.min(1, Math.max(0, pt.x - PAD)));
    const y = round(Math.min(YMAX, Math.max(YMIN, YMAX - pt.y)));
    onChange(drag === 0 ? [x, y, x2, y2] : [x1, y1, x, y]);
  };

  const handle = (i: 0 | 1, x: number, y: number) => (
    <ellipse cx={sx(x)} cy={sy(y)} rx={6 * px.x} ry={6 * px.y} className="ce-handle"
      onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); setDrag(i); }} />
  );

  return (
    <svg ref={svg} className="curve-editor" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
      <rect x={sx(0)} y={sy(1)} width={1} height={1} className="ce-box" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="ce-diag" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(x1)} y2={sy(y1)} className="ce-arm" />
      <line x1={sx(1)} y1={sy(1)} x2={sx(x2)} y2={sy(y2)} className="ce-arm" />
      <path d={`M${sx(0)} ${sy(0)} C${sx(x1)} ${sy(y1)} ${sx(x2)} ${sy(y2)} ${sx(1)} ${sy(1)}`} className="ce-curve" />
      {handle(0, x1, y1)}
      {handle(1, x2, y2)}
    </svg>
  );
}
