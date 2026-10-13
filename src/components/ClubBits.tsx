import type { Ratings, Reparto } from "../../shared/types";
import { REPARTO_LABEL } from "../../shared/types";

export function initials(name: string) {
  const w = name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

export function Crest({ name, colors, shape, size = 64 }: { name: string; colors: [string, string]; shape: string; size?: number }) {
  const [a, b] = colors;
  const ini = initials(name);
  const path =
    shape === "cerchio" ? <circle cx="50" cy="50" r="44" /> :
    shape === "rombo" ? <polygon points="50,4 96,50 50,96 4,50" /> :
    shape === "stella" ? <polygon points="50,4 61,36 95,36 67,56 78,90 50,70 22,90 33,56 5,36 39,36" /> :
    <path d="M10 8 H90 V48 C90 74 70 88 50 96 C30 88 10 74 10 48 Z" />;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Stemma di ${name}`}>
      <defs>
        <clipPath id={`clip-${ini}-${shape}-${a}`}>{path}</clipPath>
      </defs>
      <g clipPath={`url(#clip-${ini}-${shape}-${a})`}>
        <rect width="100" height="100" fill={a} />
        <rect x="50" width="50" height="100" fill={b} />
      </g>
      <g fill="none" stroke="#f3f6ee" strokeWidth="4">{path}</g>
      <text x="50" y={shape === "stella" ? 62 : 60} textAnchor="middle" fontFamily="Big Shoulders Display, sans-serif" fontWeight="900" fontSize={shape === "stella" ? 24 : 32} fill="#fff" stroke="#000" strokeWidth="1.2" paintOrder="stroke">{ini}</text>
    </svg>
  );
}

const ORDER: Reparto[] = ["att", "cen", "dif", "por", "all", "pan"];

export function Radar({ ratings, compare, size = 260 }: { ratings: Ratings; compare?: Ratings; size?: number }) {
  const c = 150, R = 105;
  const pt = (i: number, v: number) => {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    const k = Math.max(0, (v - 40) / 59);
    return [c + Math.cos(ang) * R * k, c + Math.sin(ang) * R * k];
  };
  const ring = (k: number) => ORDER.map((_, i) => { const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6; return `${c + Math.cos(ang) * R * k},${c + Math.sin(ang) * R * k}`; }).join(" ");
  const poly = (r: Ratings) => ORDER.map((k, i) => pt(i, r[k]).join(",")).join(" ");
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} role="img" aria-label="Radar dei reparti" style={{ maxWidth: "100%" }}>
      {[0.25, 0.5, 0.75, 1].map((k) => <polygon key={k} points={ring(k)} fill="none" stroke="rgba(243,246,238,0.18)" />)}
      {compare && <polygon points={poly(compare)} fill="rgba(143,211,255,0.15)" stroke="#8fd3ff" strokeDasharray="4 3" />}
      <polygon points={poly(ratings)} fill="rgba(255,179,26,0.28)" stroke="#ffb31a" strokeWidth="2.5" />
      {ORDER.map((k, i) => {
        const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        const x = c + Math.cos(ang) * (R + 26), y = c + Math.sin(ang) * (R + 22);
        return (
          <g key={k}>
            <text x={x} y={y - 2} textAnchor="middle" fontSize="12" fill="rgba(243,246,238,0.75)" fontFamily="Barlow">{REPARTO_LABEL[k]}</text>
            <text x={x} y={y + 15} textAnchor="middle" fontSize="17" fontWeight="800" fill="#f3f6ee" fontFamily="Big Shoulders Display">{Math.round(ratings[k])}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Bar({ value, color }: { value: number; color: string }) {
  return <div className="bar" aria-hidden><div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} /></div>;
}

export function Form({ form }: { form: string[] }) {
  return <span aria-label={`Ultime: ${form.join(" ")}`}>{form.map((f, i) => <i key={i} className={`dot ${f}`} />)}</span>;
}

export function ScoreHead({ h, a, hg, ag }: { h: any; a: any; hg: number; ag: number }) {
  return (
    <div className="score-head">
      <div><Crest name={h.name} colors={h.colors} shape={h.crest} size={54} /><div className="nm">{h.name}</div><div className="vt">voto {h.voto}</div></div>
      <div className="sc">{hg} - {ag}</div>
      <div><Crest name={a.name} colors={a.colors} shape={a.crest} size={54} /><div className="nm">{a.name}</div><div className="vt">voto {a.voto}</div></div>
    </div>
  );
}

