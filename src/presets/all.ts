import { CAROUSELS, SCENE_TRANSITIONS, TRANSITIONS } from "./transitions";
import { COUNTERS } from "./counters";
import { BEATS, MORPH, SUBTITLES } from "./media";
import { TEXT_PRESETS, TEXT_STYLE_PRESETS } from "./text";
import { SHAKES } from "./shakes";
import { STYLES } from "./styles";
import { EXPRESSION_PRESETS } from "./expressions-browser";
import { CREATE_PRESETS, SERVICE_PRESETS } from "./create-browser";
import type { Preset } from "./types";

/** Все вкладки-браузеры: id вкладки → заголовок списка и пресеты. */
export const TABS_PRESETS: Record<string, { title: string; presets: Preset[] }> = {
  text: { title: "Текст", presets: [...TEXT_PRESETS, ...TEXT_STYLE_PRESETS, SUBTITLES] },
  transitions: { title: "Переходы", presets: [...TRANSITIONS, ...SCENE_TRANSITIONS, ...CAROUSELS, MORPH] },
  styles: { title: "Стили", presets: STYLES },
  shakes: { title: "Тряска", presets: SHAKES },
  expr: { title: "Выражения", presets: EXPRESSION_PRESETS },
  create: { title: "Создать", presets: [...CREATE_PRESETS, ...COUNTERS] },
  service: { title: "Сервис", presets: [BEATS, ...SERVICE_PRESETS] },
};
