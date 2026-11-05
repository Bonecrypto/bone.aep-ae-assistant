import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Pose, PreviewSpec } from "../presets/types";
import { fileUrl } from "../lib/library";

const HOLD = 0.9; // пауза после анимации перед повтором, с

const style = (p: Pose): CSSProperties => ({
  transform: `translate(${p.x ?? 0}px, ${p.y ?? 0}px) scale(${p.s ?? 1}) rotate(${p.r ?? 0}deg) skewX(${p.sk ?? 0}deg)`,
  opacity: Math.max(0, Math.min(1, p.o ?? 1)),
  filter: p.b ? `blur(${p.b.toFixed(1)}px)` : undefined,
});

function split(text: string, unit: "chars" | "words" | "lines") {
  if (unit === "chars") return [...text];
  if (unit === "words") return text.split(/(\s+)/).filter((s) => s.length);
  return text.split("\n");
}

/** Живое превью: крутится по кругу, «Повтор» начинает заново. */
export function Preview({ spec, replay }: { spec: PreviewSpec; replay: number }) {
  const [t, setT] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => { start.current = performance.now(); }, [replay, spec]);
  useEffect(() => {
    if (spec.kind === "node" || spec.kind === "media") return;
    let raf = 0;
    const loop = () => {
      const len = spec.length + HOLD;
      setT((((performance.now() - start.current) / 1000) % len));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [spec]);

  if (spec.kind === "node") return <div className="stage">{spec.node}</div>;
  if (spec.kind === "media") return <div className="stage"><MediaPreview path={spec.path} /></div>;

  if (spec.kind === "cut") {
    const cut = spec.length / 2, near = Math.max(0, 1 - Math.abs(t - cut) / (spec.length / 2));
    return (
      <div className="stage cut-stage">
        <div className="scene a" style={style(spec.pose(0, t))}>A</div>
        <div className="scene b" style={style(spec.pose(1, t))}>B</div>
        {spec.flash ? <div className="flash" style={{ opacity: Math.pow(near, 3) * spec.flash }} /> : null}
        {spec.dip ? <div className="dip" style={{ opacity: Math.pow(near, 1.5) }} /> : null}
      </div>
    );
  }

  if (spec.kind === "layers") {
    return (
      <div className="stage">
        <div className={`stage-layers n${spec.count}`}>
          {Array.from({ length: spec.count }, (_, i) => (
            <div key={i} className="stage-card" style={style(spec.pose(i, t))}>{spec.count === 1 ? spec.label ?? "" : ""}</div>
          ))}
        </div>
      </div>
    );
  }

  const parts = split(spec.text, spec.unit);
  let idx = 0;
  const n = parts.filter((p) => !/^\s+$/.test(p)).length;
  return (
    <div className="stage">
      <div className={`stage-text ${spec.unit}`}>
        {parts.map((p, k) => {
          if (/^\s+$/.test(p)) return <span key={k} className="ws">{p}</span>;
          const i = idx++;
          return <span key={k} className="unit" style={style(spec.pose(i, n, t))}>{p}</span>;
        })}
      </div>
    </div>
  );
}

/** Видео/гифка/картинка из папки пользователя. Видео играет без звука по кругу. */
export function MediaPreview({ path, hover }: { path: string; hover?: boolean }) {
  const url = fileUrl(path);
  if (/\.(mp4|webm)$/i.test(path)) {
    return <video className="media" src={url} muted loop playsInline autoPlay={!hover}
      onMouseEnter={(e) => hover && e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => { if (hover) { e.currentTarget.pause(); e.currentTarget.currentTime = 0; } }} />;
  }
  return <img className="media" src={url} alt="" />;
}
