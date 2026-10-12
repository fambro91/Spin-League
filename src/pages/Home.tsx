import { useState } from "react";
import { api, adminLink, playerLink, store } from "../api";
import { WheelCanvas } from "../components/WheelCanvas";
import { Logo } from "../components/Logo";
import { WHEELS } from "../../shared/wheels";

export function Home() {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [secret, setSecret] = useState("");
  const [needSecret, setNeedSecret] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = store.get("spin:lastAdmin");
  const lastPlayer = store.get("spin:lastPlayer");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api<{ adminToken: string; playerToken: string }>("leagues", { body: { name, adminName, secret: secret || undefined } });
      store.set("spin:lastAdmin", r.adminToken);
      store.set("spin:lastPlayer", r.playerToken);
      store.set(`spin:links:${r.adminToken}`, JSON.stringify({ [adminName]: r.playerToken }));
      location.hash = `#/admin/${r.adminToken}`;
    } catch (e: any) {
      setErr(e.message);
      if (/codice/i.test(e.message)) setNeedSecret(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="wrap">
      <div style={{ textAlign: "center", paddingTop: 18 }}>
        <Logo size={150} />
        <div className="hero-wheel"><WheelCanvas wheel={WHEELS.blasone} target={null} idleSpin hub="⚽" /></div>
        <p className="muted" style={{ maxWidth: 420, margin: "0 auto 18px" }}>
          Ogni giorno una nuova partita, ogni giorno una nuova storia. Il club lo decidono le ruote; si gioca alle 21:00.
        </p>
      </div>

      {(last || lastPlayer) && (
        <div className="panel row wrap-row">
          {lastPlayer && <a className="btn small" href={playerLink(lastPlayer).replace(location.origin, "")}>Apri il mio club</a>}
          {last && <a className="btn ghost small" href={adminLink(last).replace(location.origin, "")}>Pagina organizzatore</a>}
        </div>
      )}

      <form className="panel" onSubmit={create}>
        <h2>Crea un campionato</h2>
        <p className="muted small">Diventi l'organizzatore: aggiungi gli amici e ognuno riceve il suo link personale.</p>
        {err && <div className="error">{err}</div>}
        <label className="field"><span>Nome del campionato</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Serie Spin degli amici" maxLength={40} />
        </label>
        <label className="field"><span>Il tuo nome</span>
          <input type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Giacomo" maxLength={24} required />
        </label>
        {needSecret && (
          <label className="field"><span>Codice di creazione</span>
            <input type="text" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </label>
        )}
        <button className="btn block" disabled={busy || !adminName.trim()}>{busy ? "Creo…" : "Crea il campionato"}</button>
      </form>

      <div className="panel flat">
        <h3>Come funziona</h3>
        <ol className="muted" style={{ paddingLeft: 20, margin: 0 }}>
          <li>Ognuno gira 14 ruote: città, blasone, reparti, allenatore, budget, stadio, tifosi, fuoriclasse.</li>
          <li>Tre spin fortunati di fila sbloccano la ruota dorata.</li>
          <li>Ogni giorno scegli modulo e tattica entro le 21:00, poi guardi gli highlights e la cronaca.</li>
        </ol>
      </div>
    </div>
  );
}
