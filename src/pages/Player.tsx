import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, store } from "../api";
import { Creation } from "./Creation";
import { Identity } from "./Identity";
import { Serata, seenKey } from "./Serata";
import { Bar, Crest, Form, Radar, ScoreHead } from "../components/ClubBits";
import { Replay } from "../components/Replay";
import { Logo } from "../components/Logo";
import { AppBar } from "../components/AppBar";
import { IcBall, IcBell, IcBoard, IcCalendar, IcChat, IcCompass, IcNews, IcRotate, IcShield, IcGear, IcStar, IcTrophy, IcWarn } from "../components/Icons";
import { MODULI, REPARTI, REPARTO_LABEL, type Reparto } from "../../shared/types";
import { marketCost, marketIncome } from "../../shared/league";

type Tab = "oggi" | "squadra" | "classifica" | "risultati" | "notizie";
const TABS: { id: Tab; label: string; ico: React.ReactNode }[] = [
  { id: "oggi", label: "Oggi", ico: <IcBall /> },
  { id: "squadra", label: "Squadra", ico: <IcShield /> },
  { id: "classifica", label: "Classifica", ico: <IcTrophy /> },
  { id: "risultati", label: "Risultati", ico: <IcCalendar /> },
  { id: "notizie", label: "Notizie", ico: <IcNews /> },
];

type Ctx = {
  d: any; token: string; reload: () => Promise<void>; clubsById: Map<string, any>;
  openClub: (id: string) => void; openMatch: (id: string) => void; openSerata: (md: number) => void;
  openTactics: () => void; openMarket: () => void; goTab: (t: Tab) => void;
};

export function Player({ token }: { token: string }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("oggi");
  const [clubModal, setClubModal] = useState<string | null>(null);
  const [matchModal, setMatchModal] = useState<string | null>(null);
  const [serata, setSerata] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"tactics" | "market" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try { setD(await api(`me/${token}`)); setErr(null); } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { store.set("spin:lastPlayer", token); load(); }, [token]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  if (!d) return <div className="wrap">{err ? <div className="error">{err}</div> : <p>Carico…</p>}</div>;
  const mine = d.mine;
  if (mine?.status === "creating") return <Creation token={token} creation={mine.creation} onFinished={load} />;
  if (mine?.status === "identity") return <Identity token={token} draft={mine.creation.draft} seed={mine.id} onDone={load} />;

  const clubsById = new Map<string, any>(d.clubs.map((c: any) => [c.id, c]));
  const unseenMd = d.league.matchdayPlayed > Number(store.get(seenKey(d.league.id, d.league.season)) ?? 0);
  const adminToken = store.get(`spin:admin:${d.league.id}`);
  const ctx: Ctx = {
    d, token, reload: load, clubsById, openClub: setClubModal, openMatch: setMatchModal, openSerata: setSerata,
    openTactics: () => setSheet("tactics"), openMarket: () => setSheet("market"), goTab: setTab,
  };

  return (
    <>
      <div className="wrap">
        <div className="head-center">
          {adminToken ? <a className="icon-btn plain" aria-label="Gestisci campionato" href={`#/admin/${adminToken}`} style={{ color: "var(--chalk)" }}><IcGear /></a> : <span />}
          <div className="brand"><Logo size={34} wordmark={false} />Spin League</div>
          <button className="icon-btn plain" aria-label="Notizie" onClick={() => setTab("notizie")}><IcBell /></button>
        </div>
        <div className="small muted" style={{ margin: "2px 0 4px" }}>{d.league.name} · stagione {d.league.season} · {d.player.name}</div>
        {err && <div className="error">{err}</div>}
        {toast && <div className="ok" role="status">{toast}</div>}
        {!mine && <div className="panel"><h2>Stagione in corso</h2><p>Questa stagione è partita senza il tuo club. Potrai crearne uno alla prossima.</p></div>}
        {tab === "oggi" && <TodayTab {...ctx} />}
        {tab === "squadra" && <ClubTab {...ctx} />}
        {tab === "classifica" && <TableTab {...ctx} />}
        {tab === "risultati" && <ResultsTab {...ctx} />}
        {tab === "notizie" && <NewsTab {...ctx} />}
      </div>
      <div className="tabbar"><nav>
        {TABS.map((t) => <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}><span className="ico" aria-hidden>{t.ico}</span>{t.label}{t.id === "oggi" && unseenMd ? <span className="live">NUOVA</span> : null}</button>)}
      </nav></div>
      {clubModal && <ClubModal club={clubsById.get(clubModal)} onClose={() => setClubModal(null)} />}
      {matchModal && <MatchModal token={token} id={matchModal} clubsById={clubsById} onClose={() => setMatchModal(null)} />}
      {serata && <Serata token={token} md={serata} d={d} onClose={() => { setSerata(null); load(); }} />}
      {sheet === "tactics" && <TacticsSheet d={d} token={token} onClose={(ok) => { setSheet(null); if (ok) { setToast("Formazione confermata per stasera."); load(); } }} />}
      {sheet === "market" && <MarketSheet d={d} token={token} reload={load} onClose={() => setSheet(null)} />}
    </>
  );
}

/* ---------------- OGGI ---------------- */


function TodayTab({ d, token, reload, clubsById, openClub, openSerata, openTactics, openMarket, openMatch }: Ctx) {
  const L = d.league, mine = d.mine;
  const myId = mine?.id;
  const seen = Number(store.get(seenKey(L.id, L.season)) ?? 0);

  if (L.status === "setup") {
    const humans = d.participants.filter((p: any) => !p.isCpu);
    const ready = humans.filter((p: any) => p.status === "ready").length;
    return (
      <>
        <div className="today-head"><div className="big">In attesa del fischio d'inizio</div></div>
        <div className="panel">
          <ul className="checklist">
            <li><span className="ck">✅</span><span>Il tuo club è pronto: {mine?.club?.name}</span></li>
            <li><span className="ck">{ready === humans.length ? "✅" : "⏳"}</span><span>Club pronti: {ready} su {humans.length}. {humans.filter((p: any) => p.status !== "ready").map((p: any) => p.owner).join(", ")}</span></li>
            <li><span className="ck">⏳</span><span>L'organizzatore avvia il campionato quando tutti sono pronti.</span></li>
          </ul>
        </div>
        <p className="small muted">Intanto guarda la tua scheda in "Squadra".</p>
      </>
    );
  }

  const next = L.nextMatchday ? d.matches.find((m: any) => m.matchday === L.nextMatchday && (m.homeId === myId || m.awayId === myId)) : null;
  const confirmed = mine?.state?.confirmedFor === L.nextMatchday;
  const unseen = L.matchdayPlayed > seen ? L.matchdayPlayed : null;
  const today = d.now?.date === L.nextMatchDate;
  const st = mine?.state;

  return (
    <>
      <div className="today-head">
        <div className="small muted">{L.status === "finished" ? "Stagione conclusa" : `Giornata ${L.nextMatchday} di ${L.totalMatchdays}`}</div>
        <div className="big">{L.status === "finished" ? "Si alza la coppa" : today ? "Stasera si gioca" : `Si gioca il ${fmtDate(L.nextMatchDate)}`}</div>
      </div>

      {unseen && (
        <div className="panel cta-card">
          <div className="serata-card">
            <div className="serata-ico" aria-hidden>🎬</div>
            <div><h3 style={{ margin: 0 }}>La serata della giornata {unseen}</h3><p className="small muted" style={{ margin: "2px 0 0" }}>Risultati, highlights ed eventi sono pronti.</p></div>
          </div>
          <button className="btn block pulse" style={{ marginTop: 12 }} onClick={() => openSerata(unseen)}>Guarda la serata</button>
        </div>
      )}

      {L.status === "finished" && <SeasonEnd d={d} />}

      {next && mine && (
        <div className={`panel ${!confirmed && !unseen ? "cta-card" : ""}`}>
          <div className="row spread">
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}><IcBall size={20} />La tua partita</h3>
            <span className={`chip ${confirmed ? "done" : "todo"}`}>{confirmed ? "Formazione pronta" : "Formazione da fare"}</span>
          </div>
          <div className="match-meta">{L.nextMatchday}ª giornata · {fmtDate(L.nextMatchDate)} · 21:00 · {next.homeId === myId ? "in casa" : "in trasferta"}</div>
          <Versus m={next} clubsById={clubsById} onOpen={openClub} />
          <div className="stack" style={{ margin: "4px 0 14px" }}>
            <div><div className="row spread small"><span>Condizione</span><span>{st.cond}</span></div><Bar value={st.cond} color={st.cond < 60 ? "#e0343f" : "#7ee08a"} /></div>
            <div><div className="row spread small"><span>Morale</span><span>{st.morale}</span></div><Bar value={st.morale} color="#8fd3ff" /></div>
          </div>
          {st.modifiers?.length > 0 && <p className="warn"><IcWarn size={16} /> {st.modifiers.map((m: any) => `${m.label} (${REPARTO_LABEL[m.rep as Reparto]} ${m.delta})`).join(" · ")}</p>}
          {st.campoSqualificato && <p className="warn"><IcWarn size={16} /> Campo squalificato: niente fattore campo nella prossima in casa</p>}
          <button className={`btn block ${confirmed ? "ghost" : unseen ? "" : "pulse"}`} onClick={openTactics}>{confirmed ? "Modifica la formazione" : "Prepara la formazione"}</button>
          {!confirmed && <p className="small muted" style={{ marginTop: 8 }}>Hai tempo fino alle 21:00. Se non scegli, giochi con le scelte dell'ultima volta.</p>}
        </div>
      )}

      {st?.pendingDecision === "fuoriclasse" && <DecisionCard d={d} token={token} reload={reload} />}

      {L.marketOpen && mine && (
        <div className="panel cta-card">
          <h2>Mercato aperto</h2>
          <p>Solo fino alla prossima giornata: rinforza un reparto o fai un'offerta per un fuoriclasse. Budget {st.budget} M€.</p>
          <button className="btn block" onClick={openMarket}>Entra nel mercato</button>
        </div>
      )}

      {L.matchdayPlayed > 0 && (
        <div className="panel">
          <h3>Rivivi le serate</h3>
          <div className="row wrap-row">
            {Array.from({ length: Math.min(L.matchdayPlayed, 6) }, (_, i) => L.matchdayPlayed - i).map((md) => (
              <button key={md} className="btn ghost small" onClick={() => openSerata(md)}>Giornata {md}</button>
            ))}
          </div>
          {(() => {
            const last = [...d.matches].filter((m: any) => m.played && (m.homeId === myId || m.awayId === myId)).pop();
            return last ? <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => openMatch(last.id)}>Highlights della mia ultima partita</button> : null;
          })()}
        </div>
      )}
    </>
  );
}

function Versus({ m, clubsById, onOpen }: { m: any; clubsById: Map<string, any>; onOpen: (id: string) => void }) {
  const h = clubsById.get(m.homeId), a = clubsById.get(m.awayId);
  const side = (c: any, id: string) => (
    <button style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => onOpen(id)} aria-label={`Scheda di ${c?.name}`}>
      <Crest name={c?.name ?? "?"} colors={c?.colors ?? ["#333", "#999"]} shape={c?.crest ?? "scudo"} size={58} />
      <div className="name">{c?.name}</div>
      <div className="small muted">voto {c?.voto} · {c?.classe}</div>
    </button>
  );
  return <div className="versus">{side(h, m.homeId)}<span className="vs">{m.played ? `${m.hg}-${m.ag}` : "VS"}</span>{side(a, m.awayId)}</div>;
}

function DecisionCard({ d, token, reload }: { d: any; token: string; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (sell: boolean) => {
    setBusy(true);
    try { await api(`me/${token}/decision`, { body: { sell } }); await reload(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="panel cta-card">
      <div className="serata-card">
        <div className="serata-ico" aria-hidden>✈️</div>
        <div><h3 style={{ margin: 0 }}>Il tuo fuoriclasse vuole andare via</h3><p className="small muted" style={{ margin: "2px 0 0" }}>{d.mine.club.fuoriclasse?.name} · vendi per 60 M€ (perdi il bonus) o tienilo (morale −10). Se non decidi entro le 21:00, resta.</p></div>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn red grow" disabled={busy} onClick={() => act(true)}>Vendi</button>
        <button className="btn ghost grow" disabled={busy} onClick={() => act(false)}>Tieni</button>
      </div>
    </div>
  );
}

/* ---------------- FORMAZIONE ---------------- */

const MOD_INFO: Record<string, string> = {
  "4-3-3": "Offensivo: Attacco +2, Difesa −2", "3-4-3": "Offensivo: Attacco +2, Difesa −2",
  "4-4-2": "Equilibrato", "4-2-3-1": "Equilibrato", "3-5-2": "Equilibrato",
  "5-3-2": "Difensivo: Difesa +2, Attacco −2", "4-5-1": "Difensivo: Difesa +2, Attacco −2",
};
const ATT_INFO = [
  { id: "equilibrato", label: "Equilibrato", info: "Nessun effetto: la scelta sicura." },
  { id: "offensivo", label: "Offensivo", info: "Segni di più, ma concedi di più." },
  { id: "difensivo", label: "Difensivo", info: "Segni meno, concedi molto meno." },
  { id: "contropiede", label: "Contropiede", info: "Concedi meno. Letale se l'avversario attacca o pressa." },
  { id: "pressing", label: "Pressing alto", info: "Più gol fatti, meno subiti, ma stanca di più." },
];
const TURN_INFO = [
  { id: "nessuno", label: "Nessuno", info: "Giocano i titolari." },
  { id: "parziale", label: "Parziale", info: "Reparti −2, recuperi 6 punti di condizione in più." },
  { id: "massiccio", label: "Massiccio", info: "Gioca la panchina, recuperi 15 punti in più." },
];
const TALK_INFO = [
  { id: "nessuno", label: "Nessuno", info: "Nessun effetto." },
  { id: "motivare", label: "Motivare", info: "+5 morale, ma −5 in più se perdi." },
  { id: "calmare", label: "Calmare", info: "Riporta il morale verso 50." },
];

type Cat = "modulo" | "atteggiamento" | "turnover" | "discorso";

function TacticsSheet({ d, token, onClose }: { d: any; token: string; onClose: (ok: boolean) => void }) {
  const st = d.mine.state, club = d.mine.club;
  const [c, setC] = useState(st.choices);
  const [open, setOpen] = useState<Cat | null>(null);
  const [seen, setSeen] = useState<Set<Cat>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pref = club.preferredModule;
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api(`me/${token}/choices`, { body: c }); onClose(true); } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const modItems = MODULI.map((m) => ({ id: m, label: m + (pref === m ? " ★" : ""), info: MOD_INFO[m] }));
  const cats: { id: Cat; ico: React.ReactNode; title: string; sub: string; items: { id: string; label: string; info: string }[]; help?: string }[] = [
    { id: "modulo", ico: <IcBoard size={34} />, title: "Modulo", sub: "Come si dispone la squadra", items: modItems, help: pref === "tutti" ? "Il tuo allenatore rende bene con qualsiasi modulo." : `Il modulo preferito (★ ${pref}) dà +2 ad Attacco, Centrocampo e Difesa.` },
    { id: "atteggiamento", ico: <IcCompass size={34} />, title: "Atteggiamento", sub: "Come affrontare la partita", items: ATT_INFO },
    { id: "turnover", ico: <IcRotate size={34} />, title: "Turnover", sub: "Gestisci le energie", items: TURN_INFO, help: st.cond < 60 ? "Squadra stanca: conviene far riposare qualcuno." : "Ogni partita costa 10 di condizione, ne recuperi 6 al giorno." },
    { id: "discorso", ico: <IcChat size={34} />, title: "Discorso", sub: "Influenza il morale", items: TALK_INFO },
  ];
  const labelOf = (cat: Cat) => cats.find((x) => x.id === cat)!.items.find((i) => i.id === c[cat])?.label ?? c[cat];
  const cur = open ? cats.find((x) => x.id === open)! : null;
  return (
    <div className="modal" role="dialog" aria-label="Prepara la formazione">
      <div className="wrap" style={{ paddingBottom: 0 }}>
        {cur
          ? <AppBar title={cur.title} onBack={() => setOpen(null)} />
          : <AppBar title="Prepara la formazione" onClose={() => onClose(false)} left={<span className="stage-count">{seen.size}/4</span>} progress={seen.size / 4} />}
        {!cur && (
          <>
            <p className="small muted" style={{ textAlign: "center" }}>Condizione {st.cond} · morale {st.morale} · {club.coachName ?? "allenatore"} ({club.coachLabel})</p>
            <div className="cat-grid">
              {cats.map((x) => (
                <button key={x.id} className={`cat ${seen.has(x.id) ? "done" : ""}`} onClick={() => { setOpen(x.id); setSeen(new Set([...seen, x.id])); }}>
                  <span className="ico-wrap" aria-hidden>{x.ico}</span>
                  <strong>{x.title}</strong>
                  <span className="small muted">{x.sub}</span>
                  <span className="val">{labelOf(x.id)}</span>
                </button>
              ))}
            </div>
            <div className="summary">
              <IcBoard size={30} />
              <div className="grow"><div className="small muted">Modulo</div><div className="big">{c.modulo}</div></div>
              {(pref === c.modulo || pref === "tutti") && <span style={{ color: "var(--amber)" }} aria-label="Modulo preferito"><IcStar size={26} /></span>}
            </div>
            {err && <div className="error" style={{ marginTop: 12 }}>{err}</div>}
            <div className="sheet-foot"><button className="btn block pulse" disabled={busy} onClick={save}>{busy ? "Salvo…" : "Conferma la formazione"}</button></div>
          </>
        )}
        {cur && (
          <div className="sheet-section">
            {cur.help && <p className="small muted">{cur.help}</p>}
            <div className="tiles">{cur.items.map((x) => (
              <button type="button" key={x.id} className="tile" aria-pressed={c[cur.id] === x.id} onClick={() => { setC({ ...c, [cur.id]: x.id }); setOpen(null); }}>
                <strong>{x.label}</strong><span>{x.info}</span>
              </button>
            ))}</div>
            <p className="small muted" style={{ marginTop: 10 }}>Tocca un'opzione per sceglierla e tornare al riepilogo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- MERCATO ---------------- */

function MarketSheet({ d, token, reload, onClose }: { d: any; token: string; reload: () => Promise<void>; onClose: () => void }) {
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
    <div className="modal" role="dialog" aria-label="Mercato">
      <div className="wrap">
        <AppBar title="Mercato" onBack={onClose} />
        <p>Budget <strong>{st.budget} M€</strong> · operazioni usate {st.marketOps} su 2 · ogni reparto può salire al massimo di 4.</p>
        {err && <div className="error">{err}</div>}
        {msg && <div className="ok">{msg}</div>}
        <div className="panel">
          <h3>Rinforza o cedi un reparto</h3>
          {REPARTI.map((r) => (
            <div key={r} className="market-row">
              <span>{REPARTO_LABEL[r]} <strong>{st.ratings[r]}</strong></span>
              <button className="btn small" onClick={() => act(() => api(`me/${token}/market`, { body: { op: "buy", rep: r } }), `${REPARTO_LABEL[r]} +2.`)}>+2 · {marketCost(st.ratings[r])} M€</button>
              <button className="btn ghost small" onClick={() => act(() => api(`me/${token}/market`, { body: { op: "sell", rep: r } }), `${REPARTO_LABEL[r]} −2.`)}>−2 · +{marketIncome(st.ratings[r])} M€</button>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Compra un fuoriclasse</h3>
          {others.length === 0 && <p className="muted small">Nessun altro club ha un fuoriclasse.</p>}
          {others.map((c: any) => (
            <div key={c.id} className="player-row">
              <span className="small grow"><strong>{c.fuoriclasse.name}</strong><br />{c.name} · +{c.fuoriclasse.bonus} {REPARTO_LABEL[c.fuoriclasse.ruolo as Reparto]}</span>
              <span className="row">
                <input type="number" min={1} style={{ width: 84 }} placeholder="M€" value={offer[c.id] ?? ""} onChange={(e) => setOffer({ ...offer, [c.id]: e.target.value })} aria-label={`Offerta per ${c.fuoriclasse.name}`} />
                <button className="btn small" onClick={() => act(() => api(`me/${token}/offers`, { body: { to: c.id, money: Number(offer[c.id]) } }), "Offerta inviata.")}>Offri</button>
              </span>
            </div>
          ))}
          <p className="small muted" style={{ marginTop: 8 }}>Le CPU accettano subito se l'offerta è abbastanza alta; gli amici rispondono dalla loro app.</p>
        </div>
        {incoming.length > 0 && (
          <div className="panel cta-card">
            <h3>Offerte per il tuo fuoriclasse</h3>
            {incoming.map((o: any) => (
              <div key={o.id} className="player-row">
                <span className="small">{d.clubs.find((c: any) => c.id === o.from_club)?.name} offre <strong>{o.money} M€</strong></span>
                <span className="row">
                  <button className="btn small" onClick={() => act(() => api(`me/${token}/offers/${o.id}`, { body: { accept: true } }), "Offerta accettata.")}>Accetta</button>
                  <button className="btn ghost small" onClick={() => act(() => api(`me/${token}/offers/${o.id}`, { body: { accept: false } }), "Offerta rifiutata.")}>Rifiuta</button>
                </span>
              </div>
            ))}
          </div>
        )}
        {outgoing.length > 0 && <p className="small muted">Le tue offerte: {outgoing.map((o: any) => `${d.clubs.find((c: any) => c.id === o.to_club)?.name} ${o.money} M€ (${o.status})`).join(" · ")}</p>}
      </div>
    </div>
  );
}

/* ---------------- SQUADRA ---------------- */

function ClubCard({ c, state }: { c: any; state?: any }) {
  const ratings = state?.ratings ?? c.ratings;
  const rows: [string, string][] = [
    ["Allenatore", c.coachName ? `${c.coachName} (${c.coachLabel})` : c.coachLabel],
    ["Modulo preferito", c.preferredModule === "tutti" ? "Tutti" : c.preferredModule],
    ["Stadio", typeof c.stadium === "string" ? c.stadium : c.stadium.label],
    ["Tifoseria", typeof c.fans === "string" ? c.fans : c.fans.label],
    ["Fuoriclasse", c.fuoriclasse ? `${c.fuoriclasse.name} ★ (${REPARTO_LABEL[c.fuoriclasse.ruolo as Reparto]} +${c.fuoriclasse.bonus})` : "Nessuno"],
    ["Sponsor", c.sponsor || "—"],
  ];
  if (state) rows.push(["Budget", `${state.budget} M€`]);
  return (
    <div className="panel">
      <div className="club-top">
        <div className="who">
          <Crest name={c.name} colors={c.colors} shape={c.crest} size={72} />
          <div className="cname">{c.name}</div>
          <div className="small muted">{c.city}</div>
          <div className="small muted">Blasone: {c.blasone}</div>
          {c.owner && <div className="small muted">Presidente: {c.owner}</div>}
        </div>
        <Radar ratings={ratings} compare={state ? c.ratings : c.initialRatings} size={190} />
      </div>
      <div className="kpis">
        <div className="kpi"><div className="lab">Voto squadra</div><div className="num">{c.voto}</div></div>
        <div className="kpi"><div className="lab">Classe</div><div className="num amber">{c.classe}</div></div>
      </div>
      <div className="rows">{rows.map(([k, v]) => <div className="r" key={k}><span>{k}</span><span>{v}</span></div>)}</div>
      {state && (
        <div className="kpis" style={{ marginTop: 12 }}>
          <div><div className="row spread small"><span>Condizione</span><span>{state.cond}%</span></div><Bar value={state.cond} color={state.cond < 60 ? "#e0343f" : "#7ee08a"} /></div>
          <div><div className="row spread small"><span>Morale</span><span>{state.morale}%</span></div><Bar value={state.morale} color="#8fd3ff" /></div>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 10 }}>Nel radar, il profilo tratteggiato mostra i valori di partenza.</p>
    </div>
  );
}

function ClubTab({ d }: Ctx) {
  const [tab, setTab] = useState<"rosa" | "stat">("rosa");
  const mine = d.mine;
  if (!mine?.club) return null;
  const myId = mine.id;
  const played = d.matches.filter((m: any) => m.played && (m.homeId === myId || m.awayId === myId));
  let v = 0, n = 0, p = 0, gf = 0, gs = 0;
  for (const m of played) {
    const f = m.homeId === myId ? m.hg : m.ag, a = m.homeId === myId ? m.ag : m.hg;
    gf += f; gs += a; if (f > a) v++; else if (f === a) n++; else p++;
  }
  const order: Record<string, number> = { POR: 0, DIF: 1, CEN: 2, ATT: 3 };
  const roster = [...mine.club.roster].sort((x: any, y: any) => order[x.ruolo] - order[y.ruolo]);
  const goalsOf = new Map<string, number>((d.myScorers ?? []).map((s: any) => [s.name, s.goals]));
  return (
    <>
      <AppBar title="Il tuo club" />
      <ClubCard c={{ ...mine.club, owner: d.player.name }} state={mine.state} />
      <div className="panel">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "rosa"} onClick={() => setTab("rosa")}>Rosa ({roster.length})</button>
          <button role="tab" aria-selected={tab === "stat"} onClick={() => setTab("stat")}>Statistiche</button>
        </div>
        {tab === "rosa" ? (
          <>
            {roster.map((pl: any, i: number) => (
              <div className="roster-row" key={pl.name}>
                <span className="muted">{i + 1}.</span>
                <span>{pl.name}{mine.club.fuoriclasse?.name === pl.name ? <span style={{ color: "var(--amber)" }}> ★</span> : null}{goalsOf.get(pl.name) ? <span className="small muted"> · {goalsOf.get(pl.name)} gol</span> : null}</span>
                <span className="small muted">{pl.ruolo}</span>
              </div>
            ))}
            <p className="small muted" style={{ marginTop: 8 }}>La forza è quella dei reparti: i nomi servono per marcatori e cronaca.</p>
          </>
        ) : (
          <>
            <div className="rows">
              <div className="r"><span>Partite giocate</span><span>{played.length}</span></div>
              <div className="r"><span>Vittorie · pareggi · sconfitte</span><span>{v} · {n} · {p}</span></div>
              <div className="r"><span>Gol fatti · subiti</span><span>{gf} · {gs}</span></div>
              <div className="r"><span>Ultime partite</span><span><Form form={mine.state.lastResults ?? []} /></span></div>
            </div>
            <h3 style={{ marginTop: 14 }}>Marcatori</h3>
            {(d.myScorers ?? []).length === 0 ? <p className="small muted">Ancora nessun gol.</p> : (d.myScorers as any[]).slice(0, 8).map((s, i) => (
              <div className="roster-row" key={s.name}><span className="muted">{i + 1}.</span><span>{s.name}</span><strong>{s.goals}</strong></div>
            ))}
          </>
        )}
      </div>
      {mine.club.notes?.length > 0 && <div className="panel"><h3>Dalla creazione</h3>{mine.club.notes.map((x: string, i: number) => <p key={i} className="small">{x}</p>)}</div>}
    </>
  );
}

/* ---------------- CLASSIFICA / RISULTATI / NOTIZIE ---------------- */

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
          <>
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
            <p className="small muted" style={{ marginTop: 8 }}>Tocca una squadra per vedere la sua scheda.</p>
          </>
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

function ResultsTab({ d, clubsById, openMatch, openSerata }: Ctx) {
  const myId = d.mine?.id;
  const byMd = useMemo(() => {
    const m = new Map<number, any[]>();
    for (const x of d.matches) { if (!m.has(x.matchday)) m.set(x.matchday, []); m.get(x.matchday)!.push(x); }
    return [...m.entries()];
  }, [d.matches]);
  if (!byMd.length) return <div className="panel"><h2>Risultati</h2><p className="muted">Il calendario si genera all'avvio del campionato.</p></div>;
  return (
    <div className="panel">
      <h2>Risultati e calendario</h2>
      <p className="small muted">Tocca una partita giocata per gli highlights.</p>
      {byMd.map(([md, ms]) => (
        <div key={md} style={{ marginBottom: 16 }}>
          <div className="row spread">
            <div className="small muted">Giornata {md}{md === d.league.totalMatchdays / 2 ? " · fine andata" : ""}</div>
            {md <= d.league.matchdayPlayed && <button className="btn ghost small" onClick={() => openSerata(md)}>Rivedi la serata</button>}
          </div>
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
        <AppBar title="Scheda club" onBack={onClose} />
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
        <AppBar title="Highlights" onBack={onClose} />
        {err && <div className="error" style={{ marginTop: 10 }}>{err}</div>}
        {m && h && a && (
          <>
            <div className="small muted" style={{ textAlign: "center" }}>Giornata {m.matchday}{m.data.derby ? " · derby" : ""} · gol attesi {String(m.data.xg[0]).replace(".", ",")} – {String(m.data.xg[1]).replace(".", ",")}</div>
            <ScoreHead h={h} a={a} hg={m.hg} ag={m.ag} />
            <Replay highlights={m.data.highlights} events={m.data.events} stats={m.data.stats} modules={[m.data.choices?.[0]?.modulo ?? "4-4-2", m.data.choices?.[1]?.modulo ?? "4-4-2"]} home={h} away={a} seed={m.id} />
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
