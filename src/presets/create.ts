// Что можно создать одним кликом.
export type LayerKind = "solid" | "adjustment" | "null" | "camera" | "vignette";
export const LAYER_ITEMS: { kind: LayerKind; title: string; name: string; hint: string }[] = [
  { kind: "solid", title: "Solid", name: "Solid", hint: "Слой-заливка выбранного цвета на всю композицию" },
  { kind: "adjustment", title: "Коррекция", name: "Корректирующий", hint: "Adjustment layer — эффекты на нём действуют на всё ниже" },
  { kind: "null", title: "Null", name: "Контроллер", hint: "Null в центре выделенных слоёв, они становятся его детьми" },
  { kind: "camera", title: "Камера", name: "Камера", hint: "Новая камера по центру кадра" },
  { kind: "vignette", title: "Виньетка", name: "Виньетка", hint: "Мягкое затемнение краёв кадра" },
];

export const EFFECT_ITEMS: { matchName: string; title: string; hint: string }[] = [
  { matchName: "ADBE Glo2", title: "Свечение", hint: "Glow" },
  { matchName: "ADBE Gaussian Blur 2", title: "Размытие", hint: "Gaussian Blur" },
  { matchName: "ADBE Drop Shadow", title: "Тень", hint: "Drop Shadow" },
  { matchName: "ADBE Tint", title: "Тонировка", hint: "Tint" },
  { matchName: "ADBE Fill", title: "Заливка", hint: "Fill" },
  { matchName: "ADBE CurvesCustom", title: "Кривые", hint: "Curves" },
  { matchName: "ADBE HUE SATURATION", title: "Цвет/насыщ.", hint: "Hue/Saturation" },
  { matchName: "ADBE Black&White", title: "Ч/Б", hint: "Black & White" },
  { matchName: "ADBE Noise", title: "Зерно", hint: "Noise" },
];

export type ElementKind = "underline" | "arrow" | "circle" | "frame" | "cross" | "burst";
export const ELEMENT_ITEMS: { kind: ElementKind; title: string; hint: string }[] = [
  { kind: "underline", title: "Подчёркивание", hint: "Линия прорисовывается слева направо" },
  { kind: "arrow", title: "Стрелка", hint: "Стрелка прорисовывается к наконечнику" },
  { kind: "circle", title: "Обвести", hint: "Круг-обводка вокруг объекта" },
  { kind: "frame", title: "Рамка", hint: "Прямоугольная рамка" },
  { kind: "cross", title: "Крестик", hint: "Зачёркивание крестом" },
  { kind: "burst", title: "Вспышка", hint: "Лучи разлетаются и исчезают" },
];
