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
    try { const r = await api(`admin/${token}`); setD(r); setErr(null); store.set(`spin:admin:${r.league.id}`, token); } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { store.set("spin:lastAdmin", token); load(); }, [token]);
  const saveLink = (pid: string, t: string) => { const n = { ...links, [pid]: t }; setLinks(n); store.set(linksKey, JSON.stringify(n)); };
  const linkFor = (p: any) => links[p.id] ?? links[p.name];

  const act = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!d) return <div className="wrap">{err ? <div className="error">{err}</div> : <p>Carico…</p>}</div>;
  const L = d.league;
  const me = d.players[0];
  const myLink = me && linkFor(me);
  const partOf = (pid: string) => d.participants.find((x: any) => x.playerId === pid);
  const statusOf = (pid: string) => {
    const part = partOf(pid);
    if (!part) return { label: "non ha ancora aperto il link", ready: false };
    return part.status === "ready" ? { label: "club pronto", ready: true } : { label: "sta girando le ruote", ready: false };
  };
  const readyCount = d.players.filter((p: any) => statusOf(p.id).ready).length;
  const allReady = readyCount === d.players.length && d.players.length > 0;

  const share = async (p: any) => {
    const url = playerLink(linkFor(p));
    const text = `Ciao ${p.name}! Ecco il tuo link per ${L.name} su Spin League: ${url}`;
    if (navigator.share) { try { await navigator.share({ title: "Spin League", text }); return; } catch { /* annullato */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const PlayerList = ({ compact }: { compact?: boolean }) => (
    <>
      {d.players.map((p: any) => {
        const s = statusOf(p.id);
        const lk = linkFor(p);
        return (
          <div key={p.id} className="player-row">
            <div className="grow"><strong>{p.name}</strong>{p.id === me.id ? " (tu)" : ""}<div className="small muted">{s.ready ? "✅ " : "⏳ "}{s.label}</div></div>
            <div className="row">
              {lk ? (
                <>
                  {p.id !== me.id && <button className="btn small" onClick={() => share(p)}>Invia link</button>}
                  <button className="btn ghost small" onClick={async () => { const ok = await copy(playerLink(lk)); setMsg(ok ? `Link di ${p.name} copiato.` : playerLink(lk)); }}>Copia</button>
                </>
              ) : (
                <button className="btn ghost small" disabled={busy} onClick={() => act(async () => { const r = await api(`admin/${token}/players/${p.id}/link`, { method: "POST" }); saveLink(p.id, r.token); }, `Nuovo link per ${p.name}. Il vecchio non funziona più.`)}>Crea nuovo link</button>
              )}
              {!compact && L.status === "setup" && p.id !== me.id && <button className="btn ghost small" aria-label={`Rimuovi ${p.name}`} disabled={busy} onClick={() => confirm(`Rimuovere ${p.name}?`) && act(() => api(`admin/${token}/players/${p.id}`, { method: "DELETE" }))}>✕</button>}
            </div>
          </div>
        );
      })}
    </>
  );

  const Telegram = (
    <>
      {!d.telegramToken ? (
        <p className="muted">Manca il secret <code>TELEGRAM_BOT_TOKEN</code> su Cloudflare.</p>
      ) : L.telegram && !d.tgCode ? (
        <>
          <p>✅ Chat collegata: cronache, risultati e promemoria arrivano lì.</p>
          <div className="row wrap-row">
            <button className="btn ghost small" disabled={busy} onClick={() => act(() => api(`admin/${token}/telegram-test`, { method: "POST" }), "Messaggio di prova inviato.")}>Invia un messaggio di prova</button>
            <button className="btn ghost small" disabled={busy} onClick={() => act(() => api(`admin/${token}/telegram`, { method: "POST" }))}>Collega un'altra chat</button>
          </div>
        </>
      ) : d.tgCode ? (
        <>
          <p>Aggiungi {d.botName ? <strong>@{d.botName}</strong> : "il bot"} al gruppo degli amici e scrivi nel gruppo:</p>
          <p className="linkbox" style={{ fontSize: 20 }}>/collega {d.tgCode}</p>
          <button className="btn ghost small" onClick={load}>Fatto, controlla</button>
        </>
      ) : (
        <>
          <p className="muted small">Il bot pubblica cronaca e classifica ogni sera e ricorda alle 18:00 chi deve ancora scegliere.</p>
          <button className="btn small" disabled={busy} onClick={() => act(() => api(`admin/${token}/telegram`, { method: "POST" }))}>Collega il gruppo</button>
        </>
      )}
    </>
  );

  return (
    <div className="wrap">
      <div className="row spread" style={{ marginTop: 8 }}>
        <span className="small muted">Pagina organizzatore · salvala nei preferiti</span>
        {myLink && <a className="btn small" href={`#/p/${myLink}`}>Il mio club</a>}
      </div>
      <h1 style={{ marginTop: 10 }}>{L.name}</h1>
      <p className="muted">Stagione {L.season} · {L.status === "setup" ? "preparazione" : L.status === "running" ? `giornata ${L.matchdayPlayed} di ${L.totalMatchdays} giocata` : "conclusa"}</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}

      {L.status === "setup" && (
        <ol className="steps">
          <li className={`panel step-card ${d.players.length > 1 ? "done" : ""}`}>
            <h2>Invita gli amici</h2>
            <p className="small muted">Aggiungi un amico, poi premi "Invia link": ognuno crea il suo club dal proprio telefono.</p>
            <form className="row" style={{ marginBottom: 6 }} onSubmit={(e) => { e.preventDefault(); const n = newName.trim(); if (!n) return; act(async () => { const r = await api(`admin/${token}/players`, { body: { name: n } }); saveLink(r.id, r.token); setNewName(""); }, `${n} aggiunto. Premi "Invia link" per mandarglielo.`); }}>
              <input type="text" className="grow" placeholder="Nome dell'amico" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} />
              <button className="btn small" disabled={busy || !newName.trim()}>Aggiungi</button>
            </form>
            <PlayerList />
          </li>
          <li className={`panel step-card ${L.telegram ? "done" : ""}`}>
            <h2>Collega il gruppo Telegram</h2>
            {Telegram}
          </li>
          <li className="panel step-card">
            <h2>Avvia il campionato</h2>
            <p>{allReady ? "Tutti i club sono pronti." : `Club pronti: ${readyCount} su ${d.players.length}. Puoi avviare quando tutti hanno finito.`}</p>
            <label className="field"><span>Squadre totali (le CPU completano il numero)</span>
              <select value={teams} onChange={(e) => setTeams(Number(e.target.value))}>
                {[4, 6, 8, 10, 12].filter((n) => n >= d.players.length).map((n) => <option key={n} value={n}>{n} squadre · {2 * (n - 1)} giornate</option>)}
              </select>
            </label>
            <div className="seg" style={{ marginBottom: 12 }}>
              <button type="button" aria-pressed={firstDay === "oggi"} onClick={() => setFirstDay("oggi")}>Prima giornata stasera</button>
              <button type="button" aria-pressed={firstDay === "domani"} onClick={() => setFirstDay("domani")}>Domani sera</button>
            </div>
            <button className="btn block" disabled={busy || !allReady} onClick={() => act(() => api(`admin/${token}/start`, { body: { teams, firstDay } }), "Campionato avviato!")}>Avvia il campionato</button>
          </li>
        </ol>
      )}

      {L.status === "running" && (
        <>
          <div className="panel cta-card">
            <h2>Giornata {L.nextMatchday}</h2>
            <p>Si gioca il {fmtDate(L.nextMatchDate)} alle 21:00, in automatico.</p>
            <ul className="checklist" style={{ marginBottom: 12 }}>
              {d.participants.filter((x: any) => !x.isCpu).map((x: any) => (
                <li key={x.id}><span className="ck">{x.confirmed ? "✅" : "⏳"}</span><span>{x.owner}: {x.confirmed ? "formazione pronta" : "deve ancora scegliere"}</span></li>
              ))}
            </ul>
            <button className="btn ghost block" disabled={busy} onClick={() => confirm("Giocare adesso la prossima giornata, senza aspettare le 21:00?") && act(() => api(`admin/${token}/play-now`, { method: "POST" }), "Giornata giocata: la serata è pronta nell'app.")}>Gioca subito la giornata {L.nextMatchday}</button>
            <p className="small muted" style={{ marginTop: 8 }}>Utile per provare il gioco o recuperare una giornata.</p>
          </div>
          <div className="panel"><h2>Telegram</h2>{Telegram}</div>
          <div className="panel"><h2>Link dei giocatori</h2><PlayerList compact /></div>
        </>
      )}

      {L.status === "finished" && (
        <>
          <div className="panel cta-card">
            <h2>Stagione conclusa</h2>
            <p>Apri una nuova stagione: ognuno riapre il suo link e rigira le ruote. L'albo d'oro resta.</p>
            <button className="btn block" disabled={busy} onClick={() => act(() => api(`admin/${token}/new-season`, { method: "POST" }), "Nuova stagione aperta.")}>Apri la stagione {L.season + 1}</button>
          </div>
          <div className="panel"><h2>Telegram</h2>{Telegram}</div>
        </>
      )}
    </div>
  );
}
