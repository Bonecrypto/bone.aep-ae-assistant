import { getPrefs } from "./store";

// Распознавание речи: OpenAI-совместимый /audio/transcriptions (Groq, OpenAI или свой сервер).
export type SttProvider = "groq" | "openai" | "custom";
export const STT: Record<SttProvider, { title: string; baseUrl: string; model: string; keyUrl?: string; hint: string }> = {
  groq: { title: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "whisper-large-v3-turbo", keyUrl: "https://console.groq.com/keys", hint: "Быстро и дёшево, есть бесплатный лимит" },
  openai: { title: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "whisper-1", keyUrl: "https://platform.openai.com/api-keys", hint: "Whisper от OpenAI" },
  custom: { title: "Свой", baseUrl: "", model: "whisper-1", hint: "Любой сервер с /audio/transcriptions" },
};

export type Segment = { start: number; end: number; text: string };

export async function transcribe(path: string, language: string): Promise<Segment[]> {
  const p = getPrefs(), def = STT[p.sttProvider];
  const base = (p.sttBaseUrl || def.baseUrl).replace(/\/+$/, "");
  if (!base) throw new Error("Укажите адрес сервиса распознавания в настройках.");
  if (!p.sttKey && p.sttProvider !== "custom") throw new Error(`Добавьте ключ ${def.title} в настройках (раздел «Субтитры»).`);
  const w = window as any;
  const req = typeof w.require === "function" ? w.require : w.cep_node?.require;
  if (!req) throw new Error("Субтитры работают только внутри After Effects.");
  const fs = req("fs"), nodePath = req("path");
  const stat = fs.statSync(path);
  if (stat.size > 25 * 1024 * 1024) throw new Error("Файл больше 25 МБ. Экспортируйте только звук в MP3 и положите его в композицию.");
  const buf: Uint8Array = fs.readFileSync(path);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)]), nodePath.basename(path));
  form.append("model", p.sttModel || def.model);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (language && language !== "auto") form.append("language", language);
  let res: Response;
  try {
    res = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: p.sttKey ? { Authorization: `Bearer ${p.sttKey}` } : {}, body: form });
  } catch {
    throw new Error(`Нет связи с ${def.title}. Проверьте интернет.`);
  }
  if (res.status === 401 || res.status === 403) throw new Error("Ключ распознавания не подошёл. Проверьте его в настройках.");
  if (!res.ok) throw new Error(`${def.title} ответил ошибкой ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json();
  const segs: Segment[] = (data.segments ?? []).map((s: any) => ({ start: Number(s.start), end: Number(s.end), text: String(s.text ?? "").trim() })).filter((s: Segment) => s.text);
  if (!segs.length && data.text) segs.push({ start: 0, end: Number(data.duration ?? 5), text: String(data.text).trim() });
  return segs;
}

/** Длинные фразы -> куски не длиннее maxChars по словам; время делится пропорционально длине. */
export function splitSegments(segs: Segment[], maxChars: number): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    if (s.text.length <= maxChars) { out.push(s); continue; }
    const words = s.text.split(/\s+/);
    const chunks: string[] = [];
    let cur = "";
    for (const wd of words) {
      if (cur && (cur + " " + wd).length > maxChars) { chunks.push(cur); cur = wd; } else cur = cur ? cur + " " + wd : wd;
    }
    if (cur) chunks.push(cur);
    const total = chunks.reduce((a, c) => a + c.length, 0), dur = s.end - s.start;
    let t = s.start;
    for (const c of chunks) { const d = (dur * c.length) / total; out.push({ start: t, end: t + d, text: c }); t += d; }
  }
  return out;
}
