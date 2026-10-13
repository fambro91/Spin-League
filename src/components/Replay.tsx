import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchEvent, MatchStats } from "../../shared/types";
import { matchStats } from "../../shared/engine";
import { makeRng } from "../../shared/rng";
import { IcBack, IcNext, IcPause, IcPlay } from "./Icons";

type Team = { name: string; colors: [string, string] };
type P = [number, number];

/** Percorsi della palla per schema d'azione, in coordinate "attacco verso destra" (x 0→1 = da porta propria a porta avversaria). */
const PATHS: Record<string, P[]> = {
  cross: [[0.55, 0.5], [0.72, 0.24], [0.9, 0.14], [0.88, 0.5]],
  fraseggio: [[0.5, 0.55], [0.62, 0.38], [0.72, 0.62], [0.84, 0.46]],
  tiro_fuori: [[0.55, 0.5], [0.66, 0.42], [0.76, 0.5]],
  contropiede: [[0.25, 0.5], [0.45, 0.32], [0.66, 0.58], [0.83, 0.47]],
  recupero: [[0.74, 0.3], [0.8, 0.36], [0.85, 0.44]],
  piazzato: [[0.995, 0.015], [0.94, 0.3], [0.9, 0.48]],
  rigore: [[0.895, 0.5], [0.895, 0.5]],
};

const ACTION = 3.8, OUTCOME = 2.2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function pathPoint(pts: P[], tIn: number): P {
  const t = clamp01(tIn);
  if (pts.length === 1) return pts[0];
  const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
  const lt = t * (pts.length - 1) - seg;
  return [lerp(pts[seg][0], pts[seg + 1][0], ease(lt)), lerp(pts[seg][1], pts[seg + 1][1], ease(lt))];
}

/** 11 posizioni per il modulo, squadra che attacca verso destra (x nella propria metà). */
function formation(mod: string): P[] {
  // [l, y]: l = linea normalizzata (0 difesa → 1 attacco), y = posizione laterale
  const lines = mod.split("-").map(Number).filter((n) => n > 0);
  const out: P[] = [[-1, 0.5]];
  lines.forEach((n, li) => {
    const l = li / Math.max(1, lines.length - 1);
    for (let i = 0; i < n; i++) out.push([l, 0.08 + ((i + 1) / (n + 1)) * 0.84]);
  });
  return out;
}

export const abbr = (s: string) => {
  const w = s.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean);
  const a = (w.length > 1 ? w.slice(-1)[0] : w[0] ?? "XXX").slice(0, 3);
  return a.toUpperCase().padEnd(3, "X");
};

type Props = {
  highlights: MatchEvent[]; events?: MatchEvent[]; home: Team; away: Team; seed: string;
  modules?: [string, string]; stats?: MatchStats;
};

const rgb = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const dist = (a: string, b: string) => { try { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); } catch { return 999; } };

/** Se le maglie si somigliano, gli ospiti usano la seconda maglia (o il bianco). */
function kit(home: Team, away: Team): Team {
  if (dist(home.colors[0], away.colors[0]) > 110) return away;
  if (dist(home.colors[0], away.colors[1]) > 110) return { ...away, colors: [away.colors[1], away.colors[0]] };
  return { ...away, colors: ["#f3f6ee", "#111827"] };
}

export function Replay({ highlights, events, home, away: awayIn, seed, modules = ["4-4-2", "4-4-2"], stats }: Props) {
  const away = useMemo(() => kit(home, awayIn), [home, awayIn]);
  const ref = useRef<HTMLCanvasElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const t0 = useRef(0);
  const raf = useRef(0);
  const st = useMemo(() => stats ?? matchStats(events ?? highlights, 60, 60, "equilibrato", "equilibrato"), [stats, events, highlights]);
  const forms = useMemo(() => [formation(modules[0]), formation(modules[1])], [modules[0], modules[1]]);

  useEffect(() => { t0.current = performance.now(); }, [idx]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !highlights.length) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const e = highlights[idx];
    const atkHome = e.team === "home";
    const atk = atkHome ? home : away, def = atkHome ? away : home;
    const rng = makeRng(`${seed}:${idx}`);
    // percorso in coordinate "attacco a destra"
    const base = PATHS[e.schema ?? "fraseggio"] ?? PATHS.fraseggio;
    const flipY = rng.chance(0.5) && e.schema !== "rigore";
    const pts: P[] = base.map(([x, y], i) => {
      const jy = i && e.schema !== "rigore" ? (rng.next() - 0.5) * 0.12 : 0;
      const yy = Math.max(0.03, Math.min(0.97, y + jy));
      return [x, flipY ? 1 - yy : yy];
    });
    const gy = 0.5 + (rng.next() - 0.5) * 0.09;
    const end: P[] =
      e.type === "gol" ? [[1.02, gy]] :
      e.type === "parata" ? [[0.965, lerp(0.5, gy, 0.6)], [0.95, gy < 0.5 ? 0.3 : 0.7]] :
      e.type === "palo" ? [[1.0, gy < 0.5 ? 0.447 : 0.553], [0.88, gy < 0.5 ? 0.3 : 0.7]] :
      e.type === "fuori" ? [[1.03, gy < 0.5 ? 0.38 : 0.62]] : [[0.5, 0.5]];
    const confetti = Array.from({ length: 70 }, () => ({ x: rng.next(), v: 0.4 + rng.next() * 0.9, d: rng.next() * 6, c: rng.chance(0.5) }));
    const toScreen = (p: P): P => (atkHome ? p : [1 - p[0], p[1]]); // ospiti attaccano verso sinistra

    const frame = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const Wc = cv.clientWidth, Hc = Math.round(Wc * 0.68);
      if (!Wc) { raf.current = requestAnimationFrame(frame); return; }
      if (cv.width !== Math.round(Wc * dpr) || cv.height !== Math.round(Hc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); cv.style.height = Hc + "px"; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 12;
      const X = (x: number) => pad + x * (Wc - 2 * pad), Y = (y: number) => pad + y * (Hc - 2 * pad);

      let elapsed = playing ? Math.max(0, (now - t0.current) / 1000) : ACTION + 0.7;
      if (reduce) elapsed = Math.max(elapsed, ACTION + 0.7);
      const tAct = clamp01(elapsed / ACTION);
      const tOut = clamp01((elapsed - ACTION) / 0.7);
      let ball: P = e.type === "rosso" ? [0.55, 0.5] : pathPoint(pts, tAct);
      if (tAct >= 1 && e.type !== "rosso") ball = pathPoint([pts[pts.length - 1], ...end], tOut);

      // campo
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? "#1f7a45" : "#248550"; ctx.fillRect((Wc / 12) * i, 0, Wc / 12 + 1, Hc); }
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.6;
      ctx.strokeRect(X(0), Y(0), X(1) - X(0), Y(1) - Y(0));
      ctx.beginPath(); ctx.moveTo(X(0.5), Y(0)); ctx.lineTo(X(0.5), Y(1)); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), (Y(1) - Y(0)) * 0.135, 0, Math.PI * 2); ctx.stroke();
      for (const side of [0, 1]) {
        const bx = side ? 1 - 0.157 : 0, sx = side ? 1 - 0.052 : 0;
        ctx.strokeRect(X(bx), Y(0.2035), X(0.157) - X(0), Y(0.7965) - Y(0.2035));
        ctx.strokeRect(X(sx), Y(0.365), X(0.052) - X(0), Y(0.635) - Y(0.365));
        ctx.beginPath(); ctx.arc(X(side ? 0.895 : 0.105), Y(0.5), 1.8, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        const gx = side ? X(1) : X(0) - 7;
        const shake = side === (atkHome ? 1 : 0) && e.type === "gol" && tOut > 0.6 && !reduce ? Math.sin(now / 25) * 1.5 : 0;
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(gx + shake, Y(0.446), 7, Y(0.554) - Y(0.446));
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(gx + shake, Y(0.446), 7, Y(0.554) - Y(0.446)); ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(255,255,255,0.85)";
      }

      // giocatori (in coordinate "attacco a destra")
      const r = Math.max(4.5, Wc / 62);
      const dot = (p: P, fill: string, stroke: string, ring = false) => {
        const [sx, sy] = toScreen(p);
        ctx.beginPath(); ctx.arc(X(sx), Y(sy), r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
        if (ring) { ctx.beginPath(); ctx.arc(X(sx), Y(sy), r + 3.5, 0, Math.PI * 2); ctx.strokeStyle = "#ffb31a"; ctx.lineWidth = 2; ctx.stroke(); }
      };
      const sway = (i: number) => Math.sin(now / 600 + i * 1.7) * 0.006;
      const atkForm = forms[atkHome ? 0 : 1], defForm = forms[atkHome ? 1 : 0];
      // difensori: nella propria metà (lato destro), compatti verso la palla
      defForm.forEach(([fx, fy], i) => {
        if (i === 0) { const gyk = Math.max(0.42, Math.min(0.58, lerp(0.5, ball[1], 0.5))); const save = e.type === "parata" && tAct >= 1 ? lerp(gyk, end[0][1], clamp01(tOut * 2)) : gyk; dot([0.97, save], def.colors[1], def.colors[0]); return; }
        const bx = 0.88 - fx * 0.32, by = fy;
        dot([lerp(bx, ball[0], 0.12) + sway(i), lerp(by, ball[1], 0.25) + sway(i + 3)], def.colors[0], def.colors[1]);
      });
      // attaccanti: avanzati, il più vicino alla palla la porta
      const atkPos: P[] = atkForm.map(([fx, fy], i) => i === 0 ? [0.06, 0.5] : [lerp(0.4 + fx * 0.42, ball[0], 0.12) + sway(i + 5), lerp(fy, ball[1], 0.15) + sway(i + 7)]);
      let carrier = 1, best = 9;
      atkPos.forEach((p, i) => { if (i === 0) return; const d = Math.hypot(p[0] - ball[0], p[1] - ball[1]); if (d < best) { best = d; carrier = i; } });
      atkPos.forEach((p, i) => {
        if (i === carrier && tAct < 1 && e.type !== "rosso") dot([ball[0] - 0.012, ball[1] + 0.012], atk.colors[0], atk.colors[1], true);
        else dot(p, atk.colors[0], atk.colors[1]);
      });
      // palla
      if (e.type !== "rosso") {
        const [bx, by] = toScreen(ball);
        ctx.beginPath(); ctx.arc(X(bx), Y(by) + 2, 4, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill();
        ctx.beginPath(); ctx.arc(X(bx), Y(by), 4.2, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 1; ctx.stroke();
      }
      // minuto
      ctx.fillStyle = "rgba(4,18,12,0.8)"; ctx.beginPath(); ctx.roundRect(pad + 4, pad + 4, 46, 22, 6); ctx.fill();
      ctx.fillStyle = "#ffb31a"; ctx.font = "800 15px 'Big Shoulders Display', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`${e.minute}'`, pad + 27, pad + 15);

      // riquadro esito
      if (tAct >= 1 || e.type === "rosso") {
        const label = e.type === "gol" ? "GOL!" : e.type === "parata" ? "PARATA!" : e.type === "palo" ? "PALO!" : e.type === "fuori" ? "FUORI!" : "ESPULSO!";
        const bw = Math.min(230, Wc * 0.62), bh = 68, bx = Wc / 2 - bw / 2, by = Hc - bh - pad - 6;
        ctx.fillStyle = "rgba(4,18,12,0.88)"; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill();
        ctx.strokeStyle = e.type === "gol" ? "#ffb31a" : "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = e.type === "gol" ? "#ffb31a" : e.type === "rosso" ? "#e0343f" : "#f3f6ee";
        ctx.font = "900 26px 'Big Shoulders Display', sans-serif"; ctx.fillText(label, Wc / 2, by + 22);
        ctx.fillStyle = "#f3f6ee"; ctx.font = "600 13px Barlow, sans-serif";
        ctx.fillText(`${e.minute}' · ${e.score?.[0] ?? 0}-${e.score?.[1] ?? 0}`, Wc / 2, by + 43);
        ctx.fillStyle = "rgba(243,246,238,0.75)"; ctx.font = "500 12px Barlow, sans-serif";
        ctx.fillText(`${e.player ?? ""} · ${atk.name}`, Wc / 2, by + 59);
        if (e.type === "rosso") { ctx.fillStyle = "#e0343f"; ctx.fillRect(Wc / 2 - 11, by - 40, 22, 32); }
        if (e.type === "gol" && !reduce) {
          const k = clamp01((elapsed - ACTION) / OUTCOME);
          confetti.forEach((c, i) => {
            ctx.fillStyle = c.c ? atk.colors[0] : (atk.colors[1] === "#ffffff" ? "#ffb31a" : atk.colors[1]);
            ctx.fillRect(c.x * Wc + Math.sin(now / 220 + c.d) * 6, -10 + k * Hc * 1.4 * c.v, 4, 7);
            void i;
          });
        }
      }
      if (playing && elapsed > ACTION + OUTCOME) {
        if (idx < highlights.length - 1) { setIdx((v) => v + 1); return; }
        setPlaying(false);
        return;
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [idx, playing, highlights, home, away, seed, forms]);

  if (!highlights.length) return <p className="muted">Partita senza azioni da rivedere.</p>;
  const key = (x: MatchEvent) => `${x.minute}|${x.team}|${x.type}|${x.player ?? ""}`;
  const hiIndex = new Map(highlights.map((x, i) => [key(x), i]));
  const tl = [...highlights, ...(events ?? []).filter((x) => (x.type === "gol" || x.type === "rosso") && !hiIndex.has(key(x)))];
  const restart = (i: number) => { setIdx(i); t0.current = performance.now(); setPlaying(true); };
  const posH = st.possession[0];
  return (
    <div className="replay">
      <canvas ref={ref} role="img" aria-label={`Highlight ${idx + 1} di ${highlights.length}: ${highlights[idx].type} al ${highlights[idx].minute}'`} />
      <div className="replay-ctrl">
        <button className="icon-btn" aria-label="Azione precedente" disabled={idx === 0} onClick={() => restart(idx - 1)}><IcBack /></button>
        {playing
          ? <button className="icon-btn big" aria-label="Pausa" onClick={() => setPlaying(false)}><IcPause /></button>
          : <button className="icon-btn big" aria-label={idx === highlights.length - 1 ? "Rivedi" : "Riprendi"} onClick={() => restart(idx === highlights.length - 1 ? 0 : idx)}><IcPlay /></button>}
        <button className="icon-btn" aria-label="Azione successiva" disabled={idx >= highlights.length - 1} onClick={() => restart(idx + 1)}><IcNext /></button>
        <span className="small muted">{idx + 1}/{highlights.length}</span>
      </div>
      <div className="timeline" aria-label="Momenti della partita">
        <div className="tl-track" />
        <span className="tl-tick" style={{ left: "50%" }} />
        {tl.map((x, i) => {
          const hi = hiIndex.get(key(x)) ?? -1;
          const c = x.team === "home" ? home.colors[0] : away.colors[0];
          return (
            <button key={i} className={`tl-mark ${x.type} ${hi === idx ? "on" : ""}`} style={{ left: `${(Math.min(90, x.minute) / 90) * 100}%`, background: x.type === "rosso" ? "#e0343f" : c }}
              aria-label={`${x.minute}' ${x.type} ${x.player ?? ""}`} onClick={() => hi >= 0 && restart(hi)} disabled={hi < 0} />
          );
        })}
        <div className="tl-labels"><span>0'</span><span>45'</span><span>90'</span></div>
      </div>
      <div className="mstats">
        <div className="mrow"><strong>{st.shots[0]}</strong><span>Tiri</span><strong>{st.shots[1]}</strong></div>
        <div className="mrow"><strong>{st.onTarget[0]}</strong><span>In porta</span><strong>{st.onTarget[1]}</strong></div>
        <div className="mrow"><strong>{posH}%</strong><span>Possesso</span><strong>{100 - posH}%</strong></div>
        <div className="possbar"><div style={{ width: `${posH}%`, background: home.colors[0] }} /><div style={{ width: `${100 - posH}%`, background: away.colors[0] }} /></div>
      </div>
    </div>
  );
}
