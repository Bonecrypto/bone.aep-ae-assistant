/*
 * Поиск битов в звуке (без внешних библиотек).
 *   1. Моно-сигнал, для «Бас» — фильтр низких частот (~150 Гц), чтобы ловить бочку.
 *   2. Энергия окнами по 10 мс, «всплеск» = рост энергии относительно предыдущего окна.
 *   3. Порог = среднее всплесков вокруг (±0,5 с) × коэффициент от чувствительности.
 *   4. Пики выше порога, не ближе minGap друг к другу.
 */
export type BeatOptions = { bass: boolean; sensitivity: number; minGap: number };

export function lowpass(x: Float32Array, sampleRate: number, cutoff = 150): Float32Array {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  const y = new Float32Array(x.length);
  let v = 0, w = 0;
  // два прохода одного полюса — круче спад, бочка выделяется лучше
  for (let i = 0; i < x.length; i++) { v += a * (x[i] - v); w += a * (v - w); y[i] = w; }
  return y;
}

export function detectBeats(samples: Float32Array, sampleRate: number, o: BeatOptions): number[] {
  const x = o.bass ? lowpass(samples, sampleRate) : samples;
  const hop = Math.max(1, Math.round(sampleRate * 0.01)), win = hop * 2;
  const n = Math.floor((x.length - win) / hop);
  if (n < 3) return [];
  const energy = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const o0 = i * hop; for (let j = 0; j < win; j++) { const v = x[o0 + j]; s += v * v; } energy[i] = Math.sqrt(s / win); }
  const flux = new Float32Array(n);
  for (let i = 1; i < n; i++) flux[i] = Math.max(0, energy[i] - energy[i - 1]);
  let global = 0;
  for (let i = 0; i < n; i++) global += flux[i];
  global /= n;
  const half = 50; // ±0,5 с при шаге 10 мс
  const k = 1.2 + (1 - Math.min(1, Math.max(0, o.sensitivity))) * 3; // чувствительнее -> ниже порог
  const gap = Math.max(1, Math.round(o.minGap / 0.01));
  const beats: number[] = [];
  let last = -Infinity;
  // второй фильтр: после удара громкость должна заметно подняться над средним уровнем вокруг (в ровном шуме — нет)
  const g = 1.35 + (1 - Math.min(1, Math.max(0, o.sensitivity))) * 1.2;
  let sum = 0, esum = 0, count = 0;
  for (let i = 0; i < Math.min(n, half); i++) { sum += flux[i]; esum += energy[i]; count++; }
  for (let i = 0; i < n; i++) {
    const add = i + half, rem = i - half - 1;
    if (add < n) { sum += flux[add]; esum += energy[add]; count++; }
    if (rem >= 0) { sum -= flux[rem]; esum -= energy[rem]; count--; }
    const local = sum / Math.max(1, count), localE = esum / Math.max(1, count);
    const thr = Math.max(local * k, global * 0.6);
    if (flux[i] <= thr || flux[i] < 1e-6) continue;
    let peakE = 0;
    for (let j = i; j <= Math.min(n - 1, i + 6); j++) peakE = Math.max(peakE, energy[j]);
    if (peakE < localE * g) continue;
    // локальный максимум в окрестности ±3 окна
    let isPeak = true;
    for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) if (flux[j] > flux[i]) { isPeak = false; break; }
    if (!isPeak || i - last < gap) continue;
    beats.push((i * hop) / sampleRate);
    last = i;
  }
  return beats;
}

/** Прочитать аудиофайл через Node и декодировать встроенным декодером браузера панели -> моно. */
export async function decodeFile(path: string): Promise<{ samples: Float32Array; sampleRate: number }> {
  const w = window as any;
  const req = typeof w.require === "function" ? w.require : w.cep_node?.require;
  if (!req) throw new Error("Чтение звука работает только внутри After Effects.");
  const buf: Uint8Array = req("fs").readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const Ctx = w.AudioContext || w.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio: AudioBuffer = await ctx.decodeAudioData(ab);
    const ch = audio.numberOfChannels, len = audio.length, mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) { const d = audio.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / ch; }
    return { samples: mono, sampleRate: audio.sampleRate };
  } catch {
    throw new Error("Не удалось прочитать звук этого файла. Экспортируйте звук в WAV или MP3 и положите его в композицию.");
  } finally {
    ctx.close?.();
  }
}

/** Время в файле -> время композиции (учёт начала слоя, растяжения и обрезки). */
export function toCompTimes(times: number[], layer: { startTime: number; inPoint: number; outPoint: number; stretch: number }) {
  const k = (layer.stretch || 100) / 100;
  return times.map((t) => layer.startTime + t * k).filter((t) => t >= layer.inPoint - 1e-6 && t <= layer.outPoint + 1e-6);
}
