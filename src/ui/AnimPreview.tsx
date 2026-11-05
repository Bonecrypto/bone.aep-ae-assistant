import type { CSSProperties } from "react";
import type { AnimateInput } from "../tools/ae/animate";

// Мини-превью: пунктир — кадр, фиолетовый квадрат — слой. Анимируется при наведении (styles.css).
const offsets = { left: [-46, 0], right: [46, 0], up: [0, -28], down: [0, 28] } as const;

export function AnimPreview({ input }: { input: AnimateInput }) {
  const [dx, dy] = input.kind === "slide" ? offsets[input.direction ?? "left"] : [0, 0];
  const vars = {
    "--dx": `${dx}px`, "--dy": `${dy}px`,
    "--s0": input.kind === "scale" ? 0 : 1,
    "--o0": input.kind === "fade" ? 0 : 1,
    "--r0": input.kind === "rotate" ? (input.mode === "in" ? "-90deg" : "90deg") : "0deg",
  } as CSSProperties;
  const cls = `pv-box pv-${input.mode}${input.spring && input.mode === "in" && input.kind !== "fade" ? "-spring" : ""}`;
  return (
    <svg className="preview" viewBox="0 0 90 44" aria-hidden="true">
      <rect x="0" y="0" width="90" height="44" rx="6" className="pv-bg" />
      <rect x="20" y="8" width="50" height="28" rx="2" className="pv-frame" />
      <rect x="38" y="15" width="14" height="14" rx="3" className={cls} style={vars} />
    </svg>
  );
}

/** Мини-график кривой скорости (cubic-bezier) для плиток. */
export function CurveThumb({ curve }: { curve: [number, number, number, number] }) {
  const [x1, y1, x2, y2] = curve;
  const X = (x: number) => 8 + x * 74, Y = (y: number) => 26 - y * 18;
  return (
    <svg className="preview" viewBox="0 0 90 34" aria-hidden="true">
      <rect x="0" y="0" width="90" height="34" rx="6" className="pv-bg" />
      <path d={`M${X(0)} ${Y(0)} C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(1)} ${Y(1)}`} className="pv-curve" />
    </svg>
  );
}

/** Превью шейп-элемента: обводка прорисовывается при наведении. */
export function ElementThumb({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    underline: "M25 30 H65",
    arrow: "M25 22 H63 M55 15 L63 22 L55 29",
    circle: "M45 9 a13 13 0 1 1 -0.1 0",
    frame: "M24 12 H66 V32 H24 Z",
    cross: "M36 13 L54 31 M54 13 L36 31",
    burst: "M45 10 V15 M45 29 V34 M33 22 H38 M52 22 H57 M37 14 L40 17 M50 27 L53 30 M53 14 L50 17 M40 27 L37 30",
  };
  return (
    <svg className="preview" viewBox="0 0 90 44" aria-hidden="true">
      <rect x="0" y="0" width="90" height="44" rx="6" className="pv-bg" />
      <path d={paths[kind] ?? ""} className="pv-draw" pathLength={1} />
    </svg>
  );
}
