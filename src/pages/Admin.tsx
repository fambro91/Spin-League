import { useEffect, useState } from "react";
import { api, copy, fmtDate, playerLink, store } from "../api";
import { Logo } from "../components/Logo";
import { AppBar } from "../components/AppBar";
import { IcCopy, IcSend, IcShare, IcUsers } from "../components/Icons";

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
    if (!part) return { label: "non ha ancora aperto il link", ready: false, dot: "no" };
    return part.status === "ready" ? { label: "club pronto", ready: true, dot: "ok" } : { label: "sta girando le ruote", ready: false, dot: "mid" };
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
            <div className="grow"><strong>{p.name}</strong>{p.id === me.id ? " (tu)" : ""}<div className="small muted"><span className={`status-dot sd-${s.dot}`} />{s.label}</div></div>
            <div className="row">
              {lk ? (
                <>
                  {p.id !== me.id && <button className="btn small" onClick={() => share(p)}><IcShare size={16} className="ic" />Invia link</button>}
                  <button className="btn ghost small" onClick={async () => { const ok = await copy(playerLink(lk)); setMsg(ok ? `Link di ${p.name} copiato.` : playerLink(lk)); }}><IcCopy size={16} className="ic" />Copia</button>
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
          <div className="code-box" style={{ marginBottom: 10 }}>
            <IcSend size={20} />
            <span className="grow">/collega {d.tgCode}</span>
            <button className="icon-btn plain" aria-label="Copia il comando" onClick={async () => { const ok = await copy(`/collega ${d.tgCode}`); setMsg(ok ? "Comando copiato: incollalo nel gruppo." : `/collega ${d.tgCode}`); }}><IcCopy size={20} /></button>
          </div>
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
      <AppBar title="Organizzatore" left={<Logo size={34} wordmark={false} />} right={<span />} />
      {myLink && <a className="btn block" href={`#/p/${myLink}`} style={{ textAlign: "center", marginBottom: 10 }}>Vai al mio club</a>}
      <p className="small muted" style={{ margin: "4px 0 0" }}>Salva questa pagina nei preferiti: serve per gestire il campionato.</p>
      <h1 style={{ marginTop: 10 }}>{L.name}</h1>
      <p className="muted">Stagione {L.season} · {L.status === "setup" ? "preparazione" : L.status === "running" ? `giornata ${L.matchdayPlayed} di ${L.totalMatchdays} giocata` : "conclusa"}</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}

      {L.status === "setup" && (
        <ol className="steps">
          <li className={`panel step-card ${d.players.length > 1 ? "done" : ""}`}>
            <h2>Invita gli amici <span className="small muted">({readyCount}/{d.players.length} pronti)</span></h2>
            <p className="small muted">Aggiungi un amico, poi premi "Invia link": ognuno crea il suo club dal proprio telefono.</p>
            <form className="row" style={{ marginBottom: 6 }} onSubmit={(e) => { e.preventDefault(); const n = newName.trim(); if (!n) return; act(async () => { const r = await api(`admin/${token}/players`, { body: { name: n } }); saveLink(r.id, r.token); setNewName(""); }, `${n} aggiunto. Premi "Invia link" per mandarglielo.`); }}>
              <input type="text" className="grow" placeholder="Nome dell'amico" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} />
              <button className="btn small" disabled={busy || !newName.trim()}>Aggiungi</button>
            </form>
            <div className="light-list"><PlayerList /></div>
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
            <p>Si gioca il {fmtDate(L.nextMatchDate)} alle 21:00, in automatico. Formazioni pronte: <strong>{d.participants.filter((x: any) => !x.isCpu && x.confirmed).length}/{d.participants.filter((x: any) => !x.isCpu).length}</strong></p>
            <div className="progress-dots" aria-hidden style={{ marginBottom: 8 }}>{d.participants.filter((x: any) => !x.isCpu).map((x: any) => <i key={x.id} className={x.confirmed ? "on" : ""} />)}</div>
            <ul className="checklist" style={{ marginBottom: 12 }}>
              {d.participants.filter((x: any) => !x.isCpu).map((x: any) => (
                <li key={x.id}><span className="ck">{x.confirmed ? "✅" : "⏳"}</span><span>{x.owner}: {x.confirmed ? "formazione pronta" : "deve ancora scegliere"}</span></li>
              ))}
            </ul>
            <button className="btn ghost block" disabled={busy} onClick={() => confirm("Giocare adesso la prossima giornata, senza aspettare le 21:00?") && act(() => api(`admin/${token}/play-now`, { method: "POST" }), "Giornata giocata: la serata è pronta nell'app.")}>Gioca subito la giornata {L.nextMatchday}</button>
            <p className="small muted" style={{ marginTop: 8 }}>Utile per provare il gioco o recuperare una giornata.</p>
          </div>
          <div className="panel"><h2>Telegram</h2>{Telegram}</div>
          <div className="panel"><h2 style={{ display: "flex", gap: 8, alignItems: "center" }}><IcUsers />Link dei giocatori</h2><div className="light-list"><PlayerList compact /></div></div>
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
