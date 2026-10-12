import { useEffect, useState } from "react";
import { api, copy, fmtDate, playerLink, store } from "../api";

export function Admin({ token }: { token: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [teams, setTeams] = useState(8);
  const [firstDay, setFirstDay] = useState<"oggi" | "domani">("domani");
  const [busy, setBusy] = useState(false);
  const linksKey = `spin:links:${token}`;
  const [links, setLinks] = useState<Record<string, string>>(() => { try { return JSON.parse(store.get(linksKey) ?? "{}"); } catch { return {}; } });

  const load = async () => {
    try { const r = await api(`admin/${token}`); setD(r); setErr(null); } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { store.set("spin:lastAdmin", token); load(); }, [token]);
  const saveLink = (name: string, t: string) => { const n = { ...links, [name]: t }; setLinks(n); store.set(linksKey, JSON.stringify(n)); };

  const act = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!d) return <div className="wrap">{err ? <div className="error">{err}</div> : <p>Carico…</p>}</div>;
  const L = d.league;
  const humans = d.participants.filter((p: any) => !p.isCpu);
  const statusOf = (pid: string) => {
    const owner = d.players.find((p: any) => p.id === pid)?.name;
    const part = d.participants.find((p: any) => p.owner === owner && !p.isCpu);
    if (!part) return "non ha ancora aperto il link";
    return part.status === "ready" ? "club pronto" : part.status === "identity" ? "sta scegliendo il nome" : "sta girando le ruote";
  };

  return (
    <div className="wrap">
      <p className="small muted" style={{ marginTop: 8 }}>Pagina dell'organizzatore · salva questo link, serve per gestire il campionato.</p>
      <h1>{L.name}</h1>
      <p className="muted">Stagione {L.season} · {L.status === "setup" ? "creazione dei club" : L.status === "running" ? `giornata ${L.matchdayPlayed} di ${L.totalMatchdays} giocata` : "stagione conclusa"}</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="panel">
        <h2>Giocatori</h2>
        {d.players.map((p: any) => (
          <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(243,246,238,.08)" }}>
            <div className="row spread">
              <div><strong>{p.name}</strong> <span className="muted small">· {statusOf(p.id)}</span></div>
              <div className="row">
                {links[p.name]
                  ? <button className="btn small" onClick={async () => { const ok = await copy(playerLink(links[p.name])); setMsg(ok ? `Link di ${p.name} copiato.` : playerLink(links[p.name])); }}>Copia link</button>
                  : <button className="btn ghost small" disabled={busy} onClick={() => act(async () => { const r = await api(`admin/${token}/players/${p.id}/link`, { method: "POST" }); saveLink(p.name, r.token); }, `Nuovo link creato per ${p.name}. Il vecchio non funziona più.`)}>Crea nuovo link</button>}
                {L.status === "setup" && <button className="btn ghost small" aria-label={`Rimuovi ${p.name}`} disabled={busy} onClick={() => confirm(`Rimuovere ${p.name}?`) && act(() => api(`admin/${token}/players/${p.id}`, { method: "DELETE" }))}>✕</button>}
              </div>
            </div>
          </div>
        ))}
        {L.status === "setup" && (
          <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); const n = newName.trim(); if (!n) return; act(async () => { const r = await api(`admin/${token}/players`, { body: { name: n } }); saveLink(n, r.token); setNewName(""); }, `${n} aggiunto: copia il suo link e mandaglielo.`); }}>
            <input type="text" className="grow" placeholder="Nome dell'amico" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} />
            <button className="btn small" disabled={busy || !newName.trim()}>Aggiungi</button>
          </form>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>I link si possono copiare solo da questo dispositivo. Da un altro, usa "Crea nuovo link".</p>
      </div>

      {L.status === "setup" && (
        <div className="panel">
          <h2>Avvia il campionato</h2>
          <p className="muted small">Si parte quando tutti hanno finito il club. Le squadre mancanti diventano CPU.</p>
          <label className="field"><span>Squadre totali (le CPU completano il numero)</span>
            <select value={teams} onChange={(e) => setTeams(Number(e.target.value))}>
              {[4, 6, 8, 10, 12].filter((n) => n >= humans.length).map((n) => <option key={n} value={n}>{n} squadre · {2 * (n - 1)} giornate</option>)}
            </select>
          </label>
          <div className="seg" style={{ marginBottom: 12 }}>
            <button type="button" aria-pressed={firstDay === "oggi"} onClick={() => setFirstDay("oggi")}>Prima giornata oggi alle 21</button>
            <button type="button" aria-pressed={firstDay === "domani"} onClick={() => setFirstDay("domani")}>Domani alle 21</button>
          </div>
          <button className="btn block" disabled={busy} onClick={() => act(() => api(`admin/${token}/start`, { body: { teams, firstDay } }), "Campionato avviato!")}>Avvia il campionato</button>
        </div>
      )}

      {L.status === "running" && (
        <div className="panel">
          <h2>Giornata</h2>
          <p>Prossima: giornata {L.nextMatchday}, il {fmtDate(L.nextMatchDate)} alle 21:00.</p>
          <button className="btn ghost" disabled={busy} onClick={() => confirm("Giocare subito la prossima giornata?") && act(() => api(`admin/${token}/play-now`, { method: "POST" }), "Giornata giocata.")}>Gioca subito la prossima giornata</button>
          <p className="small muted" style={{ marginTop: 8 }}>Utile per provare il gioco o recuperare una giornata. Di norma si gioca da sola alle 21:00.</p>
        </div>
      )}

      {L.status === "finished" && (
        <div className="panel">
          <h2>Stagione conclusa</h2>
          <p>Si riparte con nuovi club: ognuno riapre il suo link e rigira le ruote.</p>
          <button className="btn" disabled={busy} onClick={() => act(() => api(`admin/${token}/new-season`, { method: "POST" }), "Nuova stagione aperta.")}>Apri la stagione {L.season + 1}</button>
        </div>
      )}

      <div className="panel">
        <h2>Gruppo Telegram</h2>
        {!d.telegramToken ? (
          <p className="muted">Il bot non è ancora configurato: aggiungi il secret <code>TELEGRAM_BOT_TOKEN</code> su Cloudflare (vedi la guida nel repository).</p>
        ) : L.telegram ? (
          <>
            <p>Gruppo collegato. Cronache, risultati e promemoria arrivano lì.</p>
            <div className="row wrap-row">
              <button className="btn ghost small" disabled={busy} onClick={() => act(() => api(`admin/${token}/telegram-test`, { method: "POST" }), "Messaggio di prova inviato.")}>Invia un messaggio di prova</button>
              <button className="btn ghost small" disabled={busy} onClick={() => act(() => api(`admin/${token}/telegram`, { method: "POST" }))}>Collega un'altra chat</button>
            </div>
            {d.tgCode && <p style={{ marginTop: 10 }}>Scrivi nella nuova chat: <span className="linkbox">/collega {d.tgCode}</span></p>}
          </>
        ) : d.tgCode ? (
          <>
            <p>Aggiungi {d.botName ? <strong>@{d.botName}</strong> : "il bot"} al gruppo degli amici e scrivi nel gruppo il comando qui sotto. Per una prova puoi anche scriverlo in chat privata al bot.</p>
            <p className="linkbox" style={{ fontSize: 20 }}>/collega {d.tgCode}</p>
            <button className="btn ghost small" onClick={load}>Ho scritto il codice</button>
          </>
        ) : (
          <button className="btn small" disabled={busy} onClick={() => act(() => api(`admin/${token}/telegram`, { method: "POST" }))}>Collega un gruppo</button>
        )}
      </div>

      {links[d.players[0]?.name] && (
        <p style={{ textAlign: "center" }}><a className="btn" href={`#/p/${links[d.players[0].name]}`}>Vai al mio club</a></p>
      )}
    </div>
  );
}
