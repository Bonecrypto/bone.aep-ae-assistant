import type { Tool } from "./types";
import { animate } from "./ae/animate";
import { ease, readEase } from "./ae/ease";
import { clearExpression, customExpression, expression } from "./ae/expression";
import { addEffect, createLayer, element } from "./ae/create";
import { textCopyStyle, textPasteStyle } from "./ae/text";
import { compInfo, labelByType, precompose, removeUnused, sequence } from "./ae/service";
import { motion } from "./ae/motion";
import { applyPreset } from "./preset-tool";
import { sceneTransition } from "./ae/scene";
import { glass } from "./ae/glass";
import { align, anchor, distribute, reverseKeys, splitText } from "./ae/layout";
import { carousel, cloneKeys, extract, mergeShapes, quickEase, toShapes, unprecompose } from "./ae/mtools";
import { morph } from "./ae/audio";
import { orderLayers, organize, safeZone } from "./ae/project";
import { libraryTools } from "./ae/library";
import { getLibraryItems } from "../lib/library";

// Все инструменты, доступные ИИ в чате. Новая возможность = новый файл в tools/ + строка здесь.
export const tools: Tool<any>[] = [
  compInfo,
  applyPreset,
  motion, animate, sceneTransition,
  ...libraryTools(getLibraryItems),
  ease, readEase,
  expression, customExpression, clearExpression,
  createLayer, addEffect, element, glass,
  textCopyStyle, textPasteStyle,
  precompose, sequence, labelByType, removeUnused, anchor, align, distribute, reverseKeys, splitText, quickEase, cloneKeys, extract, unprecompose, toShapes, organize, orderLayers, safeZone, carousel, mergeShapes, morph,
];
