import { useState } from "react";
import { api, store } from "../api";
import { Player } from "./Player";
import { Logo } from "../components/Logo";
import { AppBar } from "../components/AppBar";
import { IcRotate } from "../components/Icons";

export type SoloSave = { playerToken: string; adminToken: string; teams: number; name: string };
export const SOLO_KEY = "spin:solo";

export function loadSolo(): SoloSave | null {
  try { return JSON.parse(store.get(SOLO_KEY) ?? "null"); } catch { return null; }
}

/** Cancella la carriera e torna alla schermata iniziale. */
export async function restartSolo() {
  const { wipeSolo } = await import("../solo/runtime");
  await wipeSolo();
  try { localStorage.removeItem(SOLO_KEY); } catch { /* storage non disponibile */ }
  location.hash = "#/solo";
  location.reload();
}

/** Pulsante ↻ con conferma: cancella la carriera da qualsiasi schermata (anche a metà degli spin). */
export function RestartButton({ plain = true }: { plain?: boolean }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className={`icon-btn ${plain ? "plain" : ""}`} aria-label="Ricomincia la carriera" onClick={() => setAsk(true)}><IcRotate /></button>
      {ask && (
        <div className="modal confirm" role="dialog" aria-label="Ricomincia la carriera">
          <div className="wrap">
            <div className="panel cta-card">
              <h2>Ricominciare la carriera?</h2>
              <p>Cancelli tutto quello che hai fatto finora su questo dispositivo (club, campionato e albo d'oro) e riparti dalla schermata iniziale.</p>
              <div className="stack">
                <button className="btn block" disabled={busy} onClick={() => { setBusy(true); restartSolo(); }}>{busy ? "Ricomincio…" : "Sì, ricomincia"}</button>
                <button className="btn ghost block" disabled={busy} onClick={() => setAsk(false)}>Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const TEAMS = [6, 8, 10, 12];

export function Solo() {
  const [saved, setSaved] = useState<SoloSave | null>(loadSolo);
  const [name, setName] = useState(store.get("spin:soloName") ?? "");
  const [teams, setTeams] = useState(8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (saved) return <Player token={saved.playerToken} solo={{ adminToken: saved.adminToken, teams: saved.teams }} />;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const n = name.trim();
      const r = await api<{ adminToken: string; playerToken: string }>("leagues", { body: { name: `Carriera di ${n}`, adminName: n } });
      const s: SoloSave = { playerToken: r.playerToken, adminToken: r.adminToken, teams, name: n };
      store.set(SOLO_KEY, JSON.stringify(s));
      store.set("spin:soloName", n);
      setSaved(s);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="wrap">
      <AppBar title="Gioca da solo" onBack={() => { location.hash = "#/"; }} />
      <div style={{ textAlign: "center", margin: "6px 0 14px" }}><Logo size={110} /></div>
      <form className="panel cta-card" onSubmit={start}>
        <h2>La tua carriera</h2>
        <p className="muted small">Crei il club con le ruote e affronti un campionato contro squadre bot. Giochi le giornate quando vuoi, una dietro l'altra. La partita resta salvata su questo dispositivo e funziona anche senza connessione.</p>
        {err && <div className="error">{err}</div>}
        <label className="field"><span>Il tuo nome</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Giacomo" maxLength={24} required />
        </label>
        <div className="field"><span>Squadre nel campionato</span>
          <div className="seg" role="radiogroup" aria-label="Squadre nel campionato" style={{ marginTop: 6 }}>
            {TEAMS.map((t) => <button type="button" key={t} role="radio" aria-checked={teams === t} aria-selected={teams === t} onClick={() => setTeams(t)}>{t}</button>)}
          </div>
          <span className="small muted">{teams} squadre = {(teams - 1) * 2} giornate</span>
        </div>
        <button className="btn block pulse" disabled={busy || !name.trim()}>{busy ? "Preparo…" : "Inizia la carriera"}</button>
      </form>
    </div>
  );
}
