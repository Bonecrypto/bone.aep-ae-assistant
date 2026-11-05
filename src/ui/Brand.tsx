// Знак bone.aep: косточка под наклоном.
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <g transform="rotate(-35 16 16)" fill="var(--accent)">
        <rect x="13" y="7" width="6" height="18" rx="3" />
        <circle cx="13.2" cy="7.5" r="3.6" /><circle cx="18.8" cy="7.5" r="3.6" />
        <circle cx="13.2" cy="24.5" r="3.6" /><circle cx="18.8" cy="24.5" r="3.6" />
      </g>
    </svg>
  );
}

export function BrandLogo() {
  return (
    <div className="brand-logo">
      <BrandMark size={34} />
      <div>
        <div className="brand-name">bone<span>.</span>aep</div>
        <div className="brand-tag">makes video better</div>
      </div>
    </div>
  );
}

/** Палитра бренда bone.aep (+ пара нейтральных вариантов акцента). */
export const BRAND_ACCENTS: { hex: string; name: string }[] = [
  { hex: "#7f00ff", name: "Violet" },
  { hex: "#9146ff", name: "Electric Purple" },
  { hex: "#8a3bd9", name: "Lavender Mist" },
  { hex: "#baa2eb", name: "Soft Lilac" },
  { hex: "#0a84ff", name: "Синий" },
  { hex: "#ff6b2c", name: "Оранжевый" },
  { hex: "#30b06f", name: "Зелёный" },
];
