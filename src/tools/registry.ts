import type { Tool } from "./types";
import { animate, motionBlur } from "./ae/animate";
import { ease, readEase } from "./ae/ease";
import { clearExpression, customExpression, expression } from "./ae/expression";
import { addEffect, createLayer, element } from "./ae/create";
import { textAnimate, textCopyStyle, textPasteStyle } from "./ae/text";
import { compInfo, labelByType, precompose, removeUnused, sequence } from "./ae/service";

// Все инструменты, доступные ИИ в чате. Новая возможность = новый файл в tools/ + строка здесь.
export const tools: Tool<any>[] = [
  compInfo,
  animate, motionBlur,
  ease, readEase,
  expression, customExpression, clearExpression,
  createLayer, addEffect, element,
  textCopyStyle, textPasteStyle, textAnimate,
  precompose, sequence, labelByType, removeUnused,
];

export const getTool = (name: string) => tools.find((t) => t.name === name);
