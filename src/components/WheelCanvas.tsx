import { useEffect, useRef } from "react";
import type { Wheel } from "../../shared/wheels";
import { tick } from "../feedback";

function colorsFor(w: Wheel): string[] {
  const n = w.segments.length;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    switch (w.palette) {
      case "rainbow": out.push(`hsl(${Math.round(350 - (i / Math.max(1, n - 1)) * 250)}, 78%, ${50 + (i % 2) * 6}%)`); break;
      case "gold": out.push(i % 2 ? "#f5c542" : "#e3a514"); break;
      case "blue": out.push(i % 2 ? "#f3f6ee" : "#1f5fd1"); break;
      case "red": out.push(`hsl(${355 - i * 4}, ${70 - i * 4}%, ${30 + i * 8}%)`); break;
      case "purple": out.push(`hsl(${270 + i * 12}, 55%, ${28 + i * 8}%)`); break;
      case "pitch": out.push(i % 2 ? "#2f8f4e" : "#1f6e3a"); break;
      default: {
        const t = ["#155e75", "#7c2d12", "#3f6212", "#6b21a8", "#9f1239", "#1e3a8a", "#854d0e", "#134e4a"];
        out.push(t[i % t.length]);
      }
    }
  }
  return out;
}

function ink(bg: string) {
  if (bg.startsWith("#f3") || bg === "#f5c542" || bg === "#e3a514") return "#10241b";
  const m = bg.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (m) { const h = +m[1], l = +m[3]; if (l > 55 || (h > 40 && h < 190 && l > 45)) return "#10241b"; }
  return "#ffffff";
}

export type SpinTarget = { index: number; key: number };

const TAU = Math.PI * 2;

export function WheelCanvas({ wheel, target, onDone, gold, idleSpin, hub }: { wheel: Wheel; target: SpinTarget | null; onDone?: () => void; gold?: boolean; idleSpin?: boolean; hub?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rot = useRef(-Math.PI / 2);
  const geom = useRef<{ start: number; end: number }[]>([]);
  const raf = useRef(0);
  const lastKey = useRef<number | null>(null);
  const flick = useRef(0);
  const lastSeg = useRef(-1);

  const segAtPointer = () => {
    const a = ((-Math.PI / 2 - rot.current) % TAU + TAU) % TAU;
    return geom.current.findIndex((g) => a >= g.start && a < g.end);
  };

  const draw = () => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const size = cv.clientWidth;
    if (!size) return;
    if (cv.width !== Math.round(size * dpr)) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const c = size / 2, R = size / 2 - 12;
    const cols = colorsFor(wheel);
    const total = wheel.segments.reduce((s, x) => s + x.weight, 0);
    let a = 0;
    geom.current = wheel.segments.map((s) => { const st = a; a += (s.weight / total) * TAU; return { start: st, end: a }; });
    // bordo con "lampadine"
    ctx.beginPath(); ctx.arc(c, c, R + 9, 0, TAU); ctx.fillStyle = gold ? "#a8770a" : "#24332c"; ctx.fill();
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * TAU;
      ctx.beginPath(); ctx.arc(c + Math.cos(ang) * (R + 4.5), c + Math.sin(ang) * (R + 4.5), 1.8, 0, TAU);
      ctx.fillStyle = gold ? "#fff3c4" : "rgba(243,246,238,0.55)"; ctx.fill();
    }
    wheel.segments.forEach((_, i) => {
      const g = geom.current[i];
      ctx.beginPath(); ctx.moveTo(c, c);
      ctx.arc(c, c, R, g.start + rot.current, g.end + rot.current);
      ctx.closePath();
      ctx.fillStyle = cols[i]; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1; ctx.stroke();
    });
    // etichette o icone
    wheel.segments.forEach((s, i) => {
      const g = geom.current[i];
      const ang = g.end - g.start;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(g.start + ang / 2 + rot.current);
      if (s.icon) {
        const fs = Math.min(size / 9, ang * R * 0.45);
        if (fs >= 10) {
          ctx.translate(R * 0.68, 0);
          ctx.rotate(Math.PI / 2);
          ctx.font = `${fs}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(s.icon, 0, 0);
        }
      } else {
        const arc = ang * R * 0.62;
        const fs = Math.min(15, Math.max(0, arc * 0.62), size / 26);
        if (fs >= 6) {
          ctx.fillStyle = ink(cols[i]);
          ctx.font = `600 ${fs}px Barlow, system-ui, sans-serif`;
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          let label = s.label;
          const maxW = R * 0.68;
          while (ctx.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -2);
          if (label !== s.label) label = label.trimEnd() + "…";
          ctx.fillText(label, R - 10, 0);
        }
      }
      ctx.restore();
    });
    // mozzo con icona
    const hr = R * 0.17;
    ctx.beginPath(); ctx.arc(c, c, hr, 0, TAU); ctx.fillStyle = "#14231c"; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = gold ? "#ffb31a" : "#5b6b63"; ctx.stroke();
    if (hub) {
      ctx.font = `${hr * 1.05}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(hub, c, c + 1);
    }
    // puntatore che scatta
    ctx.save();
    ctx.translate(c, 4);
    ctx.rotate(-flick.current * 0.45);
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(0, 32); ctx.closePath();
    ctx.fillStyle = "#ffb31a"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2a1a00"; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fillStyle = "#2a1a00"; ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    draw();
    lastSeg.current = segAtPointer();
    const onR = () => draw();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheel, gold, hub]);

  useEffect(() => {
    if (!idleSpin) return;
    let t0 = performance.now();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const loop = (t: number) => { rot.current += (t - t0) * 0.00012; t0 = t; draw(); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleSpin, wheel]);

  useEffect(() => {
    if (!target || target.key === lastKey.current) return;
    lastKey.current = target.key;
    draw();
    const g = geom.current[target.index];
    if (!g) { onDone?.(); return; }
    const width = g.end - g.start;
    const center = g.start + width / 2 + (Math.random() - 0.5) * width * 0.6;
    const desired = -Math.PI / 2 - center;
    const from = rot.current;
    let delta = (desired - from) % TAU;
    if (delta < 0) delta += TAU;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const turns = reduce ? 0 : 5 + Math.floor(Math.random() * 3);
    const to = from + delta + turns * TAU;
    const dur = reduce ? 400 : 4200 + Math.random() * 900;
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const ease = (x: number) => 1 - Math.pow(1 - x, 4);
    let prev = from;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      rot.current = from + (to - from) * ease(k);
      const speed = Math.abs(rot.current - prev);
      prev = rot.current;
      const seg = segAtPointer();
      if (seg !== lastSeg.current) {
        lastSeg.current = seg;
        if (!reduce) { flick.current = Math.min(1, 0.55 + speed * 4); tick(speed * 8); }
      }
      flick.current *= 0.82;
      draw();
      if (k < 1 || flick.current > 0.02) raf.current = requestAnimationFrame(step);
      else onDone?.();
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key]);

  return <canvas ref={ref} role="img" aria-label={`Ruota: ${wheel.title}`} />;
}
