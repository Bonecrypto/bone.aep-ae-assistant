import { setBusy } from "../lib/busy";
import { decodeFile, detectBeats, toCompTimes } from "../lib/beats";
import { callHost } from "../lib/cep";
import { getPrefs, setStatus } from "../lib/store";
import { splitSegments, transcribe } from "../lib/stt";
import { humanError } from "../tools/errors";
import { addMarkers, morph, subtitles } from "../tools/ae/audio";
import { act, slider, type Ctl, type Preset, type Values } from "./types";
import type { ToolResult } from "../tools/types";

// Долгие действия со звуком: читаем файл и считаем в панели, а в AE только ставим результат.
async function step<T>(text: string, fn: () => Promise<T>): Promise<T> {
  setStatus({ kind: "busy", text });
  return fn();
}

async function withAudio(run: (info: any) => Promise<ToolResult | null>): Promise<ToolResult | null> {
  setBusy(true);
  try {
    const info = await callHost("ae.audioInfo");
    if (!info.ok) { setStatus({ kind: "error", text: humanError(info.code, info) }); return null; }
    return await run(info);
  } catch (e) {
    setStatus({ kind: "error", text: (e as Error).message ?? String(e) });
    return null;
  } finally {
    setBusy(false);
  }
}

const bars = <div className="beat-stage">{Array.from({ length: 16 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 4) * 0.12}s`, height: `${30 + ((i * 37) % 60)}%` }} />)}</div>;

export const BEATS: Preset = {
  id: "beats", title: "Маркеры на биты", subtitle: "Найти удары в музыке", group: "Звук",
  controls: [
    { type: "seg", key: "mode", label: "Ловить", value: "bass", options: [{ value: "bass", label: "Бочку (бас)" }, { value: "all", label: "Все акценты" }] },
    slider("sens", "Чувствительность", 60, 0, 100, 1, "%"),
    slider("gap", "Не чаще чем раз в", 0.3, 0.05, 2, 0.05, "с"),
    { type: "seg", key: "target", label: "Куда", value: "comp", options: [{ value: "comp", label: "На композицию" }, { value: "layer", label: "На слой звука" }] },
    { type: "toggle", key: "replace", label: "Заменить прошлые маркеры битов", value: true },
  ] as Ctl[],
  preview: () => ({ kind: "node", node: bars }),
  hint: () => "Выделите слой с музыкой (или он найдётся сам)",
  applyLabel: "Найти биты",
  run: (v: Values) => withAudio(async (info) => {
    const { samples, sampleRate } = await step(`Читаю звук «${info.name}»…`, () => decodeFile(String(info.path)));
    const raw = await step("Ищу биты…", async () => detectBeats(samples, sampleRate, { bass: v.mode === "bass", sensitivity: v.sens / 100, minGap: v.gap }));
    const times = toCompTimes(raw, info);
    if (!times.length) { setStatus({ kind: "error", text: "Битов не нашлось — увеличьте чувствительность." }); return null; }
    setBusy(false);
    const r = await addMarkers.run({ times, comment: "Бит", target: v.target, layerIndex: Number(info.index), replace: v.replace });
    setStatus({ kind: r.ok ? "ok" : "error", text: r.message });
    return r;
  }),
};

const caption = <div className="sub-stage"><span>Так будут выглядеть субтитры</span></div>;

export const SUBTITLES: Preset = {
  id: "subtitles", title: "Субтитры из звука", subtitle: "Речь → текстовые слои по фразам", group: "Субтитры",
  controls: [
    { type: "seg", key: "lang", label: "Язык", value: "auto", options: [{ value: "auto", label: "Авто" }, { value: "ru", label: "Рус" }, { value: "en", label: "Eng" }, { value: "uk", label: "Укр" }] },
    slider("chars", "Символов в строке", 42, 15, 90, 1),
    { type: "seg", key: "pos", label: "Где", value: "bottom", options: [{ value: "bottom", label: "Внизу" }, { value: "center", label: "По центру" }] },
    { type: "toggle", key: "style", label: "Стиль из «Копировать стиль»", value: true },
  ] as Ctl[],
  preview: () => ({ kind: "node", node: caption }),
  hint: () => (getPrefs().sttKey || getPrefs().sttProvider === "custom" ? "Выделите слой со звуком или видео с речью" : "Нужен ключ Groq или OpenAI — шестерёнка → «Субтитры»"),
  applyLabel: "Сделать субтитры",
  run: (v: Values) => withAudio(async (info) => {
    const segs = await step(`Распознаю речь «${info.name}»… (может занять минуту)`, () => transcribe(String(info.path), v.lang));
    const k = (Number(info.stretch) || 100) / 100;
    const parts = splitSegments(segs, v.chars)
      .map((s) => ({ ...s, start: Number(info.startTime) + s.start * k, end: Number(info.startTime) + s.end * k }))
      .filter((s) => s.end > Number(info.inPoint) && s.start < Number(info.outPoint));
    if (!parts.length) { setStatus({ kind: "error", text: "Речь не распознана." }); return null; }
    setBusy(false);
    const r = await subtitles.run({ segments: parts, position: v.pos, style: v.style ? getPrefs().textStyle : null });
    setStatus({ kind: r.ok ? "ok" : "error", text: r.message });
    return r;
  }),
};

const morphStage = <div className="morph-stage"><span /></div>;

export const MORPH: Preset = {
  id: "morph", title: "Морфинг фигур", subtitle: "Одна фигура перетекает в другую", group: "Морфинг",
  controls: [slider("duration", "Длительность", 1, 0.1, 10, 0.05, "с")],
  preview: () => ({ kind: "node", node: morphStage }),
  hint: (_v, sel) => (sel.selected === 2 ? "Сначала выделенная фигура перетечёт во вторую" : "Выделите ровно две шейп-фигуры: сначала «из», потом «в»"),
  build: (v) => act(morph, { duration: v.duration }),
};
