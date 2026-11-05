import type { CSSProperties } from "react";
import type { AnimateInput } from "../tools/ae/animate";

// Мини-превью анимации: пунктир — кадр, фиолетовый квадрат — слой.
// Анимируется при наведении на плитку (CSS в styles.css, .pv-in / .pv-out).
const offsets = { left: [-46, 0], right: [46, 0], up: [0, -28], down: [0, 28] } as const;

export function AnimPreview({ input }: { input: AnimateInput }) {
  const [dx, dy] = input.kind === "slide" ? offsets[input.direction ?? "left"] : [0, 0];
  const vars = {
    "--dx": `${dx}px`,
    "--dy": `${dy}px`,
    "--s0": input.kind === "scale" ? 0 : 1,
    "--o0": input.kind === "fade" ? 0 : 1,
  } as CSSProperties;

  return (
    <svg className="preview" viewBox="0 0 90 44" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="0" y="0" width="90" height="44" rx="6" className="pv-bg" />
      <rect x="20" y="8" width="50" height="28" rx="2" className="pv-frame" />
      <rect x="38" y="15" width="14" height="14" rx="3" className={`pv-box pv-${input.mode}`} style={vars} />
    </svg>
  );
}
