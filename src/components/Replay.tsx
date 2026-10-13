import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchEvent, MatchStats, RosterPlayer } from "../../shared/types";
import { matchStats } from "../../shared/engine";
import { makeRng } from "../../shared/rng";
import { IcBack, IcNext, IcPause, IcPlay } from "./Icons";
import { atkPos, ballAt, buildAction, defPos, ease, type Action, type P } from "./replayAction";

type Team = { name: string; colors: [string, string]; roster?: RosterPlayer[] };

const OUTCOME = 2.6;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const abbr = (s: string) => {
  const w = s.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").filter(Boolean);
  const a = (w.length > 1 ? w.slice(-1)[0] : w[0] ?? "XXX").slice(0, 3);
  return a.toUpperCase().padEnd(3, "X");
};
const surname = (n?: string) => (n ? n.split(" ").slice(-1)[0] : "");

type Props = {
  highlights: MatchEvent[]; events?: MatchEvent[]; home: Team; away: Team; seed: string;
  modules?: [string, string]; stats?: MatchStats;
};

const rgb = (h: string) => { const n = parseInt(h.replace("#", ""), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const cdist = (a: string, b: string) => { try { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); } catch { return 999; } };
const lum = (h: string) => { try { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; } catch { return 0.5; } };
const shade = (h: string, k: number) => { try { const c = rgb(h).map((v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))))); return `rgb(${c[0]},${c[1]},${c[2]})`; } catch { return h; } };

const GRASS = "#1f7f4b";
/** Maglia leggibile sul prato: se il colore principale si confonde con l'erba usa il secondo (o il bianco). */
function onPitch(t: Team): Team {
  if (cdist(t.colors[0], GRASS) >= 100) return t;
  if (cdist(t.colors[1], GRASS) >= 100) return { ...t, colors: [t.colors[1], t.colors[0]] };
  return { ...t, colors: ["#f3f6ee", t.colors[0]] };
}
/** Se le maglie si somigliano, gli ospiti usano la seconda maglia (o un colore neutro). */
function kit(home: Team, away: Team): [Team, Team] {
  const h = onPitch(home);
  const opts: [string, string][] = [away.colors, [away.colors[1], away.colors[0]], ["#f3f6ee", "#111827"], ["#111827", "#f3f6ee"], ["#ffb31a", "#111827"]];
  for (const c of opts) if (cdist(h.colors[0], c[0]) > 110 && cdist(c[0], GRASS) >= 100) return [h, { ...away, colors: c }];
  return [h, { ...away, colors: ["#ffb31a", "#111827"] }];
}

const LABEL: Record<string, string> = { gol: "GOL!", parata: "PARATA!", palo: "PALO!", fuori: "FUORI!", rosso: "ESPULSO!" };

export function Replay({ highlights, events, home: homeIn, away: awayIn, seed, modules = ["4-4-2", "4-4-2"], stats }: Props) {
  const [home, away] = useMemo(() => kit(homeIn, awayIn), [homeIn, awayIn]);
  const ref = useRef<HTMLCanvasElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const t0 = useRef(0);
  const frozen = useRef<number | null>(null);
  const raf = useRef(0);
  const cam = useRef<{ x: number; y: number; z: number } | null>(null);
  const st = useMemo(() => stats ?? matchStats(events ?? highlights, 60, 60, "equilibrato", "equilibrato"), [stats, events, highlights]);

  const action: Action | null = useMemo(() => {
    const e = highlights[idx];
    if (!e || e.type === "rosso" || e.type === "giallo") return null;
    return buildAction(e, modules, [homeIn.roster, awayIn.roster], makeRng(`${seed}:${idx}:v2`));
  }, [idx, highlights, modules[0], modules[1], homeIn.roster, awayIn.roster, seed]);

  useEffect(() => { t0.current = performance.now(); cam.current = null; }, [idx]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !highlights.length) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const e = highlights[idx];
    const atkHome = e.team === "home";
    const atk = atkHome ? home : away, def = atkHome ? away : home;
    const a = action;
    const tEnd = a ? a.tEnd : 0.6;
    const rng = makeRng(`${seed}:${idx}:fx`);
    const confetti = Array.from({ length: 90 }, () => ({ x: rng.next(), v: 0.4 + rng.next() * 0.9, d: rng.next() * 6, c: rng.chance(0.5), w: 3 + rng.next() * 4 }));
    const gkCol = (team: Team) => (cdist(team.colors[0], "#f2d33b") > 120 ? "#f2d33b" : "#3bd1c1");
    const preScore: [number, number] = e.score ? [...e.score] as [number, number] : [0, 0];
    if (e.type === "gol") preScore[atkHome ? 0 : 1]--;

    const frame = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = Math.round(W * 0.66);
      if (!W) { raf.current = requestAnimationFrame(frame); return; }
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px"; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let el = frozen.current ?? Math.max(0, (now - t0.current) / 1000);
      if (reduce && frozen.current == null) el = Math.max(el, tEnd + 0.8);
      const t = Math.min(el, tEnd);
      const tOut = el - (a ? a.tHit : 0);

      // --- proiezione con prospettiva leggera e telecamera che segue l'azione ---
      const top = H * 0.2, ph = H * 0.74, pw = W * 0.86;
      const flat = (x: number, y: number): P => { const sx = atkHome ? x : 1 - x; const sc = 0.84 + 0.16 * y; return [W / 2 + (sx - 0.5) * pw * sc, top + y * ph]; };
      const bl = a ? ballAt(a, t) : { p: [0.55, 0.5] as P, z: 0, seg: null };
      const target = flat(bl.p[0], bl.p[1]);
      const zt = reduce || !a ? 1 : el > tEnd + 0.4 ? 1.22 : 1.38;
      if (!cam.current) cam.current = { x: target[0], y: target[1], z: zt };
      const c = cam.current;
      c.x = lerp(c.x, target[0], 0.08); c.y = lerp(c.y, target[1], 0.06); c.z = lerp(c.z, zt, 0.04);
      const hw = W / (2 * c.z), hh = H / (2 * c.z);
      const cx = Math.max(hw, Math.min(W - hw, c.x)), cy = Math.max(hh, Math.min(H - hh, c.y));
      const S = (x: number, y: number): P => { const f = flat(x, y); return [(f[0] - cx) * c.z + W / 2, (f[1] - cy) * c.z + H / 2]; };
      const scaleAt = (y: number) => c.z * (0.84 + 0.16 * y);
      const poly = (pts: P[], close = false) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const s = S(x, y); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }); if (close) ctx.closePath(); };
      const ell = (x: number, y: number, rx: number, ry: number, a0 = 0, a1 = Math.PI * 2) => { const pts: P[] = []; for (let i = 0; i <= 40; i++) { const an = a0 + ((a1 - a0) * i) / 40; pts.push([x + Math.cos(an) * rx, y + Math.sin(an) * ry]); } return pts; };

      // --- stadio e campo ---
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#06140e"); sky.addColorStop(1, "#0b2a1c");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      // tribuna con pubblico
      poly([[-0.08, -0.2], [1.08, -0.2], [1.08, -0.075], [-0.08, -0.075]], true); ctx.fillStyle = "#0d1f19"; ctx.fill();
      for (let i = 0; i < 70; i++) {
        const x = -0.06 + (i / 70) * 1.12, y = -0.19 + ((i * 37) % 9) * 0.012;
        const s = S(x, y); const bob = e.type === "gol" && tOut > 0 && !reduce ? Math.abs(Math.sin(now / 120 + i)) * 2 * c.z : 0;
        ctx.fillStyle = i % 3 === 0 ? atk.colors[0] : i % 3 === 1 ? def.colors[0] : "#33463e";
        ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(s[0], s[1] - bob, 1.8 * c.z, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      // cartelloni
      poly([[-0.06, -0.075], [1.06, -0.075], [1.06, -0.045], [-0.06, -0.045]], true);
      const adg = ctx.createLinearGradient(0, S(0, -0.075)[1], 0, S(0, -0.045)[1]); adg.addColorStop(0, "#14261f"); adg.addColorStop(1, "#0a1712");
      ctx.fillStyle = adg; ctx.fill();
      ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(7 * c.z)}px 'Big Shoulders Display', sans-serif`;
      for (let i = 0; i < 6; i++) {
        const s = S(0.0 + i * 0.2, -0.06);
        ctx.fillStyle = i % 2 ? "#ffb31a" : "rgba(243,246,238,0.75)";
        ctx.fillText(i % 2 ? "SPIN LEAGUE" : "GIRA LA RUOTA", s[0], s[1]);
      }
      ctx.restore();
      // erba a strisce
      const N = 14;
      for (let i = 0; i < N; i++) {
        const x0 = -0.045 + (i / N) * 1.09, x1 = -0.045 + ((i + 1) / N) * 1.09;
        poly([[x0, -0.045], [x1, -0.045], [x1, 1.06], [x0, 1.06]], true);
        ctx.fillStyle = i % 2 ? "#23864f" : "#1e7a47"; ctx.fill();
      }
      // linee
      ctx.strokeStyle = "rgba(255,255,255,0.82)"; ctx.lineWidth = 1.4 * c.z; ctx.lineJoin = "round";
      poly([[0, 0], [1, 0], [1, 1], [0, 1]], true); ctx.stroke();
      poly([[0.5, 0], [0.5, 1]]); ctx.stroke();
      poly(ell(0.5, 0.5, 0.087, 0.135)); ctx.stroke();
      for (const sd of [0, 1]) {
        const X = (v: number) => (sd ? 1 - v : v);
        poly([[X(0), 0.2035], [X(0.157), 0.2035], [X(0.157), 0.7965], [X(0), 0.7965]]); ctx.stroke();
        poly([[X(0), 0.365], [X(0.052), 0.365], [X(0.052), 0.635], [X(0), 0.635]]); ctx.stroke();
        poly(sd ? ell(0.895, 0.5, 0.087, 0.135, Math.PI * 0.72, Math.PI * 1.28) : ell(0.105, 0.5, 0.087, 0.135, -Math.PI * 0.28, Math.PI * 0.28)); ctx.stroke();
        const sp = S(X(0.105), 0.5); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sp[0], sp[1], 1.6 * c.z, 0, Math.PI * 2); ctx.fill();
      }
      const cs = S(0.5, 0.5); ctx.beginPath(); ctx.arc(cs[0], cs[1], 1.6 * c.z, 0, Math.PI * 2); ctx.fill();

      // porte (con rete che si gonfia sul gol)
      const ripple = e.type === "gol" && a && tOut > 0 && !reduce ? Math.sin(tOut * 22) * Math.exp(-tOut * 3) * 0.012 : 0;
      const drawGoal = (sd: number) => {
        const X = (v: number) => (sd ? 1 + v : -v);
        const hitHere = (sd === 1) === true; // in coordinate "attacco a destra", la porta attaccata è sempre x=1
        const r = hitHere ? ripple : 0;
        const y0 = 0.448, y1 = 0.552, dp = 0.026 + r;
        poly([[X(0), y0], [X(dp), y0 + 0.01], [X(dp), y1 - 0.01], [X(0), y1]], true);
        ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 0.8 * c.z;
        for (let k = 1; k < 6; k++) { const yy = y0 + ((y1 - y0) * k) / 6; poly([[X(0), yy], [X(dp), lerp(y0 + 0.01, y1 - 0.01, k / 6)]]); ctx.stroke(); }
        for (let k = 1; k < 3; k++) { const xx = (dp * k) / 3; poly([[X(xx), y0 + 0.01 * (k / 3)], [X(xx), y1 - 0.01 * (k / 3)]]); ctx.stroke(); }
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.6 * c.z;
        poly([[X(0), y0], [X(0), y1]]); ctx.stroke();
      };
      drawGoal(0); drawGoal(1);

      // --- giocatori ---
      type Dot = { p: P; prev: P; fill: string; stroke: string; gk?: boolean; name?: string; hl?: boolean; jump?: number; dive?: number; diveY?: number };
      const dots: Dot[] = [];
      if (a) {
        const fAt = (tt: number) => atkPos(a, a.finisher, tt).p;
        a.atk.forEach((s, i) => {
          const cur = atkPos(a, i, t), pr = atkPos(a, i, Math.max(0, t - 0.09));
          dots.push({ p: cur.p, prev: pr.p, fill: i === 0 ? gkCol(atk) : atk.colors[0], stroke: i === 0 ? "#111" : atk.colors[1], gk: i === 0, name: s.name, jump: cur.jump });
        });
        a.def.forEach((s, j) => {
          const cur = defPos(a, j, t, fAt), pr = defPos(a, j, Math.max(0, t - 0.09), fAt);
          dots.push({ p: cur.p, prev: pr.p, fill: j === 0 ? gkCol(def) : def.colors[0], stroke: j === 0 ? "#111" : def.colors[1], gk: j === 0, dive: cur.dive, diveY: cur.diveY });
        });
      } else {
        // espulsione: squadre schierate, il giocatore esce
        const lineup = (mod: string, right: boolean, team: Team) => {
          const L = mod.split("-").map(Number).filter((n) => n > 0);
          const out: P[] = [[right ? 0.95 : 0.05, 0.5]];
          L.forEach((n, li) => { for (let i = 0; i < n; i++) { const x = 0.14 + (li / Math.max(1, L.length - 1)) * 0.3; out.push([right ? 1 - x : x, 0.12 + ((i + 0.5) / n) * 0.76]); } });
          return out.map((p, i) => ({ p, prev: p, fill: i === 0 ? gkCol(team) : team.colors[0], stroke: i === 0 ? "#111" : team.colors[1], gk: i === 0 } as Dot));
        };
        const mine = lineup(atkHome ? modules[0] : modules[1], false, atk);
        const k = clamp01((el - 0.6) / 1.4);
        const out = mine[mine.length - 2];
        out.p = [lerp(out.p[0], 0.3, k), lerp(out.p[1], 1.05, k)]; out.prev = out.p; out.name = e.player; out.hl = true;
        dots.push(...mine, ...lineup(atkHome ? modules[1] : modules[0], true, def));
      }
      // il portatore di palla ha il nome in evidenza
      const owner = a && bl.seg && bl.seg.owner != null ? bl.seg.owner : a && t >= a.tShot ? a.finisher : -1;
      if (owner >= 0 && dots[owner]) dots[owner].hl = true;
      dots.sort((u, v) => u.p[1] - v.p[1]);
      const R = Math.max(4.2, W / 74);
      for (const d of dots) {
        const sc = scaleAt(d.p[1]);
        const r = R * sc * (d.jump ? 1 + d.jump * 0.18 : 1);
        const s = S(d.p[0], d.p[1]);
        const lift = (d.jump ?? 0) * r * 1.2;
        // scia di corsa
        const sp = S(d.prev[0], d.prev[1]);
        const sp2 = Math.hypot(s[0] - sp[0], s[1] - sp[1]);
        if (sp2 > r * 0.5 && !reduce) {
          const g = ctx.createLinearGradient(sp[0], sp[1], s[0], s[1]);
          g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, d.fill);
          ctx.globalAlpha = 0.35; ctx.strokeStyle = g; ctx.lineWidth = r * 1.3; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(sp[0] - (s[0] - sp[0]) * 1.5, sp[1] - (s[1] - sp[1]) * 1.5); ctx.lineTo(s[0], s[1]); ctx.stroke(); ctx.globalAlpha = 1;
        }
        // ombra
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(s[0] + r * 0.25, s[1] + r * 0.75, r * 1.05, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
        if (d.hl) {
          const pulse = 1 + Math.sin(now / 160) * 0.08;
          ctx.strokeStyle = "#ffb31a"; ctx.lineWidth = 2.2 * c.z;
          ctx.beginPath(); ctx.ellipse(s[0], s[1] + r * 0.7, r * 1.6 * pulse, r * 0.62 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.save();
        ctx.translate(s[0], s[1] - lift);
        if (d.dive) ctx.rotate((d.diveY ?? 1) * d.dive * (Math.PI / 2.4));
        const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
        body.addColorStop(0, shade(d.fill, 0.25)); body.addColorStop(1, shade(d.fill, -0.15));
        ctx.fillStyle = body;
        ctx.beginPath();
        if (d.dive) ctx.ellipse(0, 0, r, r * (1 + d.dive * 0.9), 0, 0, Math.PI * 2);
        else ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, 2 * c.z * 0.8); ctx.strokeStyle = d.stroke; ctx.stroke();
        ctx.restore();
        if (d.hl && d.name) {
          const txt = surname(d.name).toUpperCase();
          ctx.font = `800 ${Math.round(10.5 * Math.min(1.25, c.z))}px Barlow, sans-serif`;
          const tw = ctx.measureText(txt).width + 12, th = 17 * Math.min(1.2, c.z);
          const lx = s[0] - tw / 2, ly = s[1] - lift - r - th - 6;
          ctx.fillStyle = "rgba(4,18,12,0.88)"; ctx.beginPath(); ctx.roundRect(lx, ly, tw, th, 5); ctx.fill();
          ctx.fillStyle = d.fill; ctx.fillRect(lx, ly + th - 2.5, tw, 2.5);
          ctx.fillStyle = "#f3f6ee"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, s[0], ly + th / 2 - 1);
        }
      }

      // --- passaggi già giocati (telestrator) e palla ---
      if (a) {
        ctx.setLineDash([5 * c.z, 5 * c.z]); ctx.lineWidth = 1.6 * c.z;
        for (const ps of a.passes) {
          if (t < ps.t0) continue;
          const k = clamp01((t - ps.t0) / (ps.t1 - ps.t0));
          const fade = el > tEnd ? clamp01(1 - (el - tEnd) / 0.8) : 1;
          const s0 = S(ps.a[0], ps.a[1]), s1 = S(lerp(ps.a[0], ps.b[0], k), lerp(ps.a[1], ps.b[1], k));
          ctx.strokeStyle = `rgba(255,214,120,${0.55 * fade})`;
          ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(s1[0], s1[1]); ctx.stroke();
        }
        ctx.setLineDash([]);
        // scia della palla
        if (!reduce) {
          for (let i = 6; i >= 1; i--) {
            const b = ballAt(a, Math.max(0, t - i * 0.025));
            const s = S(b.p[0], b.p[1]);
            ctx.fillStyle = `rgba(255,255,255,${0.06 * (7 - i)})`;
            ctx.beginPath(); ctx.arc(s[0], s[1] - b.z * ph * c.z * 1.4, 3 * c.z * (1 - i * 0.08), 0, Math.PI * 2); ctx.fill();
          }
        }
        const s = S(bl.p[0], bl.p[1]);
        const lift = bl.z * ph * c.z * 1.4;
        const br = (3.2 + bl.z * 22) * c.z * (0.84 + 0.16 * bl.p[1]);
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(s[0] + lift * 0.15, s[1] + 1.5, br * 0.95, br * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        const bg = ctx.createRadialGradient(s[0] - br * 0.35, s[1] - lift - br * 0.35, br * 0.1, s[0], s[1] - lift, br);
        bg.addColorStop(0, "#ffffff"); bg.addColorStop(1, "#cfd6d0");
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(s[0], s[1] - lift, br, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1b1b1b"; ctx.lineWidth = 0.9; ctx.stroke();
        ctx.fillStyle = "#1b1b1b"; ctx.beginPath(); ctx.arc(s[0] + br * 0.15, s[1] - lift - br * 0.1, br * 0.32, 0, Math.PI * 2); ctx.fill();
      }

      // vignettatura
      const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // flash del gol
      if (e.type === "gol" && a && tOut > 0 && tOut < 0.35 && !reduce) { ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - tOut / 0.35)})`; ctx.fillRect(0, 0, W, H); }

      // --- grafica TV: tabellone ---
      const scoreNow: [number, number] = e.type === "gol" && a && tOut >= 0 ? (e.score ?? preScore) : preScore;
      const bugH = 24, fs = 13;
      ctx.font = `800 ${fs}px 'Big Shoulders Display', sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      const bx = 10, by = 10, cw = 40, sw = 44, mw = 38;
      ctx.fillStyle = "rgba(4,18,12,0.9)"; ctx.beginPath(); ctx.roundRect(bx, by, cw * 2 + sw + mw + 10, bugH, 6); ctx.fill();
      ctx.fillStyle = home.colors[0]; ctx.fillRect(bx, by, 4, bugH);
      ctx.fillStyle = away.colors[0]; ctx.fillRect(bx + cw * 2 + sw + 6, by, 4, bugH);
      ctx.fillStyle = "#f3f6ee"; ctx.fillText(abbr(homeIn.name), bx + 4 + cw / 2, by + bugH / 2 + 1);
      ctx.fillText(abbr(awayIn.name), bx + 6 + cw * 1.5 + sw, by + bugH / 2 + 1);
      const pulse = e.type === "gol" && a && tOut > 0 && tOut < 1.2 && !reduce;
      ctx.fillStyle = pulse ? "#ffb31a" : "#f3f6ee"; ctx.fillRect(bx + 4 + cw, by + 3, sw, bugH - 6);
      ctx.fillStyle = "#0b1d15"; ctx.font = `900 ${fs + 2}px 'Big Shoulders Display', sans-serif`;
      ctx.fillText(`${scoreNow[0]}-${scoreNow[1]}`, bx + 4 + cw + sw / 2, by + bugH / 2 + 1);
      ctx.fillStyle = "#ffb31a"; ctx.font = `800 ${fs}px 'Big Shoulders Display', sans-serif`;
      ctx.fillText(`${e.minute}'`, bx + cw * 2 + sw + 10 + mw / 2, by + bugH / 2 + 1);

      // didascalia dell'azione
      if (a && el < a.tHit) {
        const cap = a.caption.toUpperCase();
        ctx.font = "800 11px Barlow, sans-serif";
        const tw = ctx.measureText(cap).width + 18;
        const k = ease(clamp01(el / 0.35));
        ctx.globalAlpha = k;
        ctx.fillStyle = atk.colors[0]; ctx.beginPath(); ctx.roundRect(10 - (1 - k) * 30, H - 32, 5, 22, 2); ctx.fill();
        ctx.fillStyle = "rgba(4,18,12,0.85)"; ctx.beginPath(); ctx.roundRect(17 - (1 - k) * 30, H - 32, tw, 22, 4); ctx.fill();
        ctx.fillStyle = "#f3f6ee"; ctx.textAlign = "left"; ctx.fillText(cap, 26 - (1 - k) * 30, H - 20.5);
        ctx.globalAlpha = 1;
      }

      // --- esito: banda in stile TV ---
      const showOut = a ? tOut >= (e.type === "gol" ? 0.05 : 0.15) : el > 0.5;
      if (showOut) {
        const k = ease(clamp01((a ? tOut : el - 0.5) / 0.35));
        const label = LABEL[e.type] ?? e.type.toUpperCase();
        const main = e.type === "gol" ? "#ffb31a" : e.type === "rosso" ? "#e0343f" : "#f3f6ee";
        const line1 = e.player ?? "";
        const line2 = e.type === "gol" ? (e.schema === "rigore" ? "su calcio di rigore" : e.assist ? `assist di ${e.assist}` : a?.special === "punizione" ? "su punizione" : "azione personale")
          : e.type === "parata" ? (a?.gkName ? `parata di ${a.gkName}` : "il portiere ci arriva")
          : e.type === "palo" ? "colpisce il palo"
          : e.type === "fuori" ? (a && a.segs[a.segs.length - 1].zEnd ? "alto sopra la traversa" : "tiro a lato")
          : `${atk.name} resta in dieci`;
        ctx.font = "900 24px 'Big Shoulders Display', sans-serif";
        const slab = Math.max(92, ctx.measureText(label).width + 34);
        const bw = Math.min(W - 24, 300), bh = 58, x0 = W / 2 - bw / 2 + (1 - k) * -W * 0.6, y0 = H - bh - 14;
        ctx.save();
        ctx.globalAlpha = k;
        ctx.fillStyle = "rgba(4,18,12,0.92)";
        ctx.beginPath(); ctx.moveTo(x0 + 14, y0); ctx.lineTo(x0 + bw, y0); ctx.lineTo(x0 + bw - 14, y0 + bh); ctx.lineTo(x0, y0 + bh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = atk.colors[0]; ctx.beginPath(); ctx.moveTo(x0 + 14, y0); ctx.lineTo(x0 + slab, y0); ctx.lineTo(x0 + slab - 14, y0 + bh); ctx.lineTo(x0, y0 + bh); ctx.closePath(); ctx.fill();
        ctx.fillStyle = lum(atk.colors[0]) > 0.6 ? "#0b1d15" : "#fff";
        ctx.font = "900 24px 'Big Shoulders Display', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const pop = e.type === "gol" && !reduce ? 1 + Math.max(0, 0.25 - tOut) * 1.2 : 1;
        ctx.save(); ctx.translate(x0 + slab / 2, y0 + bh / 2); ctx.scale(pop, pop); ctx.fillText(label, 0, 1); ctx.restore();
        ctx.textAlign = "left";
        ctx.fillStyle = main; ctx.font = "800 15px Barlow, sans-serif";
        const maxw = bw - slab - 14;
        const fit = (s: string) => { let x = s; while (ctx.measureText(x).width > maxw && x.length > 4) x = x.slice(0, -2); return x === s ? s : x + "…"; };
        ctx.fillText(fit(line1), x0 + slab + 2, y0 + 21);
        ctx.fillStyle = "rgba(243,246,238,0.75)"; ctx.font = "600 12px Barlow, sans-serif";
        ctx.fillText(fit(line2), x0 + slab + 2, y0 + 40);
        ctx.restore();
        if (e.type === "rosso") {
          const kk = ease(clamp01((el - 0.3) / 0.4));
          ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.rotate((1 - kk) * 0.6 - 0.12); ctx.scale(kk, kk);
          ctx.fillStyle = "#e0343f"; ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.roundRect(-18, -26, 36, 52, 5); ctx.fill(); ctx.restore();
        }
        if (e.type === "gol" && !reduce && a) {
          const kc = clamp01(tOut / OUTCOME);
          confetti.forEach((cf) => {
            ctx.fillStyle = cf.c ? atk.colors[0] : (cdist(atk.colors[1], "#ffffff") < 30 ? "#ffb31a" : atk.colors[1]);
            ctx.save(); ctx.translate(cf.x * W + Math.sin(now / 220 + cf.d) * 8, -10 + kc * H * 1.4 * cf.v); ctx.rotate(now / 300 + cf.d);
            ctx.fillRect(-cf.w / 2, -cf.w, cf.w, cf.w * 1.8); ctx.restore();
          });
        }
      }

      if (frozen.current == null && el > tEnd + OUTCOME) {
        if (idx < highlights.length - 1) { setIdx((v) => v + 1); return; }
        frozen.current = tEnd + OUTCOME; setPlaying(false);
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [idx, highlights, home, away, awayIn, seed, action, modules[0], modules[1]]);

  if (!highlights.length) return <p className="muted">Partita senza azioni da rivedere.</p>;
  const key = (x: MatchEvent) => `${x.minute}|${x.team}|${x.type}|${x.player ?? ""}`;
  const hiIndex = new Map(highlights.map((x, i) => [key(x), i]));
  const tl = [...highlights, ...(events ?? []).filter((x) => (x.type === "gol" || x.type === "rosso") && !hiIndex.has(key(x)))];
  const restart = (i: number) => { frozen.current = null; cam.current = null; setIdx(i); t0.current = performance.now(); setPlaying(true); };
  const pause = () => { frozen.current = Math.max(0, (performance.now() - t0.current) / 1000); setPlaying(false); };
  const resume = () => {
    const f = frozen.current;
    if (f == null) return;
    const ended = action ? f >= action.tEnd + OUTCOME - 0.01 : f >= 0.6 + OUTCOME - 0.01;
    if (ended) { restart(idx === highlights.length - 1 ? 0 : idx + 1); return; }
    t0.current = performance.now() - f * 1000; frozen.current = null; setPlaying(true);
  };
  const posH = st.possession[0];
  const atEnd = !playing && idx === highlights.length - 1;
  return (
    <div className="replay">
      <canvas ref={ref} role="img" aria-label={`Highlight ${idx + 1} di ${highlights.length}: ${highlights[idx].type} al ${highlights[idx].minute}' di ${highlights[idx].player ?? ""}`} />
      <div className="replay-ctrl">
        <button className="icon-btn" aria-label="Azione precedente" disabled={idx === 0} onClick={() => restart(idx - 1)}><IcBack /></button>
        {playing
          ? <button className="icon-btn big" aria-label="Pausa" onClick={pause}><IcPause /></button>
          : <button className="icon-btn big" aria-label={atEnd ? "Rivedi" : "Riprendi"} onClick={resume}><IcPlay /></button>}
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
