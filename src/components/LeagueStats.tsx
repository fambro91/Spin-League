import { useState } from "react";
import { Crest } from "./ClubBits";

type Tab = "squadre" | "gol" | "assist" | "pronostici";
type PS = { name: string; clubId: string; goals: number; assists: number };

const MEDAL = ["#ffb31a", "#d7dee6", "#d08a4e"];
const lum = (h: string) => { const n = parseInt((h ?? "#888").replace("#", ""), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
/** Colore della squadra leggibile su fondo scuro: se la prima maglia è troppo scura usa la seconda. */
export const vis = (c?: { colors?: [string, string] }) => {
  const [a, b] = c?.colors ?? ["#888888", "#888888"];
  return lum(a) > 0.2 ? a : lum(b) > 0.2 ? b : "#9fb1a8";
};
const dec = (x: number) => x.toFixed(1).replace(".", ",");

function Podium({ list, metric, unit, clubsById }: { list: PS[]; metric: "goals" | "assists"; unit: string; clubsById: Map<string, any> }) {
  const top = list.slice(0, 3);
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const rankOf = (p: PS) => top.indexOf(p);
  const max = Math.max(1, ...list.map((p) => p[metric]));
  return (
    <>
      <div className="podium">
        {order.map((p) => {
          const r = rankOf(p), c = clubsById.get(p.clubId);
          return (
            <div key={p.clubId + p.name} className={`pod r${r}`} style={{ ["--medal" as any]: MEDAL[r], ["--kit" as any]: vis(c) }}>
              <div className="pod-crest">{c && <Crest name={c.name} colors={c.colors} shape={c.crest} size={r === 0 ? 46 : 38} />}</div>
              <div className="pod-name">{p.name}</div>
              <div className="pod-club">{c?.name}</div>
              <div className="pod-step"><span className="pod-num">{p[metric]}</span><span className="pod-unit">{unit}</span><span className="pod-rank">{r + 1}</span></div>
            </div>
          );
        })}
      </div>
      <ol className="leader">
        {list.slice(3).map((p, i) => {
          const c = clubsById.get(p.clubId);
          return (
            <li key={p.clubId + p.name}>
              <span className="lp">{i + 4}</span>
              <span className="ln"><span className="swatch" style={{ background: vis(c) }} />{p.name}<span className="small muted"> · {c?.name}</span>
                <span className="lbar"><i style={{ width: `${(p[metric] / max) * 100}%`, background: vis(c) }} /></span></span>
              <strong className="lv">{p[metric]}</strong>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Records({ stats, table, clubsById }: { stats: any; table: any[]; clubsById: Map<string, any> }) {
  const T: any[] = stats.teams ?? [];
  if (!T.length) return <p className="muted small">I record compaiono dopo la prima giornata.</p>;
  const best = <K extends string>(key: K, dir: 1 | -1, tie?: (x: any) => number) => [...T].sort((a, b) => dir * (b[key] - a[key]) || (tie ? tie(b) - tie(a) : 0))[0];
  const att = best("gf", 1), dif = best("gs", -1), cs = best("cleanSheets", 1, (x) => -x.gs), sh = best("shots", 1), po = best("possession", 1);
  const bw = [...T].filter((t) => t.bigWin).sort((a, b) => (b.bigWin.gf - b.bigWin.ga) - (a.bigWin.gf - a.bigWin.ga) || b.bigWin.gf - a.bigWin.gf)[0];
  const card = (title: string, icon: string, t: any, value: string, sub?: string) => {
    if (!t) return null;
    const c = clubsById.get(t.clubId);
    return (
      <div className="rec" style={{ ["--kit" as any]: vis(c) }}>
        <div className="rec-top"><span className="rec-ic" aria-hidden>{icon}</span><span className="rec-t">{title}</span></div>
        <div className="rec-v">{value}</div>
        <div className="rec-c"><span className="swatch" style={{ background: vis(c) }} />{c?.name}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
    );
  };
  const maxGf = Math.max(1, ...T.map((t) => t.gf)), maxGs = Math.max(1, ...T.map((t) => t.gs));
  const ordered = table.map((r) => T.find((t) => t.clubId === r.id)).filter(Boolean);
  return (
    <>
      <div className="recs">
        {card("Miglior attacco", "⚽", att, `${att.gf} gol`, `${dec(att.gf / Math.max(1, att.g))} a partita`)}
        {card("Miglior difesa", "🧱", dif, `${dif.gs} subiti`, `${dec(dif.gs / Math.max(1, dif.g))} a partita`)}
        {card("Porta inviolata", "🧤", cs, `${cs.cleanSheets} partite`, "senza subire gol")}
        {bw && card("Vittoria più larga", "💥", bw, `${bw.bigWin.gf}-${bw.bigWin.ga}`, `contro ${clubsById.get(bw.bigWin.oppId)?.name ?? ""}`)}
        {sh.shots > 0 && card("Più tiri", "🎯", sh, `${dec(sh.shots)} tiri`, `a partita · ${dec(sh.onTarget)} in porta`)}
        {po.possession > 0 && card("Padroni del pallone", "🔄", po, `${po.possession}%`, "possesso medio")}
      </div>
      <h3 style={{ marginTop: 16 }}>Gol fatti e subiti</h3>
      <div className="gfgs">
        {ordered.map((t: any) => {
          const c = clubsById.get(t.clubId);
          return (
            <div key={t.clubId} className="gfgs-row">
              <span className="gfgs-bar l"><i style={{ width: `${(t.gs / maxGs) * 100}%` }} /><b>{t.gs}</b></span>
              <span className="gfgs-n"><span className="swatch" style={{ background: vis(c) }} />{c?.name}</span>
              <span className="gfgs-bar r"><i style={{ width: `${(t.gf / maxGf) * 100}%`, background: vis(c) }} /><b>{t.gf}</b></span>
            </div>
          );
        })}
        <div className="gfgs-row small muted"><span style={{ textAlign: "right" }}>subiti</span><span /><span>fatti</span></div>
      </div>
    </>
  );
}

export function LeagueStats({ d, clubsById }: { d: any; clubsById: Map<string, any> }) {
  const [tab, setTab] = useState<Tab>("gol");
  const s = d.stats;
  if (!s) return null;
  const humans = [...d.clubs].filter((c: any) => !c.isCpu).sort((a: any, b: any) => (b.predPoints ?? 0) - (a.predPoints ?? 0));
  const maxPred = Math.max(1, ...humans.map((c: any) => c.predPoints ?? 0));
  return (
    <div className="panel stats-panel">
      <h2>Statistiche</h2>
      <div className="seg" role="tablist">
        {([["gol", "Marcatori"], ["assist", "Assist"], ["squadre", "Squadre"], ["pronostici", "Pronostici"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === "gol" && (s.scorers.length ? <Podium list={s.scorers} metric="goals" unit="gol" clubsById={clubsById} /> : <p className="muted small">Ancora nessun gol.</p>)}
      {tab === "assist" && (s.assists.length ? <Podium list={s.assists} metric="assists" unit="assist" clubsById={clubsById} />
        : <p className="muted small">{d.league.matchdayPlayed > 0 && !s.withAssists ? "Gli assist si contano dalla prossima giornata." : "Ancora nessun assist."}</p>)}
      {tab === "squadre" && <Records stats={s} table={d.table} clubsById={clubsById} />}
      {tab === "pronostici" && (
        humans.some((c: any) => (c.predPoints ?? 0) > 0) ? (
          <ol className="leader">
            {humans.map((c: any, i: number) => (
              <li key={c.id}>
                <span className="lp" style={i < 3 ? { color: MEDAL[i] } : undefined}>{i + 1}</span>
                <span className="ln">{c.owner}<span className="small muted"> · {c.name}</span>
                  <span className="lbar"><i style={{ width: `${((c.predPoints ?? 0) / maxPred) * 100}%`, background: "var(--amber)" }} /></span></span>
                <strong className="lv">{c.predPoints ?? 0}</strong>
              </li>
            ))}
          </ol>
        ) : <p className="muted small">Nessun punto ancora: fai i pronostici dalla scheda Oggi.</p>
      )}
    </div>
  );
}
