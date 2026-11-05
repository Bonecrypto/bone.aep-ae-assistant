export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
export const layersWord = (n: number) => `${n} ${plural(n, "слой", "слоя", "слоёв")}`;
export const sec = (s: number) => `${String(s).replace(".", ",")} с`;

/** #rrggbb -> [r, g, b] в диапазоне 0..1 (так цвета принимает AE). */
export const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
