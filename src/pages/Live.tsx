import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { Crest } from "../components/ClubBits";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import { MuteButton } from "../components/MuteButton";
import { ding, tick, unlockAudio } from "../feedback";
import { MATCH_WHEEL, type Decision, type Pending, type Moment, type PenDir } from "../../shared/live";
import { MODULI, type MatchEvent } from "../../shared/types";
import { abbr } from "../components/Replay";

type LiveData = {
  md: number; matchId: string; homeId: string; awayId: string; user: "home" | "away"; derby: boolean;
  events: MatchEvent[]; moments: Moment[]; pending: Pending | null; minute: number; score: [number, number];
  result: { homeGoals: number; awayGoals: number } | null;
};

const ICON: Record<string, string> = { gol: "⚽", parata: "🧤", palo: "🥅", fuori: "↗️", rosso: "🟥", giallo: "🟨" };
const VERB: Record<string, string> = { gol: "GOL di", parata: "Parata su tiro di", palo: "Palo di", fuori: "Fuori di poco:", rosso: "Espulso", giallo: "Ammonito" };

export function Live({ token, clubsById, onFinish, onClose }: { token: string; clubsById: Map<string, any>; onFinish: () => Promise<void>; onClose: () => void }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [clock, setClock] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const seenGoals = useRef(0);

  const send = async (decision?: Decision) => {
    setBusy(true); setErr(null);
    try { setData(await api<LiveData>(`me/${token}/live`, decision ? { body: { decision } } : {})); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  useEffect(() => { unlockAudio(); send(); }, []);

  const target = data ? (data.pending ? data.minute : 90) : 0;
  useEffect(() => {
    if (!data || clock >= target) return;
    const t = setTimeout(() => setClock((c) => Math.min(target, c + 1)), fast ? 18 : 85);
    return () => clearTimeout(t);
  }, [data, clock, target, fast]);

  const shown = useMemo(() => (data ? data.events.filter((e) => e.minute <= clock) : []), [data, clock]);
  const moments = useMemo(() => (data ? data.moments.filter((m) => m.minute <= clock) : []), [data, clock]);
  const score = useMemo(() => {
    let h = 0, a = 0;
    for (const e of shown) if (e.type === "gol") { if (e.team === "home") h++; else a++; }
    return [h, a] as [number, number];
  }, [shown]);
  useEffect(() => {
    const g = shown.filter((e) => e.type === "gol");
    if (g.length > seenGoals.current) {
      const last = g[g.length - 1];
      setFlash(last.team === data?.user ? "GOL!" : "Gol subito");
      ding(last.team === data?.user);
      const t = setTimeout(() => setFlash(null), 1400);
      seenGoals.current = g.length;
      return () => clearTimeout(t);
    }
    seenGoals.current = g.length;
  }, [shown.length]);
  useEffect(() => { if (clock > 0 && clock % 15 === 0) tick(); }, [clock]);

  if (!data) return <div className="modal live"><div className="wrap">{err ? <div className="error">{err}</div> : <p>Le squadre entrano in campo…</p>}</div></div>;
  const H = clubsById.get(data.homeId), A = clubsById.get(data.awayId);
  const atPause = clock >= target;
  const p = atPause ? data.pending : null;
  const done = atPause && !data.pending;
  const userClub = data.user === "home" ? H : A;
  const feed = [
    ...shown.map((e) => ({ m: e.minute, k: "e" as const, e })),
    ...moments.map((mo) => ({ m: mo.minute, k: "m" as const, mo })),
  ].sort((x, y) => y.m - x.m || (x.k === "m" ? -1 : 1));

  return (
    <div className="modal live" role="dialog" aria-label="Partita in diretta">
      <div className="wrap">
        <div className="live-top">
          <span className="live-dot">● DIRETTA</span>
          <span className="small muted">Giornata {data.md}{data.derby ? " · DERBY" : ""}</span>
          <span style={{ display: "flex", gap: 4 }}><MuteButton /><button className="icon-btn plain" aria-label="Chiudi, la partita resta in pausa" onClick={onClose}>✕</button></span>
        </div>
        <div className={`live-board ${flash ? "flash" : ""}`}>
          <div className="lb-team"><Crest name={H.name} colors={H.colors} shape={H.crest} size={46} /><span>{abbr(H.name)}</span></div>
          <div className="lb-mid">
            <div className="lb-score">{score[0]}<span>-</span>{score[1]}</div>
            <div className="lb-clock">{done ? "FINALE" : clock === 45 && p?.kind === "intervallo" ? "INTERVALLO" : `${clock}'`}</div>
          </div>
          <div className="lb-team"><Crest name={A.name} colors={A.colors} shape={A.crest} size={46} /><span>{abbr(A.name)}</span></div>
          {flash && <div className="lb-flash">{flash}</div>}
        </div>
        <div className="live-bar" aria-hidden>
          <i style={{ width: `${(clock / 90) * 100}%` }} />
          <b style={{ left: "50%" }} />
          {shown.filter((e) => e.type === "gol" || e.type === "rosso").map((e, i) => (
            <span key={i} className={`lbm ${e.type}`} style={{ left: `${(e.minute / 90) * 100}%`, background: e.type === "rosso" ? "#e0343f" : (e.team === "home" ? H : A).colors[0] }} />
          ))}
        </div>
        {!atPause && <button className="btn ghost small" style={{ margin: "8px auto 0", display: "block" }} onClick={() => setFast((f) => !f)}>{fast ? "Velocità normale" : "Avanti veloce ⏩"}</button>}
        {err && <div className="error">{err}</div>}

        {p && <DecisionPanel p={p} data={data} userClub={userClub} busy={busy} send={send} />}
        {done && (
          <div className="panel cta-card live-end">
            <div className="tag">Fischio finale</div>
            <div className="big">{H.name} {data.score[0]}-{data.score[1]} {A.name}</div>
            <p className="muted">{(() => { const [mine, opp] = data.user === "home" ? data.score : [data.score[1], data.score[0]]; return mine > opp ? "Vittoria! Le tue scelte hanno pagato." : mine === opp ? "Pareggio: un punto in classifica." : "Sconfitta: si riparte dalla prossima."; })()}</p>
            <button className="btn block pulse" disabled={busy} onClick={async () => { setBusy(true); await onFinish(); setBusy(false); }}>{busy ? "Si giocano le altre partite…" : "Vai alla serata"}</button>
          </div>
        )}

        <ol className="live-feed">
          {feed.map((f, i) => f.k === "m" ? (
            <li key={"m" + i} className={`moment ${f.mo.good === true ? "good" : f.mo.good === false ? "bad" : ""}`}>
              <span className="lf-min">{f.mo.minute}'</span><span><strong>{f.mo.title}</strong><span className="small muted"> · {f.mo.text}</span></span>
            </li>
          ) : (
            <li key={"e" + i} className={`ev ${f.e.type} ${f.e.team === data.user ? "mine" : ""}`}>
              <span className="lf-min">{f.e.minute}'</span>
              <span>{ICON[f.e.type]} {VERB[f.e.type]} <strong>{f.e.player}</strong>{f.e.schema === "rigore" ? " (rigore)" : ""} <span className="small muted">· {(f.e.team === "home" ? H : A).name}</span></span>
            </li>
          ))}
          {clock < 2 && <li className="small muted">Calcio d'inizio…</li>}
        </ol>
      </div>
    </div>
  );
}

function DecisionPanel({ p, data, userClub, busy, send }: { p: Pending; data: LiveData; userClub: any; busy: boolean; send: (d: Decision) => Promise<void> }) {
  const [mods, setMods] = useState(false);
  const [shooter, setShooter] = useState<string | null>(null);
  const [target, setTarget] = useState<SpinTarget | null>(null);
  useEffect(() => { setMods(false); setShooter(null); setTarget(null); }, [p.kind, p.minute]);
  const [mine, opp] = data.user === "home" ? p.score : [p.score[1], p.score[0]];
  const situation = mine > opp ? "Sei in vantaggio" : mine === opp ? "Siamo in parità" : "Sei sotto";

  if (p.kind === "intervallo") return (
    <div className="panel decision">
      <div className="tag">Intervallo · {situation} {p.score[0]}-{p.score[1]}</div>
      <h2>Cosa dici negli spogliatoi?</h2>
      {!mods ? (
        <div className="opts">
          <Opt t="Tutti all'attacco" d="Più occasioni, ma lasci spazi dietro." ic="⚔️" busy={busy} on={() => send({ kind: "intervallo", choice: "attacco" })} />
          <Opt t="Restiamo compatti" d="Meno rischi, meno occasioni." ic="🛡️" busy={busy} on={() => send({ kind: "intervallo", choice: "compatti" })} />
          <Opt t="Strigliata" d="Morale alle stelle, ma qualcuno può perdere la testa." ic="📢" busy={busy} on={() => send({ kind: "intervallo", choice: "strigliata" })} />
          <Opt t="Cambio modulo" d="Ridisegni la squadra per il secondo tempo." ic="🔄" busy={busy} on={() => setMods(true)} />
        </div>
      ) : (
        <>
          <div className="mod-grid">{MODULI.map((m) => <button key={m} className="btn ghost" disabled={busy} onClick={() => send({ kind: "intervallo", choice: `modulo:${m}` })}>{m}</button>)}</div>
          <button className="btn ghost small" onClick={() => setMods(false)}>Indietro</button>
        </>
      )}
    </div>
  );
  if (p.kind === "finale") return (
    <div className="panel decision">
      <div className="tag">75' · {situation} {p.score[0]}-{p.score[1]}</div>
      <h2>Ultimo quarto d'ora: che si fa?</h2>
      <div className="opts">
        <Opt t="Andiamo a vincerla" d="Tutti avanti: più gol, ma occhio al contropiede." ic="🔥" busy={busy} on={() => send({ kind: "finale", choice: "vincere" })} />
        <Opt t="Portiamola a casa" d="Si gestisce: si segna e si subisce meno." ic="🧊" busy={busy} on={() => send({ kind: "finale", choice: "pareggio" })} />
      </div>
    </div>
  );
  if (p.kind === "rigore") return (
    <div className="panel decision">
      <div className="tag">{p.minute}' · {p.source === "var" ? "Il VAR assegna un rigore!" : "Rigore per te!"}</div>
      <h2>{shooter ? "Dove tira?" : "Chi lo tira?"}</h2>
      {!shooter ? (
        <div className="opts">
          {p.shooters.map((s) => <Opt key={s.name} t={s.name} d={`${s.tag ? s.tag + " · " : ""}${s.ruolo} · precisione ${Math.round(s.pct * 100)}%`} ic="⚪" busy={busy} on={() => setShooter(s.name)} />)}
        </div>
      ) : (
        <>
          <div className="goal-pick" role="group" aria-label="Scegli l'angolo">
            {(["sx", "centro", "dx"] as PenDir[]).map((d) => (
              <button key={d} disabled={busy} onClick={() => send({ kind: "rigore", shooter, dir: d })}>{d === "sx" ? "Sinistra" : d === "dx" ? "Destra" : "Centrale"}</button>
            ))}
          </div>
          <p className="small muted">Il portiere si tuffa a caso. Centrale: o gol facile o figuraccia.</p>
        </>
      )}
    </div>
  );
  // ruota degli imprevisti
  return (
    <div className="panel decision special">
      <div className="tag">{p.minute}' · Imprevisto in campo!</div>
      <h2>Gira la ruota</h2>
      <div className="wheel-box small"><WheelCanvas wheel={MATCH_WHEEL} target={target} onDone={() => send({ kind: "ruota" })} hub="⚡" /></div>
      <button className="btn block pulse" disabled={!!target || busy} onClick={() => setTarget({ index: p.index, key: Date.now() })}>{target ? "Gira…" : "Gira la ruota"}</button>
    </div>
  );
}

function Opt({ t, d, ic, on, busy }: { t: string; d: string; ic: string; on: () => void; busy: boolean }) {
  return (
    <button className="opt" disabled={busy} onClick={on}>
      <span className="opt-ic" aria-hidden>{ic}</span>
      <span><strong>{t}</strong><span className="small muted" style={{ display: "block" }}>{d}</span></span>
    </button>
  );
}
