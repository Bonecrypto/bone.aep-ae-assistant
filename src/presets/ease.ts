// Готовые кривые скорости (cubic-bezier, как в CSS). Свои — с нуля, без чужих пресетов.
export type Curve = [number, number, number, number];
export type EasePreset = { id: string; title: string; curve: Curve; hint: string };

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
