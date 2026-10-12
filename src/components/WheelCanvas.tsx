import { useEffect, useRef } from "react";
import type { Wheel } from "../../shared/wheels";

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

export function WheelCanvas({ wheel, target, onDone, gold, idleSpin }: { wheel: Wheel; target: SpinTarget | null; onDone?: () => void; gold?: boolean; idleSpin?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rot = useRef(-Math.PI / 2);
  const geom = useRef<{ start: number; end: number }[]>([]);
  const raf = useRef(0);
  const lastKey = useRef<number | null>(null);

  const draw = () => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const size = cv.clientWidth;
    if (cv.width !== Math.round(size * dpr)) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const c = size / 2, R = size / 2 - 10;
    const cols = colorsFor(wheel);
    const total = wheel.segments.reduce((s, x) => s + x.weight, 0);
    let a = 0;
    geom.current = wheel.segments.map((s) => { const st = a; a += (s.weight / total) * Math.PI * 2; return { start: st, end: a }; });
    // bordo
    ctx.beginPath(); ctx.arc(c, c, R + 7, 0, Math.PI * 2); ctx.fillStyle = gold ? "#b8860b" : "#3a4a42"; ctx.fill();
    wheel.segments.forEach((s, i) => {
      const g = geom.current[i];
      ctx.beginPath(); ctx.moveTo(c, c);
      ctx.arc(c, c, R, g.start + rot.current, g.end + rot.current);
      ctx.closePath();
      ctx.fillStyle = cols[i]; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.stroke();
    });
    // etichette
    wheel.segments.forEach((s, i) => {
      const g = geom.current[i];
      const ang = g.end - g.start;
      const arc = ang * R * 0.62;
      const fs = Math.min(15, Math.max(0, arc * 0.62), size / 26);
      if (fs < 6) return;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(g.start + ang / 2 + rot.current);
      ctx.fillStyle = ink(cols[i]);
      ctx.font = `600 ${fs}px Barlow, system-ui, sans-serif`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      let label = s.label;
      const maxW = R * 0.7;
      while (ctx.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -2);
      if (label !== s.label) label = label.trimEnd() + "…";
      ctx.fillText(label, R - 10, 0);
      ctx.restore();
    });
    // mozzo
    ctx.beginPath(); ctx.arc(c, c, R * 0.13, 0, Math.PI * 2); ctx.fillStyle = "#14231c"; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = gold ? "#ffb31a" : "#5b6b63"; ctx.stroke();
    // puntatore
    ctx.beginPath(); ctx.moveTo(c - 13, 2); ctx.lineTo(c + 13, 2); ctx.lineTo(c, 30); ctx.closePath();
    ctx.fillStyle = "#ffb31a"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#2a1a00"; ctx.stroke();
  };

  useEffect(() => {
    draw();
    const onR = () => draw();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheel, gold]);

  useEffect(() => {
    if (!idleSpin) return;
    let t0 = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
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
    let delta = (desired - from) % (Math.PI * 2);
    if (delta < 0) delta += Math.PI * 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const turns = reduce ? 0 : 5 + Math.floor(Math.random() * 3);
    const to = from + delta + turns * Math.PI * 2;
    const dur = reduce ? 400 : 4200 + Math.random() * 900;
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const ease = (x: number) => 1 - Math.pow(1 - x, 4);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      rot.current = from + (to - from) * ease(k);
      draw();
      if (k < 1) raf.current = requestAnimationFrame(step);
      else onDone?.();
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key]);

  return <canvas ref={ref} role="img" aria-label={`Ruota: ${wheel.title}`} />;
}
