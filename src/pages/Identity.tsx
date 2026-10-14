import { TRAITS, type TraitId } from "../../shared/traits";
import { useMemo, useState } from "react";
import { api } from "../api";
import { computeClub } from "../../shared/club";
import type { Draft, Identity as Id } from "../../shared/types";
import { Crest, Radar } from "../components/ClubBits";

const PRESETS: [string, string][] = [
  ["#1d4ed8", "#ffffff"], ["#b91c1c", "#111827"], ["#15803d", "#ffffff"], ["#7c3aed", "#fde047"],
  ["#111827", "#f8fafc"], ["#ea580c", "#1e293b"], ["#0e7490", "#fef3c7"], ["#be185d", "#f1f5f9"], ["#facc15", "#1e3a8a"],
];
const CRESTS: Id["crest"][] = ["scudo", "cerchio", "rombo", "stella"];

export function Identity({ token, draft, seed, onDone, onRestart }: { token: string; draft: Draft; seed: string; onDone: () => void; onRestart?: React.ReactNode }) {
  const [name, setName] = useState("");
  const [colors, setColors] = useState<[string, string]>(PRESETS[0]);
  const [crest, setCrest] = useState<Id["crest"]>("scudo");
  const [fname, setFname] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => computeClub(draft, { name: name || "Il tuo club", colors, crest, fuoriclasseName: fname }, seed), [draft, name, colors, crest, fname, seed]);
  const hasFuori = !!preview.fuoriclasse;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api(`me/${token}/identity`, { body: { name, colors, crest, fuoriclasseName: fname } }); onDone(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="wrap">
      {onRestart ? <div className="row spread" style={{ marginTop: 12 }}><h1 style={{ margin: 0 }}>Fonda il club</h1>{onRestart}</div> : <h1 style={{ marginTop: 12 }}>Fonda il club</h1>}
      <p className="muted">Le ruote hanno deciso tutto il resto. Ora scegli nome, colori e stemma.</p>
      <div className="panel card-club">
        <Crest name={preview.name} colors={colors} shape={crest} size={84} />
        <div className="club-name">{preview.name}</div>
        <div className="muted">{preview.city} · {preview.blasone}</div>
        <div className="small">Allenatore: <strong>{preview.coachName}</strong> ({preview.coachLabel})</div>
        <Radar ratings={preview.ratings} />
        <div className="voto"><span className="num">{preview.voto}</span><span className="classe">{preview.classe}</span></div>
        {(preview.traits ?? []).length > 0 && (
          <div className="trait-chips">
            {(preview.traits ?? []).filter((t) => t in TRAITS).map((t) => <span key={t} className="trait-chip" title={TRAITS[t as TraitId].desc}>{TRAITS[t as TraitId].icon} {TRAITS[t as TraitId].label}</span>)}
          </div>
        )}
      </div>
      <form className="panel" onSubmit={save}>
        {err && <div className="error">{err}</div>}
        <label className="field"><span>Nome del club</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Real ${preview.city}`} maxLength={28} required />
        </label>
        <div className="field"><span className="muted small">Colori sociali</span>
          <div className="row wrap-row" style={{ marginTop: 6 }}>
            {PRESETS.map((p, i) => (
              <button type="button" key={i} aria-label={`Colori ${p[0]} e ${p[1]}`} aria-pressed={colors[0] === p[0] && colors[1] === p[1]} onClick={() => setColors(p)}
                style={{ width: 38, height: 38, borderRadius: 10, border: colors[0] === p[0] && colors[1] === p[1] ? "3px solid #ffb31a" : "1px solid rgba(243,246,238,.3)", background: `linear-gradient(90deg, ${p[0]} 50%, ${p[1]} 50%)`, cursor: "pointer" }} />
            ))}
            <input type="color" aria-label="Primo colore" value={colors[0]} onChange={(e) => setColors([e.target.value, colors[1]])} />
            <input type="color" aria-label="Secondo colore" value={colors[1]} onChange={(e) => setColors([colors[0], e.target.value])} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}><span className="muted small">Forma dello stemma</span>
          <div className="seg" style={{ marginTop: 6 }}>
            {CRESTS.map((c) => <button type="button" key={c} aria-pressed={crest === c} onClick={() => setCrest(c)}>{c}</button>)}
          </div>
        </div>
        {hasFuori && (
          <label className="field" style={{ marginTop: 12 }}><span>Nome del tuo fuoriclasse ({preview.fuoriclasse!.levelLabel})</span>
            <input type="text" value={fname} onChange={(e) => setFname(e.target.value)} placeholder="Il Fenomeno" maxLength={28} />
          </label>
        )}
        <button className="btn block" style={{ marginTop: 8 }} disabled={busy || name.trim().length < 2}>{busy ? "Salvo…" : "Fonda il club"}</button>
      </form>
    </div>
  );
}
