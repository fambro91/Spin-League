import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, store } from "../api";
import { Creation } from "./Creation";
import { Identity } from "./Identity";
import { Bar, Crest, Form, Radar } from "../components/ClubBits";
import { Replay } from "../components/Replay";
import { ATTEGGIAMENTI, MODULI, REPARTI, REPARTO_LABEL, type Reparto } from "../../shared/types";
import { marketCost, marketIncome } from "../../shared/league";

type Tab = "club" | "partita" | "classifica" | "calendario" | "notizie";
const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: "club", label: "Club", ico: "🛡️" },
  { id: "partita", label: "Partita", ico: "📋" },
  { id: "classifica", label: "Classifica", ico: "🏆" },
  { id: "calendario", label: "Calendario", ico: "📅" },
  { id: "notizie", label: "Notizie", ico: "📰" },
];

export function Player({ token }: { token: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => (store.get("spin:tab") as Tab) || "partita");
  const [clubModal, setClubModal] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<string | null>(null);

  const load = async () => {
    try { setD(await api(`me/${token}`)); setErr(null); } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { store.set("spin:lastPlayer", token); load(); }, [token]);
  useEffect(() => { store.set("spin:tab", tab); window.scrollTo(0, 0); }, [tab]);

  if (!d) return <div className="wrap">{err ? <div className="error">{err}</div> : <p>Carico…</p>}</div>;
  const mine = d.mine;
  if (mine?.status === "creating") return <Creation token={token} creation={mine.creation} onFinished={load} />;
  if (mine?.status === "identity") return <Identity token={token} draft={mine.creation.draft} onDone={load} />;

  const clubsById = new Map<string, any>(d.clubs.map((c: any) => [c.id, c]));
  const ctx = { d, token, reload: load, clubsById, openClub: setClubModal, openMatch: setMatchModal };

  return (
    <>
      <div className="wrap">
        <div className="row spread" style={{ marginTop: 6 }}>
          <div className="small muted">{d.league.name} · stagione {d.league.season}</div>
          <div className="small muted">{d.player.name}</div>
        </div>
        {err && <div className="error">{err}</div>}
        {!mine && <div className="panel"><h2>Stagione in corso</h2><p>Questa stagione è partita senza il tuo club. Potrai crearne uno alla prossima.</p></div>}
        {tab === "club" && <ClubTab {...ctx} />}
        {tab === "partita" && <MatchTab {...ctx} />}
        {tab === "classifica" && <TableTab {...ctx} />}
        {tab === "calendario" && <CalendarTab {...ctx} />}
        {tab === "notizie" && <NewsTab {...ctx} />}
      </div>
      <div className="tabbar"><nav>
        {TABS.map((t) => <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}><span className="ico" aria-hidden>{t.ico}</span>{t.label}</button>)}
      </nav></div>
      {clubModal && <ClubModal club={clubsById.get(clubModal)} onClose={() => setClubModal(null)} />}
      {matchModal && <MatchModal token={token} id={matchModal} clubsById={clubsById} onClose={() => setMatchModal(null)} />}
    </>
  );
}

type Ctx = { d: any; token: string; reload: () => Promise<void>; clubsById: Map<string, any>; openClub: (id: string) => void; openMatch: (id: string) => void };

function ClubCard({ c, state }: { c: any; state?: any }) {
  const ratings = state?.ratings ?? c.ratings;
  return (
    <div className="panel card-club">
      <Crest name={c.name} colors={c.colors} shape={c.crest} size={84} />
      <div className="club-name">{c.name}</div>
      <div className="muted">{c.city} · {c.blasone} · presidente {c.owner ?? "tu"}</div>
      <Radar ratings={ratings} compare={state ? c.ratings : c.initialRatings} />
      <div className="voto"><span className="num">{c.voto}</span><span className="classe">{c.classe}</span></div>
      <dl className="facts">
        <div><dt>Allenatore</dt><dd>{c.coachLabel}</dd></div>
        <div><dt>Modulo preferito</dt><dd>{c.preferredModule === "tutti" ? "Tutti" : c.preferredModule}</dd></div>
        <div><dt>Stadio</dt><dd>{typeof c.stadium === "string" ? c.stadium : c.stadium.label}</dd></div>
        <div><dt>Tifoseria</dt><dd>{typeof c.fans === "string" ? c.fans : c.fans.label}</dd></div>
        <div><dt>Fuoriclasse</dt><dd>{c.fuoriclasse ? `${c.fuoriclasse.name} (${c.fuoriclasse.levelLabel}, +${c.fuoriclasse.bonus} ${REPARTO_LABEL[c.fuoriclasse.ruolo as Reparto]})` : "Nessuno"}</dd></div>
        <div><dt>Sponsor</dt><dd>{c.sponsor || "—"}</dd></div>
        {state && <div><dt>Budget</dt><dd>{state.budget} M€</dd></div>}
        {state && <div><dt>Condizione · morale</dt><dd>{state.cond} · {state.morale}</dd></div>}
      </dl>
      <p className="small muted" style={{ marginTop: 10 }}>Il profilo tratteggiato mostra i valori di partenza.</p>
    </div>
  );
}

function ClubTab({ d }: Ctx) {
  const mine = d.mine;
  if (!mine?.club) return null;
  const c = { ...mine.club, owner: d.player.name };
  return (
    <>
      <ClubCard c={c} state={mine.state} />
      <div className="panel">
        <h3>Rosa</h3>
        <p className="small muted">I nomi servono per marcatori e cronaca; la forza è quella dei reparti.</p>
        <div className="small" style={{ columns: 2 }}>
          {mine.club.roster.map((p: any) => <div key={p.name}><span className="muted">{p.ruolo}</span> {p.name}{mine.club.fuoriclasse?.name === p.name ? " ⭐" : ""}</div>)}
        </div>
      </div>
      {mine.club.notes?.length > 0 && <div className="panel"><h3>Dalla creazione</h3>{mine.club.notes.map((n: string, i: number) => <p key={i} className="small">{n}</p>)}</div>}
    </>
  );
}

function MatchTab({ d, token, reload, clubsById, openClub, openMatch }: Ctx) {
  const L = d.league, mine = d.mine;
  const state = mine?.state;
  const [choices, setChoices] = useState(state?.choices);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setChoices(state?.choices); }, [state?.choices?.modulo, state?.choices?.atteggiamento, state?.choices?.turnover, state?.choices?.discorso]);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); setMsg(ok); await reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (L.status === "setup") {
    return (
      <div className="panel">
        <h2>In attesa del fischio d'inizio</h2>
        <p>Il campionato parte quando tutti hanno creato il club e l'organizzatore lo avvia.</p>
        {d.participants.filter((p: any) => !p.isCpu).map((p: any) => (
          <div key={p.id} className="row spread small" style={{ padding: "4px 0" }}><span>{p.owner}</span><span className="muted">{p.status === "ready" ? "pronto" : "sta creando"}</span></div>
        ))}
      </div>
    );
  }
  const myId = mine?.id;
  const next = d.matches.find((m: any) => m.matchday === L.nextMatchday && (m.homeId === myId || m.awayId === myId));
  const lastPlayed = [...d.matches].filter((m: any) => m.played && (m.homeId === myId || m.awayId === myId)).pop();
  const confirmed = state?.confirmedFor === L.nextMatchday;

  return (
    <>
      {L.status === "finished" && <SeasonEnd d={d} />}
      {lastPlayed && (
        <div className="panel">
          <div className="row spread"><h3 style={{ margin: 0 }}>Ultima partita</h3><span className="small muted">Giornata {lastPlayed.matchday}</span></div>
          <MatchLine m={lastPlayed} clubsById={clubsById} myId={myId} onClick={() => openMatch(lastPlayed.id)} />
          <button className="btn small" onClick={() => openMatch(lastPlayed.id)}>Guarda gli highlights</button>
        </div>
      )}
      {next && mine && (
        <div className="panel">
          <div className="row spread"><h2 style={{ margin: 0 }}>Giornata {L.nextMatchday}</h2><span className="small muted">{fmtDate(L.nextMatchDate)}, ore 21:00</span></div>
          <MatchLine m={next} clubsById={clubsById} myId={myId} onClick={() => openClub(next.homeId === myId ? next.awayId : next.homeId)} />
          <p className="small muted">{next.homeId === myId ? "In casa" : "In trasferta"} · tocca l'avversario per vedere la sua scheda.</p>

          <div className="stack" style={{ marginTop: 8 }}>
            <div><div className="row spread small"><span>Condizione</span><span>{state.cond}</span></div><Bar value={state.cond} color={state.cond < 60 ? "#e0343f" : "#7ee08a"} /></div>
            <div><div className="row spread small"><span>Morale</span><span>{state.morale}</span></div><Bar value={state.morale} color="#8fd3ff" /></div>
          </div>
          {state.modifiers?.length > 0 && <p className="small" style={{ marginTop: 8 }}>{state.modifiers.map((m: any, i: number) => <span key={i} className="tag">{m.label}: {REPARTO_LABEL[m.rep as Reparto]} {m.delta}</span>)}</p>}
          {state.campoSqualificato && <p className="small">Campo squalificato: niente fattore campo nella prossima partita in casa.</p>}
        </div>
      )}
      {state?.pendingDecision === "fuoriclasse" && (
        <div className="panel" style={{ borderColor: "#ffb31a" }}>
          <h3>{mine.club.fuoriclasse?.name} vuole andare via</h3>
          <p>Vendilo per 60 M€ (perdi il suo bonus) o tienilo (morale −10). Se non decidi entro le 21:00, resta.</p>
          <div className="row">
            <button className="btn small" disabled={busy} onClick={() => act(() => api(`me/${token}/decision`, { body: { sell: true } }), "Fuoriclasse venduto.")}>Vendi</button>
            <button className="btn ghost small" disabled={busy} onClick={() => act(() => api(`me/${token}/decision`, { body: { sell: false } }), "Resta in squadra.")}>Tienilo</button>
          </div>
        </div>
      )}
      {next && mine && choices && (
        <div className="panel">
          <h2>Le tue scelte</h2>
          {err && <div className="error">{err}</div>}
          {msg && <div className="ok">{msg}</div>}
          <Choice label="Modulo" value={choices.modulo} options={MODULI.map((m) => ({ id: m, label: m + (mine.club.preferredModule === m ? " ★" : "") }))} onChange={(v) => setChoices({ ...choices, modulo: v })} />
          <p className="small muted" style={{ marginTop: -4 }}>★ modulo preferito dell'allenatore: +2 ad Attacco, Centrocampo e Difesa.</p>
          <Choice label="Atteggiamento" value={choices.atteggiamento} options={ATTEGGIAMENTI} onChange={(v) => setChoices({ ...choices, atteggiamento: v })} />
          <Choice label="Turnover" value={choices.turnover} options={[{ id: "nessuno", label: "Nessuno" }, { id: "parziale", label: "Parziale" }, { id: "massiccio", label: "Massiccio" }]} onChange={(v) => setChoices({ ...choices, turnover: v })} />
          <Choice label="Discorso nello spogliatoio" value={choices.discorso} options={[{ id: "nessuno", label: "Nessuno" }, { id: "motivare", label: "Motivare" }, { id: "calmare", label: "Calmare" }]} onChange={(v) => setChoices({ ...choices, discorso: v })} />
          <Hint choices={choices} />
          <button className="btn block" disabled={busy} onClick={() => act(() => api(`me/${token}/choices`, { body: choices }), "Scelte confermate per stasera.")}>{confirmed ? "Aggiorna le scelte" : "Conferma le scelte"}</button>
          <p className="small muted" style={{ marginTop: 8 }}>{confirmed ? "Scelte confermate: puoi cambiarle fino alle 21:00." : "Se non confermi, giochi con le scelte di ieri e senza discorso."}</p>
        </div>
      )}
      {L.marketOpen && mine && <Market d={d} token={token} reload={reload} />}
    </>
  );
}

function Hint({ choices }: { choices: any }) {
  const t: Record<string, string> = {
    equilibrato: "Nessun effetto particolare.",
    offensivo: "Segni di più (×1,2), ma concedi di più (×1,15).",
    difensivo: "Segni meno (×0,8), concedi molto meno (×0,75).",
    contropiede: "Concedi meno; se l'avversario attacca o pressa segni ×1,25.",
    pressing: "Segni ×1,1 e concedi ×0,9, ma costa 15 di condizione invece di 10.",
  };
  const tv: Record<string, string> = { nessuno: "", parziale: "Parziale: −2 ai reparti di campo, +6 recupero.", massiccio: "Massiccio: i reparti di campo scendono verso la Panchina, +15 recupero." };
  return <p className="small" style={{ background: "rgba(0,0,0,.25)", padding: "8px 10px", borderRadius: 8 }}>{t[choices.atteggiamento]} {tv[choices.turnover]}</p>;
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (v: any) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="small muted" style={{ marginBottom: 6 }}>{label}</div>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => <button type="button" key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
      </div>
    </div>
  );
}

function Market({ d, token, reload }: { d: any; token: string; reload: () => Promise<void> }) {
  const st = d.mine.state, myId = d.mine.id;
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [offer, setOffer] = useState<Record<string, string>>({});
  const act = async (fn: () => Promise<any>, ok: string) => {
    setErr(null); setMsg(null);
    try { const r = await fn(); setMsg(r?.cpu === "rifiutata" ? "La CPU ha rifiutato: offri di più." : ok); await reload(); } catch (e: any) { setErr(e.message); }
  };
  const incoming = d.offers.filter((o: any) => o.to_club === myId && o.status === "aperta");
  const outgoing = d.offers.filter((o: any) => o.from_club === myId);
  const others = d.clubs.filter((c: any) => c.id !== myId && c.fuoriclasse);
  return (
    <div className="panel" style={{ borderColor: "#ffb31a" }}>
      <h2>Mercato aperto</h2>
      <p className="small">Budget {st.budget} M€ · operazioni usate {st.marketOps}/2 · chiude alla prossima giornata.</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      {REPARTI.map((r) => (
        <div key={r} className="market-row">
          <span>{REPARTO_LABEL[r]} <strong>{st.ratings[r]}</strong></span>
            <button className="btn small" onClick={() => act(() => api(`me/${token}/market`, { body: { op: "buy", rep: r } }), `${REPARTO_LABEL[r]} +2.`)}>+2 · {marketCost(st.ratings[r])} M€</button>
            <button className="btn ghost small" onClick={() => act(() => api(`me/${token}/market`, { body: { op: "sell", rep: r } }), `${REPARTO_LABEL[r]} −2.`)}>−2 · +{marketIncome(st.ratings[r])}</button>
        </div>
      ))}
      <h3 style={{ marginTop: 16 }}>Fuoriclasse degli altri</h3>
      {others.length === 0 && <p className="muted small">Nessun altro club ha un fuoriclasse.</p>}
      {others.map((c: any) => (
        <div key={c.id} className="row spread wrap-row" style={{ padding: "6px 0" }}>
          <span className="small"><strong>{c.fuoriclasse.name}</strong> · {c.name} · +{c.fuoriclasse.bonus} {REPARTO_LABEL[c.fuoriclasse.ruolo as Reparto]}</span>
          <span className="row">
            <input type="number" min={1} style={{ width: 80 }} placeholder="M€" value={offer[c.id] ?? ""} onChange={(e) => setOffer({ ...offer, [c.id]: e.target.value })} aria-label={`Offerta per ${c.fuoriclasse.name}`} />
            <button className="btn small" onClick={() => act(() => api(`me/${token}/offers`, { body: { to: c.id, money: Number(offer[c.id]) } }), "Offerta inviata.")}>Offri</button>
          </span>
        </div>
      ))}
      {incoming.length > 0 && <h3 style={{ marginTop: 16 }}>Offerte ricevute</h3>}
      {incoming.map((o: any) => {
        const from = d.clubs.find((c: any) => c.id === o.from_club);
        return (
          <div key={o.id} className="row spread" style={{ padding: "6px 0" }}>
            <span className="small">{from?.name} offre <strong>{o.money} M€</strong> per il tuo fuoriclasse</span>
            <span className="row">
              <button className="btn small" onClick={() => act(() => api(`me/${token}/offers/${o.id}`, { body: { accept: true } }), "Offerta accettata.")}>Accetta</button>
              <button className="btn ghost small" onClick={() => act(() => api(`me/${token}/offers/${o.id}`, { body: { accept: false } }), "Offerta rifiutata.")}>Rifiuta</button>
            </span>
          </div>
        );
      })}
      {outgoing.length > 0 && <p className="small muted" style={{ marginTop: 10 }}>Le tue offerte: {outgoing.map((o: any) => `${d.clubs.find((c: any) => c.id === o.to_club)?.name} ${o.money} M€ (${o.status})`).join(" · ")}</p>}
    </div>
  );
}

function MatchLine({ m, clubsById, myId, onClick }: { m: any; clubsById: Map<string, any>; myId?: string; onClick?: () => void }) {
  const h = clubsById.get(m.homeId), a = clubsById.get(m.awayId);
  const mine = m.homeId === myId || m.awayId === myId;
  return (
    <div className={`match ${onClick ? "clickable" : ""} ${mine ? "mine" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) onClick(); }}>
      <span className="h"><span className="swatch" style={{ background: h?.colors[0] }} />{h?.name}</span>
      <span className="score">{m.played ? `${m.hg}-${m.ag}` : "vs"}</span>
      <span className="a">{a?.name}<span className="swatch" style={{ background: a?.colors[0], marginLeft: 7, marginRight: 0 }} /></span>
    </div>
  );
}

function TableTab({ d, openClub }: Ctx) {
  const myId = d.mine?.id;
  return (
    <>
      <div className="panel">
        <h2>Classifica</h2>
        {d.table.length === 0 ? <p className="muted">La classifica compare quando parte il campionato.</p> : (
          <table className="table">
            <thead><tr><th>#</th><th>Squadra</th><th>G</th><th>DR</th><th>Pt</th></tr></thead>
            <tbody>
              {d.table.map((r: any, i: number) => (
                <tr key={r.id} className={r.id === myId ? "me" : ""} onClick={() => openClub(r.id)} style={{ cursor: "pointer" }}>
                  <td>{i + 1}</td>
                  <td><span className="swatch" style={{ background: r.colors[0] }} />{r.name}<div className="small muted">{r.owner} <Form form={r.form} /></div></td>
                  <td>{r.g}</td>
                  <td>{r.gf - r.gs > 0 ? "+" : ""}{r.gf - r.gs}</td>
                  <td className="pts">{r.pt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {d.league.history.length > 0 && (
        <div className="panel">
          <h2>Albo d'oro</h2>
          {[...d.league.history].reverse().map((h: any) => (
            <div key={h.season} style={{ marginBottom: 10 }}>
              <h3>Stagione {h.season}: {h.table[0]?.name}</h3>
              <p className="small muted">{h.table[0]?.owner} · {h.table[0]?.pt} punti</p>
              {h.awards.map((a: any) => <div key={a.title} className="small">{a.title}: {a.text}</div>)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CalendarTab({ d, clubsById, openMatch }: Ctx) {
  const myId = d.mine?.id;
  const byMd = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const x of d.matches) { if (!m.has(x.matchday)) m.set(x.matchday, []); m.get(x.matchday)!.push(x); }
    return [...m.entries()];
  }, [d.matches]);
  if (!byMd.length) return <div className="panel"><h2>Calendario</h2><p className="muted">Il calendario si genera all'avvio del campionato.</p></div>;
  return (
    <div className="panel">
      <h2>Calendario</h2>
      {byMd.map(([md, ms]) => (
        <div key={md} style={{ marginBottom: 14 }}>
          <div className="small muted">Giornata {md}{md === d.league.totalMatchdays / 2 ? " · fine andata" : ""}</div>
          {ms.map((m: any) => <MatchLine key={m.id} m={m} clubsById={clubsById} myId={myId} onClick={m.played ? () => openMatch(m.id) : undefined} />)}
        </div>
      ))}
    </div>
  );
}

function NewsTab({ d }: Ctx) {
  if (!d.news.length) return <div className="panel"><h2>Notizie</h2><p className="muted">Qui arrivano le cronache della sera e le notizie dalle società.</p></div>;
  return (
    <>
      {d.news.map((n: any) => (
        <div key={n.id} className="panel news">
          <div className="small muted">{n.matchday ? `Giornata ${n.matchday}` : new Date(n.created_at).toLocaleDateString("it-IT")}</div>
          <h3>{n.title}</h3>
          <div className="body">{n.body}</div>
        </div>
      ))}
    </>
  );
}

function SeasonEnd({ d }: { d: any }) {
  const h = d.league.history[d.league.history.length - 1];
  if (!h) return null;
  return (
    <div className="panel" style={{ textAlign: "center", borderColor: "#ffb31a" }}>
      <div style={{ fontSize: 48 }} aria-hidden>🏆</div>
      <h2>{h.table[0]?.name} campione</h2>
      {h.awards.map((a: any) => <p key={a.title} className="small"><strong>{a.title}:</strong> {a.text}</p>)}
      <p className="small muted">L'organizzatore può aprire la nuova stagione.</p>
    </div>
  );
}

function ClubModal({ club, onClose }: { club: any; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  if (!club) return null;
  return (
    <div className="modal" role="dialog" aria-label={club.name}>
      <div className="wrap">
        <button className="btn ghost small" onClick={onClose}>Chiudi</button>
        <div style={{ height: 10 }} />
        <ClubCard c={club} />
      </div>
    </div>
  );
}

function MatchModal({ token, id, clubsById, onClose }: { token: string; id: string; clubsById: Map<string, any>; onClose: () => void }) {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api(`me/${token}/match/${id}`).then(setM).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const h = m && clubsById.get(m.homeId), a = m && clubsById.get(m.awayId);
  return (
    <div className="modal" role="dialog" aria-label="Highlights">
      <div className="wrap">
        <button className="btn ghost small" onClick={onClose}>Chiudi</button>
        {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
        {m && h && a && (
          <>
            <div className="panel" style={{ marginTop: 10, textAlign: "center" }}>
              <div className="small muted">Giornata {m.matchday}{m.data.derby ? " · derby" : ""}</div>
              <div className="row" style={{ justifyContent: "center", gap: 14, margin: "6px 0" }}>
                <Crest name={h.name} colors={h.colors} shape={h.crest} size={44} />
                <span style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 44 }}>{m.hg} - {m.ag}</span>
                <Crest name={a.name} colors={a.colors} shape={a.crest} size={44} />
              </div>
              <div className="small">{h.name} – {a.name}</div>
              <div className="small muted">Gol attesi {String(m.data.xg[0]).replace(".", ",")} – {String(m.data.xg[1]).replace(".", ",")}</div>
            </div>
            <Replay highlights={m.data.highlights} home={h} away={a} seed={m.id} />
            <div className="panel" style={{ marginTop: 14 }}>
              <h3>Tabellino</h3>
              {m.data.events.filter((e: any) => e.type === "gol" || e.type === "rosso").map((e: any, i: number) => (
                <div key={i} className="small" style={{ textAlign: e.team === "home" ? "left" : "right" }}>{e.type === "gol" ? "⚽" : "🟥"} {e.minute}' {e.player}</div>
              ))}
              <p className="small muted" style={{ marginTop: 8 }}>Tattiche: {h.name} {m.data.choices[0].modulo} {m.data.choices[0].atteggiamento} · {a.name} {m.data.choices[1].modulo} {m.data.choices[1].atteggiamento}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
