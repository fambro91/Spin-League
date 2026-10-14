import { useState } from "react";
import { api } from "../api";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import { Confetti } from "../components/Confetti";
import { Bar } from "../components/ClubBits";
import { ding, unlockAudio } from "../feedback";

type SoloOpts = { adminToken: string; teams: number };

/** Striscia in alto: divisione, obiettivo, fiducia della società. */
export function CareerStrip({ car }: { car: any }) {
  if (!car) return null;
  const f = car.fiducia;
  return (
    <div className="panel career-strip">
      <div className="row spread">
        <span className={`div-chip ${car.division === "A" ? "a" : "b"}`}>{car.divisionLabel}</span>
        <span className="small muted">{car.objective ? <>Obiettivo: <strong style={{ color: "var(--chalk)" }}>{car.objective.label}</strong>{car.objective.bilancio ? " · bilancio in attivo" : ""}</> : "Obiettivo da decidere"}</span>
      </div>
      <div className="row spread small" style={{ marginTop: 8 }}><span>Fiducia della società</span><span>{f}%</span></div>
      <Bar value={f} color={f < 30 ? "#e0343f" : f < 55 ? "#ffb31a" : "#7ee08a"} />
      {car.fails >= 1 && <p className="warn small" style={{ marginTop: 6 }}>Obiettivo mancato la scorsa stagione: un altro e sei esonerato.</p>}
    </div>
  );
}

/** Pre-stagione: riepilogo della stagione passata, ruote della società, fischio d'inizio. */
export function CareerPreseason({ d, solo, reload }: { d: any; solo: SoloOpts; reload: () => Promise<void> }) {
  const car = d.career;
  const [target, setTarget] = useState<SpinTarget | null>(null);
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const s = car.summary;
  const wheel = res?.wheel ?? car.wheelDef;

  const spin = async () => {
    unlockAudio(); setBusy(true); setErr(null); setRevealed(false);
    try { const r = await api(`admin/${solo.adminToken}/career-wheel`, { method: "POST" }); setRes(r); setTarget({ index: r.index, key: Date.now() }); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const next = async () => { setRes(null); setTarget(null); setRevealed(false); setBusy(false); await reload(); };
  const kickoff = async () => {
    setBusy(true); setErr(null);
    try { await api(`admin/${solo.adminToken}/career-kickoff`, { method: "POST" }); await reload(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      {s && <SeasonSummaryCard s={s} />}
      <CareerStrip car={car} />
      {car.wheels.length > 0 && wheel ? (
        <div className="panel cta-card">
          <div className="tag">{s ? "Estate in società" : "Prima del via"} · {car.wheels.length} {car.wheels.length === 1 ? "ruota" : "ruote"}</div>
          <h2 style={{ marginBottom: 2 }}>{wheel.title}</h2>
          <p className="small muted" style={{ marginTop: 0 }}>{wheel.question ?? wheel.subtitle}</p>
          <div className="wheel-box small"><WheelCanvas wheel={wheel} target={target} hub={wheel.emoji} onDone={() => { setRevealed(true); ding(true); }} /></div>
          {revealed && res && <div className="result-line"><strong>{res.label}</strong><span className="small muted"> · {res.note}</span></div>}
          {err && <div className="error">{err}</div>}
          {!res && <button className="btn block pulse" disabled={busy} onClick={spin}>Gira la ruota</button>}
          {res && revealed && <button className="btn block" onClick={next}>{res.next ? "Prossima ruota" : "Fatto"}</button>}
        </div>
      ) : (
        <div className="panel cta-card">
          <h2>Pronti per la stagione {d.league.season}</h2>
          <p>{d.mine?.club?.name} gioca in <strong>{car.divisionLabel}</strong> contro {car.teams - 1} squadre. {d.league.season > 1 ? "Il mercato estivo resta aperto fino alla prima giornata." : ""}</p>
          {car.spins?.length > 0 && <ul className="small muted">{car.spins.map((x: any, i: number) => <li key={i}>{x.label}{x.note ? ` — ${x.note}` : ""}</li>)}</ul>}
          {err && <div className="error">{err}</div>}
          <button className="btn block pulse" disabled={busy} onClick={kickoff}>{busy ? "Genero il calendario…" : "Fischio d'inizio"}</button>
        </div>
      )}
      <Palmares car={car} />
    </>
  );
}

export function SeasonSummaryCard({ s }: { s: any }) {
  const party = s.you === "promosso" || s.you === "campione" || (s.pos === 1);
  const title = s.esonero ? "Esonerato" : s.you === "campione" ? "Campione d'Italia!" : s.you === "promosso" ? "Promozione in Serie A!" : s.you === "retrocesso" ? "Retrocessione in Serie B" : s.ok ? "Obiettivo centrato" : "Obiettivo mancato";
  return (
    <div className={`panel season-sum ${s.esonero || s.you === "retrocesso" ? "bad" : party || s.ok ? "good" : ""}`}>
      {party && !s.esonero && <Confetti />}
      <div className="tag">Stagione {s.season} · {s.division === "A" ? "Serie A" : "Serie B"}</div>
      <div className="big">{title}</div>
      <p>{s.club} chiude {s.pos}° su {s.n}. Obiettivo «{s.objective?.label ?? "—"}»: {s.ok ? "centrato" : "mancato"}. Fiducia {s.fiducia}% ({s.fiduciaDelta >= 0 ? "+" : ""}{s.fiduciaDelta}).</p>
      {s.esonero && <p><strong>La società ti ha sollevato dall'incarico.</strong> Riparti dalla Serie B con un club nuovo: gira le ruote. Il palmarès resta tuo.</p>}
      <div className="small muted">Salgono in A: {s.promoted.join(", ")} · Scendono in B: {s.relegated.join(", ")}</div>
      {s.notes?.length > 0 && <div className="small muted" style={{ marginTop: 4 }}>{s.notes.join(" · ")}</div>}
    </div>
  );
}

export function Palmares({ car }: { car: any }) {
  if (!car?.palmares?.length) return null;
  const titles = car.palmares.filter((p: any) => p.pos === 1).length;
  const promos = car.palmares.filter((p: any) => /Promosso/.test(p.outcome)).length;
  return (
    <div className="panel">
      <h2>Palmarès</h2>
      <div className="kpis" style={{ marginBottom: 10 }}>
        <div className="kpi"><div className="lab">Stagioni</div><div className="num">{car.palmares.length}</div></div>
        <div className="kpi"><div className="lab">Titoli</div><div className="num amber">{titles}</div></div>
        <div className="kpi"><div className="lab">Promozioni</div><div className="num">{promos}</div></div>
      </div>
      {[...car.palmares].reverse().map((p: any) => (
        <div key={p.season} className="roster-row">
          <span className="muted">S{p.season}</span>
          <span>{p.club} · <span className="muted">{p.division === "A" ? "Serie A" : "Serie B"}, {p.pos}°</span><span className="small muted" style={{ display: "block" }}>{p.objective}: {p.ok ? "✓" : "✗"}</span></span>
          <strong className={p.pos === 1 ? "amber" : ""}>{p.outcome}</strong>
        </div>
      ))}
    </div>
  );
}

/** Classifica dell'altra divisione (in Classifica). */
export function OtherTable({ car }: { car: any }) {
  if (!car) return null;
  const n = car.otherTable.length, promo = car.promo;
  const isA = car.division === "B"; // l'altra è la A
  return (
    <div className="panel">
      <h2>{car.otherLabel}</h2>
      <table className="table">
        <thead><tr><th>#</th><th>Squadra</th><th>G</th><th>DR</th><th>Pt</th></tr></thead>
        <tbody>
          {car.otherTable.map((r: any, i: number) => (
            <tr key={r.id} className={isA ? (i >= n - promo ? "zone-down" : "") : (i < promo ? "zone-up" : "")}>
              <td>{i + 1}</td><td><span className="swatch" style={{ background: r.colors[0] }} />{r.name}</td><td>{r.g}</td><td>{r.gf - r.gs > 0 ? "+" : ""}{r.gf - r.gs}</td><td className="pts">{r.pt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 6 }}>{isA ? `Le ultime ${promo} scendono in Serie B.` : `Le prime ${promo} salgono in Serie A.`}</p>
    </div>
  );
}
