import type { Tool } from "./types";
import { flyIn } from "./ae/flyIn";

// Новая возможность = новый файл в tools/ + строка здесь.
export const tools: Tool<any>[] = [flyIn];

export const getTool = (name: string) => tools.find((t) => t.name === name);
