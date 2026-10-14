import { useMemo, useState } from "react";
import { store } from "../api";
import { AppBar } from "../components/AppBar";
import { Crest, Bar } from "../components/ClubBits";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import { MuteButton } from "../components/MuteButton";
import { Confetti } from "../components/Confetti";
import { IcRotate } from "../components/Icons";
import { ding, unlockAudio } from "../feedback";
import { cryptoRng } from "../../shared/rng";
import { CLUB_BY_ID, LEAGUES, NATION_BY_ID, TABLE_LEAGUES, type LeagueCode } from "../../shared/pro/data";
import { proWheel, ROLE_LABEL, SPEED, STAMINA, POWER } from "../../shared/pro/wheels";
import {
  acceptOffer, canRetire, careerTotals, migratePro, traitInfo, chooseMoment, clouAction, currentWheel, finishClou, finishCreation, goToOffers, marketValue, myLeague, newPro, playSegment,
  retire, SEGMENTS, spinPro, STATUS_LABEL, table, totalRounds, type ProState,
} from "../../shared/pro/career";

const KEY = "spin:pro";
const load = (): ProState | null => { try { const s = JSON.parse(store.get(KEY) ?? "null"); return s ? migratePro(s) : null; } catch { return null; } };
const save = (s: ProState | null) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* storage pieno */ } };
const club = (id: string) => CLUB_BY_ID.get(id);
const dec = (x: number) => String(x).replace(".", ",");
const money = (m: number) => (m >= 1 ? `${dec(Math.round(m * 10) / 10)} M€` : `${Math.round(m * 1000)} mila €`);
const crestOf = (id: string, size = 40) => { const c = club(id); return c ? <Crest name={c.name} colors={c.colors} shape="scudo" size={size} /> : null; };
const SEG_NAMES = ["Inizio di stagione", "Verso Natale", "Girone di ritorno", "Volata finale"];

export function Pro() {
  const [s, setS] = useState<ProState | null>(load);
  const [tab, setTab] = useState<"carriera" | "classifiche" | "palmares">("carriera");
  const [askRestart, setAskRestart] = useState(false);
  const mutate = (fn: (c: ProState) => void) => { const c: ProState = structuredClone(s!); fn(c); save(c); setS(c); return c; };

  if (!s) return (
    <div className="wrap">
      <AppBar title="Carriera giocatore" onBack={() => { location.hash = "#/"; }} />
      <div className="panel cta-card pro-intro">
        <div className="big-emoji" aria-hidden>⚽</div>
        <h2>Diventa una leggenda</h2>
        <p className="muted">Le ruote decidono chi sei: nazionalità, ruolo, fisico, talento. Parti a 17 anni dal settore giovanile e arrivi fino al ritiro, tra Premier League, LaLiga, Serie A e il resto del mondo. Un'annata alla volta: scelte nei momenti chiave e una partita decisiva in diretta.</p>
        <button className="btn block pulse" onClick={() => { const n = newPro(); save(n); setS(n); }}>Nasce un calciatore</button>
      </div>
    </div>
  );

  const restart = () => { save(null); setS(null); setAskRestart(false); setTab("carriera"); };
  const showTabs = !["creation", "name"].includes(s.phase);

  return (
    <div className="wrap pro">
      <AppBar title={s.p ? s.p.name : "Nasce un calciatore"} left={<button className="icon-btn plain" aria-label="Ricomincia la carriera" onClick={() => setAskRestart(true)}><IcRotate /></button>} right={<MuteButton />} />
      {showTabs && (
        <div className="seg" role="tablist" style={{ marginBottom: 12 }}>
          {([["carriera", "Carriera"], ["classifiche", "Classifiche"], ["palmares", "Palmarès"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      )}
      {tab === "classifiche" && showTabs ? <Tables s={s} /> : tab === "palmares" && showTabs ? <Palmares s={s} /> : (
        <>
          {s.phase === "creation" && <CreationStep s={s} mutate={mutate} />}
          {s.phase === "name" && <NameStep s={s} mutate={mutate} />}
          {s.phase === "summer" && <SummerStep s={s} mutate={mutate} />}
          {(s.phase === "season" || s.phase === "moment") && <SeasonStep s={s} mutate={mutate} />}
          {s.phase === "clou" && <ClouStep s={s} mutate={mutate} />}
          {s.phase === "end" && <EndStep s={s} mutate={mutate} />}
          {s.phase === "offers" && <OffersStep s={s} mutate={mutate} />}
          {s.phase === "retired" && <RetiredStep s={s} restart={restart} />}
        </>
      )}
      {askRestart && (
        <div className="modal confirm" role="dialog" aria-label="Ricomincia la carriera">
          <div className="wrap"><div className="panel cta-card">
            <h2>Ricominciare da zero?</h2>
            <p>La carriera di {s.p?.name ?? "questo calciatore"} viene cancellata da questo dispositivo.</p>
            <div className="stack"><button className="btn block" onClick={restart}>Sì, ricomincia</button><button className="btn ghost block" onClick={() => setAskRestart(false)}>Annulla</button></div>
          </div></div>
        </div>
      )}
    </div>
  );
}

type StepProps = { s: ProState; mutate: (fn: (c: ProState) => void) => ProState };

/* ---------- ruota generica (creazione, estate) ---------- */

function WheelStep({ s, mutate, title, onDone }: StepProps & { title?: string; onDone?: () => void }) {
  const w = currentWheel(s)!;
  const [target, setTarget] = useState<SpinTarget | null>(null);
  const [res, setRes] = useState<{ label: string; note?: string; special?: string[] } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [unlock, setUnlock] = useState<string | null>(null);
  const [pending, setPending] = useState<ProState | null>(null);
  const spin = () => {
    unlockAudio();
    const c: ProState = structuredClone(s);
    const r = spinPro(c, cryptoRng());
    setPending(c); setRes(r); setTarget({ index: r.index, key: Date.now() });
  };
  const next = () => {
    if (!pending) return;
    const sp = res?.special?.[0];
    if (sp && !unlock) { setUnlock(sp); ding(true); return; }
    mutate((c) => Object.assign(c, pending));
    setTarget(null); setRes(null); setRevealed(false); setPending(null); setUnlock(null);
    onDone?.();
  };
  const special = !!w.special;
  return (
    <div className="stage pro-stage">
      {title && <div className="tag" style={{ textAlign: "center" }}>{title}</div>}
      <div className={`question ${special ? "special" : ""}`}>
        <span className="q-badge" aria-hidden>{w.emoji}</span>
        <div><div className="q-title">{w.title}</div><div className="q-text">{w.question ?? w.subtitle}</div></div>
      </div>
      <div className={`wheel-box ${special ? "special" : ""}`}><WheelCanvas key={w.id + s.creation.done.length + s.wheels.length} wheel={w} target={target} onDone={() => { setRevealed(true); ding(special); }} hub={w.emoji} /></div>
      <div className="result" aria-live="polite">{revealed && res ? res.label : target ? "…" : " "}</div>
      <div className="note-row">{revealed && res?.note && <span className="note">{res.note}</span>}{revealed && special && <span className="ribbon special">✦ TRATTO SPECIALE</span>}</div>
      <div className="stage-actions">
        {!target && <button className="btn pulse" onClick={spin}>{special ? "Gira la ruota speciale" : "Gira la ruota"}</button>}
        {target && !revealed && <button className="btn" disabled>Gira…</button>}
        {revealed && <button className="btn" onClick={next}>Avanti</button>}
      </div>
      {unlock && (
        <div className="unlock" role="dialog" aria-label="Ruota speciale sbloccata">
          <div>
            <span className="em" aria-hidden>{proWheel(unlock, {}).emoji}</span>
            <div className="tag" style={{ color: "#d9b8ff" }}>Ruota speciale sbloccata</div>
            <div className="big">{proWheel(unlock, {}).title}</div>
            <p className="why">Il tuo fisico e il tuo talento aprono una strada speciale.</p>
            <button className="btn pulse" onClick={next}>Vai alla ruota</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreationStep({ s, mutate }: StepProps) {
  const d = s.creation.draft;
  const chips = s.creation.done;
  return (
    <>
      <div className="small muted" style={{ textAlign: "center" }}>Ruota {chips.length + 1} di {chips.length + s.creation.queue.length}</div>
      <WheelStep s={s} mutate={mutate} />
      {chips.length > 0 && (
        <div className="panel">
          <h3>Chi sei finora</h3>
          <div className="trait-chips" style={{ justifyContent: "flex-start" }}>
            {chips.map((c, i) => <span key={i} className="trait-chip">{c.label}</span>)}
          </div>
          {d.role && <p className="small muted" style={{ marginTop: 8 }}>Ruolo: {ROLE_LABEL[d.role as keyof typeof ROLE_LABEL]}{d.sub ? ` · ${d.sub}` : ""}</p>}
        </div>
      )}
    </>
  );
}

/* ---------- carta del giocatore ---------- */

function PlayerCard({ s, big }: { s: ProState; big?: boolean }) {
  const p = s.p, c = club(s.clubId)!, nat = NATION_BY_ID.get(p.nation)!;
  const attrs: [string, number, string][] = [
    ["Velocità", (p.speed / 6) * 100, SPEED[p.speed - 1]], ["Resistenza", (p.stamina / 5) * 100, STAMINA[p.stamina - 1]], ["Forza", (p.power / 5) * 100, POWER[p.power - 1]], ["Altezza", Math.min(100, (p.height - 160) * 2.6), `${(p.height / 100).toFixed(2).replace(".", ",")} m`],
  ];
  return (
    <div className={`pcard ${big ? "big" : ""}`} style={{ ["--kit" as any]: c.colors[0], ["--kit2" as any]: c.colors[1] }}>
      <div className="pc-top">
        <div className="pc-ovr"><b>{p.ovr}</b><span>{p.role}</span><span className="pc-flag">{nat.flag}</span></div>
        <div className="pc-num">{p.number}</div>
        <div className="pc-crest">{crestOf(s.clubId, big ? 48 : 36)}</div>
      </div>
      <div className="pc-name">{p.name}</div>
      {p.nickname && <div className="pc-nick">«{p.nickname}»</div>}
      <div className="pc-sub">{p.sub} · {p.spec} · piede {p.foot}</div>
      <div className="pc-meta">{c.name} · {p.age} anni · {nat.name}{p.celebration ? ` · esultanza: ${p.celebration.toLowerCase()}` : ""}</div>
      {big && (
        <div className="pc-attrs">
          {attrs.map(([k, v, l]) => <div key={k}><div className="row spread small"><span>{k}</span><span>{l}</span></div><Bar value={v} color="var(--amber)" /></div>)}
        </div>
      )}
      {big && (
        <ul className="pc-traitlist">
          {p.traits.map((t) => ({ t, i: traitInfo(t) })).filter((x) => x.i).map(({ t, i }) => <li key={t}><span aria-hidden>{i!.icon}</span> <strong>{i!.label}</strong>{i!.desc ? <span className="muted"> · {i!.desc}</span> : null}</li>)}
        </ul>
      )}
      <div className="pc-traits">
        <span className="trait-chip">{p.character}</span>
        {!big && p.traits.map((t) => ({ t, i: traitInfo(t) })).filter((x) => x.i).map(({ t, i }) => <span key={t} className="trait-chip" title={i!.desc}>{i!.icon} {i!.label}</span>)}
      </div>
    </div>
  );
}

function NameStep({ s, mutate }: StepProps) {
  const [name, setName] = useState(store.get("spin:soloName") ?? "");
  const [num, setNum] = useState(10);
  const preview = useMemo(() => { const c: ProState = structuredClone(s); finishCreation(c, name || "Il tuo nome", num); return c; }, [s, name, num]);
  return (
    <>
      <h1 style={{ marginTop: 6 }}>Nasce un calciatore</h1>
      <PlayerCard s={preview} big />
      <div className="panel">
        <label className="field"><span>Nome e cognome</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Giacomo Rossi" maxLength={28} /></label>
        <label className="field"><span>Numero di maglia</span><input type="number" min={1} max={99} value={num} onChange={(e) => setNum(Number(e.target.value))} /></label>
        <p className="small muted">Valore di mercato: {money(marketValue(preview.p))}. Firmi il primo contratto con il settore giovanile del {club(s.clubId)!.name}.</p>
        <button className="btn block pulse" disabled={name.trim().length < 3} onClick={() => mutate((c) => finishCreation(c, name, num))}>Firma il primo contratto</button>
      </div>
    </>
  );
}

/* ---------- estate ---------- */

function SummerStep({ s, mutate }: StepProps) {
  const c = club(s.clubId)!, L = LEAGUES[c.league];
  return (
    <>
      <PlayerCard s={s} />
      <div className="panel season-head">
        <div className="tag">Stagione {s.year}/{String(s.year + 1).slice(2)} · {s.p.age} anni</div>
        <div className="row" style={{ gap: 10 }}>{crestOf(s.clubId, 44)}<div><strong style={{ fontSize: 20 }}>{c.name}</strong><div className="small muted">{L.flag} {L.name} · {STATUS_LABEL[s.status]}{s.loanFrom ? ` · in prestito dal ${club(s.loanFrom)!.name}` : ""}</div></div></div>
      </div>
      {s.wheels.length ? <WheelStep s={s} mutate={mutate} title="Estate" /> : (
        <div className="panel cta-card">
          <h2>Si parte</h2>
          {s.goal && <p>Obiettivo personale: <strong>{s.goal.label}</strong></p>}
          <p className="small muted">{totalRounds(s)} giornate in {L.name}. La stagione è divisa in {SEGMENTS} tappe, con un momento chiave in ognuna e una partita decisiva in diretta.</p>
          <button className="btn block pulse" onClick={() => mutate((x) => { x.phase = "season"; })}>Inizia la stagione</button>
        </div>
      )}
    </>
  );
}

/* ---------- stagione ---------- */

function StatGrid({ s }: { s: ProState }) {
  const st = s.stats, avg = st.rN ? Math.round((st.rSum / st.rN) * 10) / 10 : 0;
  if (s.status === "giovanili" && (st.yApps ?? 0) >= st.apps) return (
    <div className="stat-grid">
      <div><b>{st.yApps ?? 0}</b><span>Presenze Primavera</span></div><div><b>{st.yGoals ?? 0}</b><span>Gol Primavera</span></div>
      <div><b>{st.yAssists ?? 0}</b><span>Assist Primavera</span></div><div><b>{st.apps}</b><span>In prima squadra</span></div>
    </div>
  );
  const items: [string, string | number][] = s.p.role === "POR"
    ? [["Presenze", st.apps], ["Porte inviolate", st.cs], ["Voto medio", avg ? dec(avg) : "—"], ["Gialli", st.yellow]]
    : [["Presenze", st.apps], ["Gol", st.goals], ["Assist", st.assists], ["Voto medio", avg ? dec(avg) : "—"]];
  return <div className="stat-grid">{items.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>;
}

function SeasonStep({ s, mutate }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const c = club(s.clubId)!, L = LEAGUES[c.league];
  const rows = table(s);
  const pos = rows.findIndex((r) => r.id === s.clubId) + 1;
  const mine = s.fixtures.filter((f) => f.hg != null && (f.home === s.clubId || f.away === s.clubId));
  const last = mine.slice(-5).reverse();
  const play = () => { setBusy(true); setResult(null); setTimeout(() => { mutate((x) => playSegment(x, cryptoRng())); setBusy(false); window.scrollTo(0, 0); }, 250); };
  return (
    <>
      <div className="panel season-head">
        <div className="row spread">
          <div className="row" style={{ gap: 10 }}>{crestOf(s.clubId, 40)}<div><strong>{c.name}</strong><div className="small muted">{L.flag} {L.name} · {pos}° posto</div></div></div>
          <div className="pc-mini"><b>{s.p.ovr}</b><span>{STATUS_LABEL[s.status]}</span></div>
        </div>
        <div className="seg-steps">{SEG_NAMES.map((n, i) => <div key={n} className={i < s.segment ? "done" : i === s.segment ? "now" : ""}><i />{n}</div>)}</div>
        <StatGrid s={s} />
        <div className="row spread small" style={{ marginTop: 8 }}><span>Rapporto col mister</span><span>{s.rel}</span></div><Bar value={s.rel} color="#8fd3ff" />
        <div className="row spread small" style={{ marginTop: 6 }}><span>Morale</span><span>{s.morale}</span></div><Bar value={s.morale} color="#7ee08a" />
        {s.goal && <p className="small muted" style={{ marginTop: 8 }}>Obiettivo: {s.goal.label}</p>}
        {s.injury > 0 && <p className="warn small">Infortunato: ancora {s.injury} {s.injury === 1 ? "partita" : "partite"} di stop.</p>}
      </div>
      {result && <div className="panel moment-res">{result}</div>}
      {s.phase === "moment" && s.moment ? (
        <div className="panel decision">
          <div className="tag">{SEG_NAMES[s.segment] ?? "Momento chiave"}</div>
          <h2><span aria-hidden>{s.moment.icon}</span> {s.moment.title}</h2>
          <p>{s.moment.text}</p>
          <div className="opts">
            {s.moment.options.map((o, i) => (
              <button key={i} className="opt" onClick={() => { let r = ""; mutate((x) => { r = chooseMoment(x, i, cryptoRng()); }); setResult(r); }}>
                <span className="opt-ic" aria-hidden>{["①", "②", "③"][i]}</span><span><strong>{o.label}</strong><span className="small muted" style={{ display: "block" }}>{o.desc}</span></span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button className="btn block pulse" disabled={busy} onClick={play}>{busy ? "Si gioca…" : s.segment === 0 ? "Fischio d'inizio" : `Gioca: ${SEG_NAMES[s.segment] ?? "fine stagione"}`}</button>
      )}
      {last.length > 0 && (
        <div className="panel">
          <h3>Ultime partite</h3>
          {last.map((f, i) => {
            const home = f.home === s.clubId, opp = home ? f.away : f.home;
            const gf = home ? f.hg! : f.ag!, ga = home ? f.ag! : f.hg!;
            return (
              <div key={i} className="roster-row">
                <span className={`res-dot ${gf > ga ? "V" : gf === ga ? "N" : "P"}`}>{gf > ga ? "V" : gf === ga ? "N" : "P"}</span>
                <span>{home ? "vs" : "@"} {club(opp)?.name ?? "Avversaria"} <strong>{gf}-{ga}</strong></span>
                <span className="small muted">{f.me ? `${f.me.min}' · ${f.me.g ? `⚽${f.me.g} ` : ""}${f.me.a ? `🅰️${f.me.a} ` : ""}voto ${dec(f.me.r)}` : "non convocato"}</span>
              </div>
            );
          })}
        </div>
      )}
      <MiniTable s={s} />
    </>
  );
}

function MiniTable({ s, league }: { s: ProState; league?: LeagueCode }) {
  const lg = league ?? myLeague(s);
  const rows = lg === myLeague(s) ? table(s) : s.lastTables[lg] ?? [];
  const L = LEAGUES[lg];
  if (!rows.length) return null;
  return (
    <div className="panel">
      <h3>{L.flag} {L.name}</h3>
      <table className="table">
        <thead><tr><th>#</th><th>Squadra</th><th>G</th><th>DR</th><th>Pt</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.id} className={r.id === s.clubId ? "me" : ""}><td>{i + 1}</td><td>{club(r.id)?.name ?? r.name}</td><td>{r.g}</td><td>{r.gf - r.gs > 0 ? "+" : ""}{r.gf - r.gs}</td><td className="pts">{r.pt}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Tables({ s }: { s: ProState }) {
  const mine = myLeague(s);
  const [lg, setLg] = useState<LeagueCode>(mine);
  const leagues = [mine, ...TABLE_LEAGUES.filter((l) => l !== mine)];
  return (
    <>
      <div className="chips-row">{leagues.map((l) => <button key={l} className={`chip-btn ${lg === l ? "on" : ""}`} onClick={() => setLg(l)}>{LEAGUES[l].flag} {LEAGUES[l].name}</button>)}</div>
      {lg !== mine && !s.lastTables[lg] ? <p className="muted small">Le classifiche degli altri campionati compaiono a fine stagione.</p> : <MiniTable s={s} league={lg} />}
      {lg !== mine && <p className="small muted">Classifica finale della scorsa stagione.</p>}
    </>
  );
}

/* ---------- momento clou ---------- */

function ClouStep({ s, mutate }: StepProps) {
  const c = s.clou!;
  const [last, setLast] = useState<{ good: boolean; text: string } | null>(null);
  const done = c.step >= c.actions.length;
  const act = c.actions[c.step];
  const us = c.base[0] + c.score[0], them = c.base[1] + c.score[1];
  // durante la partita mostriamo solo i gol "di squadra" già avvenuti fino al minuto corrente
  const minute = done ? 90 : act.minute;
  const shownBase: [number, number] = done ? c.base : [Math.round(c.base[0] * minute / 90), Math.round(c.base[1] * minute / 90)];
  const scoreUs = shownBase[0] + c.score[0], scoreThem = shownBase[1] + c.score[1];
  const homeName = c.home ? club(s.clubId)!.name : club(c.opp)?.name, awayName = c.home ? club(c.opp)?.name : club(s.clubId)!.name;
  return (
    <div className="modal live" role="dialog" aria-label="Momento clou">
      <div className="wrap">
        <div className="live-top"><span className="live-dot">● MOMENTO CLOU</span><span className="small muted">{c.title}</span><MuteButton /></div>
        <div className={`live-board ${last?.good ? "flash" : ""}`}>
          <div className="lb-team">{crestOf(c.home ? s.clubId : c.opp, 46)}<span>{homeName?.slice(0, 12)}</span></div>
          <div className="lb-mid"><div className="lb-score">{c.home ? scoreUs : scoreThem}<span>-</span>{c.home ? scoreThem : scoreUs}</div><div className="lb-clock">{done ? "FINALE" : `${minute}'`}</div></div>
          <div className="lb-team">{crestOf(c.home ? c.opp : s.clubId, 46)}<span>{awayName?.slice(0, 12)}</span></div>
        </div>
        {last && <div className={`panel moment-res ${last.good ? "good" : "bad"}`}>{last.text}</div>}
        {!done ? (
          <div className="panel decision">
            <div className="tag">{act.minute}' · Tocca a te, {s.p.name.split(" ")[0]}</div>
            <h2>{act.sit}</h2>
            <div className="opts">
              {act.choices.map((ch) => (
                <button key={ch.id} className="opt" onClick={() => { let r: any; mutate((x) => { r = clouAction(x, ch.id, cryptoRng()); }); setLast(r); if (r.good) ding(true); }}>
                  <span className="opt-ic" aria-hidden>🎯</span><span><strong>{ch.label}</strong><span className="small muted" style={{ display: "block" }}>Riuscita {Math.round(ch.pct * 100)}%</span></span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="panel cta-card live-end">
            <div className="tag">Fischio finale</div>
            <div className="big">{homeName} {c.home ? us : them}-{c.home ? them : us} {awayName}</div>
            <p className="muted">{us > them ? "Vittoria nella partita che contava!" : us === them ? "Pareggio sofferto." : "Sconfitta amara."} I tuoi numeri: {c.mine.g} gol, {c.mine.a} assist{s.p.role === "DIF" || s.p.role === "POR" ? `, ${c.mine.saves} interventi decisivi` : ""}.</p>
            <button className="btn block pulse" onClick={() => mutate((x) => finishClou(x, cryptoRng()))}>Torna alla stagione</button>
          </div>
        )}
        <ol className="live-feed">
          {c.actions.filter((a) => a.result).map((a, i) => <li key={i} className={`moment ${a.good ? "good" : "bad"}`}><span className="lf-min">{a.minute}'</span><span><strong>{a.sit}</strong><span className="small muted"> · {a.result}</span></span></li>)}
        </ol>
      </div>
    </div>
  );
}

/* ---------- fine stagione, mercato, ritiro ---------- */

function EndStep({ s, mutate }: StepProps) {
  const r = s.report;
  const party = r.trophies.length > 0;
  const delta = r.ovrAfter - r.ovrBefore;
  return (
    <>
      <div className={`panel season-sum ${party ? "good" : ""}`}>
        {party && <Confetti />}
        <div className="tag">Fine stagione {r.year}/{String(r.year + 1).slice(2)} · {r.age} anni</div>
        <div className="big">{r.trophies.length ? r.trophies.join(" · ") : `${r.pos}° in ${r.league}`}</div>
        <StatGrid s={{ ...s, stats: r.stats, status: s.history[s.history.length - 1]?.status ?? s.status } as ProState} />
        <div className="rows" style={{ marginTop: 10 }}>
          <div className="r"><span>Classifica</span><span>{r.pos}° su {r.n}</span></div>
          {r.clRound && <div className="r"><span>Champions League</span><span>{r.clRound}</span></div>}
          <div className="r"><span>Obiettivo «{r.goal ?? "—"}»</span><span>{r.goalOk ? "✓ centrato" : "✗ mancato"}</span></div>
          <div className="r"><span>Valutazione</span><span><strong>{r.ovrBefore} → {r.ovrAfter}</strong> ({delta >= 0 ? "+" : ""}{delta})</span></div>
          <div className="r"><span>Pallone d'Oro</span><span>{r.ballonRank <= 30 ? `${r.ballonRank}° posto` : "fuori dai 30"}</span></div>
          <div className="r"><span>Capocannoniere del campionato</span><span>{r.topRival} gol</span></div>
        </div>
        {r.natLine && <p className="small" style={{ marginTop: 8 }}>{r.natLine}</p>}
        {r.notes?.map((n: string, i: number) => <p key={i} className="small muted">{n}</p>)}
      </div>
      <button className="btn block pulse" onClick={() => mutate((x) => goToOffers(x, cryptoRng()))}>Verso il mercato estivo</button>
    </>
  );
}

function OffersStep({ s, mutate }: StepProps) {
  return (
    <>
      <PlayerCard s={s} />
      <div className="panel">
        <h2>Mercato estivo</h2>
        <p className="small muted">Valore di mercato: <strong>{money(marketValue(s.p))}</strong> · {s.p.age} anni. Scegli dove giocare la prossima stagione.</p>
      </div>
      {s.offers.map((o, i) => {
        const c = club(o.clubId)!, L = LEAGUES[c.league];
        return (
          <div key={i} className={`panel offer ${o.stay ? "stay" : ""}`}>
            <div className="row" style={{ gap: 12 }}>
              {crestOf(o.clubId, 48)}
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 19 }}>{c.name}</strong>
                <div className="small muted">{L.flag} {L.name} · {"★".repeat(L.stars)}</div>
                {o.note && <div className="small" style={{ color: "var(--amber)" }}>{o.note}</div>}
              </div>
            </div>
            <div className="offer-grid">
              <div><span>Ruolo</span><b className={`st-${o.status}`}>{STATUS_LABEL[o.status]}</b></div>
              <div><span>Contratto</span><b>{o.years} {o.years === 1 ? "anno" : "anni"}{o.loan ? " (prestito)" : ""}</b></div>
              <div><span>Ingaggio</span><b>{money(o.salary)}/anno</b></div>
            </div>
            <button className={`btn block ${o.stay ? "ghost" : ""}`} onClick={() => mutate((x) => acceptOffer(x, i))}>{o.stay ? "Resto qui" : "Accetto"}</button>
          </div>
        );
      })}
      {canRetire(s) && <button className="btn ghost block" onClick={() => mutate((x) => retire(x, `scelta personale a ${x.p.age} anni.`))}>Appendo gli scarpini al chiodo</button>}
    </>
  );
}

function RetiredStep({ s, restart }: { s: ProState; restart: () => void }) {
  const t = careerTotals(s);
  return (
    <>
      <div className="panel season-sum good legend">
        <Confetti />
        <div className="tag">Fine carriera · {s.report?.retired}</div>
        <div className="big">{t.verdict}</div>
        <p>{s.p.name}, {NATION_BY_ID.get(s.p.nation)!.flag} {ROLE_LABEL[s.p.role].toLowerCase()} ({s.p.sub}). Punteggio leggenda: <strong>{t.legend}</strong>.</p>
        <div className="stat-grid">
          <div><b>{t.apps}</b><span>Presenze</span></div><div><b>{s.p.role === "POR" ? t.cs : t.goals}</b><span>{s.p.role === "POR" ? "Porte inviolate" : "Gol"}</span></div>
          <div><b>{t.assists}</b><span>Assist</span></div><div><b>{t.peak}</b><span>Valutazione max</span></div>
        </div>
      </div>
      <Palmares s={s} />
      <button className="btn block pulse" onClick={restart}>Nuova carriera</button>
    </>
  );
}

function Palmares({ s }: { s: ProState }) {
  const tr = s.trophies;
  const t = careerTotals(s);
  return (
    <>
      <div className="panel">
        <h2>Palmarès</h2>
        <div className="stat-grid">
          <div><b>{tr.league}</b><span>Campionati</span></div><div><b>{tr.cl}</b><span>Champions</span></div>
          <div><b>{tr.ballon}</b><span>Palloni d'Oro</span></div><div><b>{tr.topScorer}</b><span>Capocannoniere</span></div>
          <div><b>{tr.caps}</b><span>Presenze in nazionale</span></div><div><b>{tr.intlGoals}</b><span>Gol in nazionale</span></div>
        </div>
        {tr.cups.length > 0 && <p style={{ marginTop: 8 }}>🏆 {tr.cups.join(" · ")}</p>}
        {tr.intl.length > 0 && <p className="small muted">{tr.intl.join(" · ")}</p>}
        {s.history.length > 0 && <p className="small muted">Totale: {t.apps} presenze, {t.goals} gol, {t.assists} assist, voto medio {dec(t.avg)}.</p>}
      </div>
      {s.history.length > 0 && (
        <div className="panel">
          <h3>Stagione per stagione</h3>
          <div className="career-rows">
            {[...s.history].reverse().map((h) => (
              <div key={h.year} className="career-row">
                <span className="cr-year">{String(h.year).slice(2)}/{String(h.year + 1).slice(2)}<small>{h.age}a</small></span>
                <span className="cr-club">{crestOf(h.clubId, 26)}<span><strong>{club(h.clubId)?.name}</strong>{h.loan ? " (prestito)" : ""}<small>{LEAGUES[h.league].name} · {h.pos}° · {STATUS_LABEL[h.status]}</small></span></span>
                <span className="cr-stats">{h.status === "giovanili" ? `Primavera ${h.stats.yApps ?? 0}p ${h.stats.yGoals ?? 0}g · ` : ""}{h.stats.apps}p · {s.p.role === "POR" ? `${h.stats.cs} cs` : `${h.stats.goals}g ${h.stats.assists}a`} · {h.avg ? dec(h.avg) : "—"}<small>ovr {h.ovr}{h.trophies.length ? ` · ${h.trophies.join(", ")}` : ""}</small></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
