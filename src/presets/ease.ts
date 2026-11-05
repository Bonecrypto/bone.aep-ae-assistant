// Готовые кривые скорости (cubic-bezier, как в CSS). Свои — с нуля, без чужих пресетов.
export type Curve = [number, number, number, number];
export type EasePreset = { id: string; title: string; curve: Curve; hint: string; group?: string };

export const EASE_PRESETS: EasePreset[] = [
  { id: "easy", title: "Easy Ease", curve: [0.33, 0, 0.67, 1], hint: "Классический плавный старт и остановка" },
  { id: "smooth", title: "Мягкий", curve: [0.45, 0, 0.55, 1], hint: "Спокойное движение без резкости" },
  { id: "out", title: "Торможение", curve: [0, 0, 0.2, 1], hint: "Быстро стартует, долго тормозит" },
  { id: "in", title: "Разгон", curve: [0.8, 0, 1, 1], hint: "Медленно стартует, уходит на скорости" },
  { id: "expo", title: "Expo", curve: [0.87, 0, 0.13, 1], hint: "Резкий разгон и резкое торможение" },
  { id: "expoOut", title: "Expo Out", curve: [0.16, 1, 0.3, 1], hint: "Мгновенный рывок и длинный хвост" },
  { id: "launch", title: "Быстрый вылет", curve: [0.05, 0.7, 0.1, 1], hint: "Вылет с места и мягкая посадка" },
  { id: "back", title: "Перелёт", curve: [0.34, 1.4, 0.64, 1], hint: "Проскакивает цель и возвращается (для 1D-свойств)" },
  { id: "spring", title: "Трамплин", curve: [0.6, -0.3, 0.74, 0.05], hint: "Отходит назад перед стартом (для 1D-свойств)" },
];

// Классические кривые (стандартные приближения функций Роберта Пеннера через cubic-bezier).
const CLASSIC: [string, string, Curve, Curve, Curve][] = [
  ["sine", "Sine", [0.12, 0, 0.39, 0], [0.61, 1, 0.88, 1], [0.37, 0, 0.63, 1]],
  ["quad", "Quad", [0.11, 0, 0.5, 0], [0.5, 1, 0.89, 1], [0.45, 0, 0.55, 1]],
  ["cubic", "Cubic", [0.32, 0, 0.67, 0], [0.33, 1, 0.68, 1], [0.65, 0, 0.35, 1]],
  ["quart", "Quart", [0.5, 0, 0.75, 0], [0.25, 1, 0.5, 1], [0.76, 0, 0.24, 1]],
  ["quint", "Quint", [0.64, 0, 0.78, 0], [0.22, 1, 0.36, 1], [0.83, 0, 0.17, 1]],
  ["expo", "Expo", [0.7, 0, 0.84, 0], [0.16, 1, 0.3, 1], [0.87, 0, 0.13, 1]],
  ["circ", "Circ", [0.55, 0, 1, 0.45], [0, 0.55, 0.45, 1], [0.85, 0, 0.15, 1]],
  ["back", "Back", [0.36, 0, 0.66, -0.56], [0.34, 1.56, 0.64, 1], [0.68, -0.6, 0.32, 1.6]],
];
export const CLASSIC_PRESETS: EasePreset[] = CLASSIC.flatMap(([id, name, i, o, io]) => [
  { id: `${id}In`, title: `${name} In`, curve: i, hint: "Разгон", group: "Классика: разгон" },
  { id: `${id}Out`, title: `${name} Out`, curve: o, hint: "Торможение", group: "Классика: торможение" },
  { id: `${id}InOut`, title: `${name} InOut`, curve: io, hint: "Разгон и торможение", group: "Классика: оба" },
]);
export const ALL_EASE_PRESETS: EasePreset[] = [...EASE_PRESETS.map((p) => ({ ...p, group: "Основные" })), ...CLASSIC_PRESETS];
