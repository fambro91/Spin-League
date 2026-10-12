import { useEffect, useRef, useState } from "react";
import type { MatchEvent } from "../../shared/types";
import { makeRng } from "../../shared/rng";

type Team = { name: string; colors: [string, string] };
type P = [number, number];

const PATHS: Record<string, P[]> = {
  cross: [[0.45, 0.75], [0.7, 0.55], [0.88, 0.3], [0.86, 0.16], [0.5, 0.11]],
  fraseggio: [[0.5, 0.72], [0.34, 0.55], [0.6, 0.42], [0.42, 0.28], [0.52, 0.17]],
  tiro_fuori: [[0.45, 0.7], [0.58, 0.5], [0.5, 0.33]],
  contropiede: [[0.5, 0.98], [0.42, 0.75], [0.62, 0.5], [0.55, 0.26], [0.5, 0.17]],
  recupero: [[0.62, 0.36], [0.55, 0.28], [0.48, 0.2]],
  piazzato: [[0.985, 0.01], [0.75, 0.06], [0.52, 0.1]],
  rigore: [[0.5, 0.2], [0.5, 0.2]],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const abbr = (s: string) => s.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase().padEnd(3, s[1]?.toUpperCase() ?? "X");

function pathPoint(pts: P[], t: number): P {
  if (pts.length === 1) return pts[0];
  const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
  const lt = t * (pts.length - 1) - seg;
  return [lerp(pts[seg][0], pts[seg + 1][0], ease(lt)), lerp(pts[seg][1], pts[seg + 1][1], ease(lt))];
}

export function Replay({ highlights, home, away, seed }: { highlights: MatchEvent[]; home: Team; away: Team; seed: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const t0 = useRef(performance.now());
  const raf = useRef(0);
  const ACTION = 3.6, OUTCOME = 1.9;

  useEffect(() => { t0.current = performance.now(); }, [idx]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !highlights.length) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const Wc = cv.clientWidth, Hc = Wc * 1.3;
      if (cv.width !== Math.round(Wc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); cv.style.height = Hc + "px"; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const e = highlights[idx];
      const atk = e.team === "home" ? home : away, def = e.team === "home" ? away : home;
      const rng = makeRng(`${seed}:${idx}`);
      const jitter = () => (rng.next() - 0.5) * 0.08;
      const base = PATHS[e.schema ?? "fraseggio"] ?? PATHS.fraseggio;
      const pts: P[] = base.map(([x, y], i) => [Math.min(0.97, Math.max(0.03, x + (i ? jitter() : 0) * (e.schema === "piazzato" && i === 0 ? 0 : 1))), y + (i ? jitter() * 0.5 : 0)]);
      const flip = rng.chance(0.5) && e.schema !== "rigore";
      if (flip) for (const p of pts) p[0] = 1 - p[0];
      const goalX = 0.5 + (rng.next() - 0.5) * 0.1;
      const end: P[] = e.type === "gol" ? [[goalX, -0.035]] : e.type === "parata" ? [[0.5 + (goalX - 0.5) * 0.6, 0.045], [goalX < 0.5 ? 0.25 : 0.75, 0.0]] : e.type === "palo" ? [[goalX < 0.5 ? 0.435 : 0.565, 0.0], [goalX < 0.5 ? 0.3 : 0.7, 0.16]] : [[goalX < 0.5 ? 0.33 : 0.67, -0.05]];

      let elapsed = playing ? (now - t0.current) / 1000 : ACTION;
      if (reduce) elapsed = Math.max(elapsed, ACTION);
      const tAct = Math.min(1, elapsed / ACTION);
      const tOut = Math.max(0, Math.min(1, (elapsed - ACTION) / 0.6));
      let ball: P = e.type === "rosso" ? [0.5, 0.5] : pathPoint(pts, tAct);
      if (tAct >= 1 && e.type !== "rosso") ball = pathPoint([pts[pts.length - 1], ...end], tOut);

      // campo (metà campo, porta in alto)
      const W = Wc, H = Hc, X = (x: number) => 14 + x * (W - 28), Y = (y: number) => 34 + y * (H - 48);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#1f7a45" : "#237f4a"; ctx.fillRect(0, (H / 8) * i, W, H / 8 + 1); }
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2;
      ctx.strokeRect(X(0), Y(0), X(1) - X(0), Y(1) - Y(0));
      ctx.strokeRect(X(0.2), Y(0), X(0.8) - X(0.2), Y(0.3) - Y(0));
      ctx.strokeRect(X(0.38), Y(0), X(0.62) - X(0.38), Y(0.1) - Y(0));
      ctx.beginPath(); ctx.arc(X(0.5), Y(1), (X(1) - X(0)) * 0.15, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(0.5), Y(0.2), 2.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
      // porta
      const shake = e.type === "gol" && tOut > 0.8 && !reduce ? Math.sin(now / 30) * 2 : 0;
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(X(0.42) + shake, Y(0) - 16, X(0.58) - X(0.42), 16);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(X(0.42) + shake, Y(0) - 16, X(0.58) - X(0.42), 16);

      const dot = (p: P, fill: string, stroke: string, r = 7.5) => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); };
      // difensori + portiere
      const defBase: P[] = [[0.25, 0.24], [0.42, 0.19], [0.58, 0.19], [0.75, 0.24]];
      for (const d of defBase) dot([lerp(d[0], ball[0], 0.22), lerp(d[1], Math.min(ball[1], 0.5), 0.2)], def.colors[0], def.colors[1]);
      const gkX = Math.max(0.43, Math.min(0.57, lerp(0.5, ball[0], 0.4)));
      dot(e.type === "parata" && tAct >= 1 ? [lerp(gkX, end[0][0], Math.min(1, tOut * 2)), 0.05] : [gkX, 0.045], def.colors[1], def.colors[0]);
      // attaccanti
      const atkBase: P[] = [[0.18, 0.5], [0.82, 0.48], [0.5, 0.42], [0.35, 0.26], [0.65, 0.27]];
      atkBase.forEach((a, i) => dot([lerp(a[0], ball[0], 0.3 + i * 0.03), lerp(a[1], ball[1], 0.3)], atk.colors[0], atk.colors[1]));
      if (e.type !== "rosso") {
        const carrier: P = tAct < 1 ? [ball[0] - 0.02, ball[1] + 0.03] : [pts[pts.length - 1][0] - 0.02, pts[pts.length - 1][1] + 0.03];
        dot(carrier, atk.colors[0], "#ffb31a", 8.5);
        ctx.beginPath(); ctx.arc(X(ball[0]), Y(ball[1]), 4.5, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.stroke();
      }

      // tabellone
      const sc = e.type === "gol" && tAct < 1 ? [e.score![0] - (e.team === "home" ? 1 : 0), e.score![1] - (e.team === "away" ? 1 : 0)] : e.score!;
      ctx.fillStyle = "rgba(4,18,12,0.85)"; ctx.beginPath(); ctx.roundRect(W / 2 - 112, 4, 224, 26, 7); ctx.fill();
      ctx.font = "800 17px 'Big Shoulders Display', sans-serif"; ctx.textBaseline = "middle";
      ctx.fillStyle = home.colors[0]; ctx.fillRect(W / 2 - 104, 10, 6, 14);
      ctx.fillStyle = away.colors[0]; ctx.fillRect(W / 2 + 98, 10, 6, 14);
      ctx.fillStyle = "#f3f6ee"; ctx.textAlign = "left"; ctx.fillText(abbr(home.name), W / 2 - 93, 18);
      ctx.textAlign = "right"; ctx.fillText(abbr(away.name), W / 2 + 93, 18);
      ctx.textAlign = "center"; ctx.fillStyle = "#ffb31a"; ctx.fillText(`${sc[0]} - ${sc[1]}`, W / 2 - 10, 18);
      ctx.fillStyle = "rgba(243,246,238,0.7)"; ctx.font = "600 12px Barlow, sans-serif"; ctx.fillText(`${e.minute}'`, W / 2 + 34, 18);

      // didascalia
      if (tAct >= 1 || e.type === "rosso") {
        const label = e.type === "gol" ? "GOL!" : e.type === "parata" ? "Parata!" : e.type === "palo" ? "Palo!" : e.type === "fuori" ? "Fuori di poco" : "Espulso!";
        ctx.fillStyle = "rgba(4,18,12,0.82)"; ctx.beginPath(); ctx.roundRect(16, H - 74, W - 32, 58, 10); ctx.fill();
        ctx.textAlign = "center"; ctx.fillStyle = e.type === "gol" ? "#ffb31a" : e.type === "rosso" ? "#e0343f" : "#f3f6ee";
        ctx.font = "900 26px 'Big Shoulders Display', sans-serif"; ctx.fillText(label, W / 2, H - 54);
        ctx.fillStyle = "#f3f6ee"; ctx.font = "600 14px Barlow, sans-serif"; ctx.fillText(`${e.player ?? ""} · ${atk.name}`, W / 2, H - 30);
        if (e.type === "rosso") { ctx.fillStyle = "#e0343f"; ctx.fillRect(W / 2 - 14, H / 2 - 40, 28, 40); }
        if (e.type === "gol" && !reduce) {
          const cr = makeRng(`${seed}:conf:${idx}`);
          const k = Math.min(1, (elapsed - ACTION) / OUTCOME);
          for (let i = 0; i < 60; i++) {
            const x = cr.next() * W, vy = 60 + cr.next() * 140, y = -10 + vy * k * 2.2;
            ctx.fillStyle = i % 2 ? atk.colors[0] : atk.colors[1];
            ctx.fillRect(x + Math.sin(now / 200 + i) * 6, y, 5, 8);
          }
        }
      }
      if (playing && elapsed > ACTION + OUTCOME) {
        if (idx < highlights.length - 1) { setIdx(idx + 1); return; }
        setPlaying(false);
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [idx, playing, highlights, home, away, seed]);

  if (!highlights.length) return <p className="muted">Partita senza azioni da rivedere.</p>;
  return (
    <div className="replay">
      <canvas ref={ref} role="img" aria-label={`Highlight ${idx + 1} di ${highlights.length}`} />
      <div className="replay-ctrl">
        <button className="btn ghost small" disabled={idx === 0} onClick={() => { setIdx(idx - 1); setPlaying(true); }}aria-label="Highlight precedente">‹ Prec.</button>
        <span className="small muted" style={{ whiteSpace: "nowrap" }}>{idx + 1} / {highlights.length}</span>
        {playing
          ? <button className="btn ghost small" onClick={() => setPlaying(false)}>Pausa</button>
          : <button className="btn small" onClick={() => { if (idx === highlights.length - 1) setIdx(0); t0.current = performance.now(); setPlaying(true); }}>{idx === highlights.length - 1 ? "Rivedi" : "Riprendi"}</button>}
        <button className="btn ghost small" disabled={idx >= highlights.length - 1} onClick={() => { setIdx(idx + 1); setPlaying(true); }}aria-label="Highlight successivo">Succ. ›</button>
      </div>
    </div>
  );
}
