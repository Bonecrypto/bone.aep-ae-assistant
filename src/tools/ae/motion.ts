import { layersWord } from "../../lib/format";
import { squeezeNote } from "./squeeze";
import { hostTool, undoHint } from "../host-tool";

export type MotionInput = {
  title?: string;
  mode: "in" | "out";
  duration?: number;
  stagger?: number;
  spring?: boolean;
  fade?: boolean;
  move?: { dir: "left" | "right" | "up" | "down"; distance: number } | null;
  scaleFrom?: number | null;
  rotateFrom?: number | null;
  blurFrom?: number | null;
  control?: "keys" | "marker";
  markerName?: string;
  hidden?: string;
  at?: "playhead" | "layer";
  markerStyle?: "tr" | "bar";
};

export const motion = hostTool<MotionInput>({
  name: "ae.motion",
  title: (i) => i.title ?? "Переход",
  description:
    "Переход для выделенных слоёв из нескольких свойств сразу, ключи от текущего времени. mode=in — появление, out — исчезание. " +
    "fade — прозрачность; move.dir — откуда приходит слой (left/right/up/down), move.distance — на сколько px (0 = из-за края кадра); " +
    "scaleFrom — масштаб в начале, %; rotateFrom — доворот, °; blurFrom — размытие, px (эффект Gaussian Blur); " +
    "spring — пружина с перелётом; stagger — задержка между слоями, с (слои по порядку в таймлайне). Один Ctrl+Z отменяет всё.",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["in", "out"], description: "Появление или исчезание." },
      duration: { type: "number", minimum: 0.05, maximum: 10, description: "Длительность, с." },
      stagger: { type: "number", minimum: 0, maximum: 5, description: "Сдвиг между слоями, с." },
      spring: { type: "boolean", description: "Пружина (только появление)." },
      fade: { type: "boolean", description: "Анимировать прозрачность." },
      move: { type: "object", description: "Сдвиг.", properties: { dir: { type: "string", enum: ["left", "right", "up", "down"] }, distance: { type: "number" } } },
      scaleFrom: { type: "number", description: "Масштаб в спрятанном состоянии, %." },
      rotateFrom: { type: "number", description: "Поворот в спрятанном состоянии, °." },
      blurFrom: { type: "number", description: "Размытие в спрятанном состоянии, px." },
    },
    required: ["mode"],
  },
  mutates: true,
  toArgs: (i) => ({ ...i, title: undefined, blurName: "Ассистент · размытие" }),
  done: (r, i) => `${i.title ?? "Переход"}: ${layersWord(Number(r.changed))}.${undoHint}${Number(r.foreign) ? ` · не тронуто свойств с вашими выражениями: ${r.foreign}` : ""}${squeezeNote(r.squeezed)}`,
});
