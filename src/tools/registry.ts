import type { Tool } from "./types";
import { animate } from "./ae/animate";

// Новая возможность = новый файл в tools/ + строка здесь.
export const tools: Tool<any>[] = [animate];

export const getTool = (name: string) => tools.find((t) => t.name === name);
