import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, store } from "../api";
import { DAILY_EVENTS } from "../../shared/league";
import type { Wheel } from "../../shared/wheels";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import { Replay } from "../components/Replay";
import { Crest, ScoreHead } from "../components/ClubBits";
import { AppBar } from "../components/AppBar";
import { MuteButton } from "../components/MuteButton";
import { ding, unlockAudio } from "../feedback";

const EVENT_WHEEL: Wheel = {
  id: "eventi", title: "Ruota degli eventi", subtitle: "Cosa succede stanotte nel campionato", emoji: "🎡", palette: "rainbow",
  segments: DAILY_EVENTS.map((e) => ({ label: e.label, weight: e.weight, icon: e.icon })),
};

type Step =
  | { kind: "intro" }
  | { kind: "mine"; match: any }
  | { kind: "others" }
  | { kind: "event"; n: number; ev: { eventIndex: number; clubId: string | null; text: string } }
  | { kind: "table" }
  | { kind: "chronicle" };

export function seenKey(leagueId: string, season: number) { return `spin:seen:${leagueId}:${season}`; }

function stepTitle(step: Step | undefined, md: number) {
  switch (step?.kind) {
    case "mine": return "La tua partita";
    case "others": return "Gli altri campi";
    case "event": return "Gli eventi della giornata";
    case "table": return "Classifica";
    case "chronicle": return "Prima pagina";
    default: return `Giornata ${md}`;
  }
}

export function Serata({ token, md, d, onClose }: { token: string; md: number; d: any; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const clubsById = useMemo(() => new Map<string, any>(d.clubs.map((c: any) => [c.id, c])), [d.clubs]);
  const myId = d.mine?.id;

  useEffect(() => { api(`me/${token}/day/${md}`).then(setData).catch((e) => setErr(e.message)); }, [md, token]);
  useEffect(() => {
    const k = seenKey(d.league.id, d.league.season);
    if (Number(store.get(k) ?? 0) < md) store.set(k, String(md));
  }, [md, d.league.id, d.league.season]);
  useEffect(() => { window.scrollTo(0, 0); }, [i]);

  const steps: Step[] = useMemo(() => {
    if (!data) return [];
    const s: Step[] = [{ kind: "intro" }];
    const mine = data.matches.find((m: any) => m.homeId === myId || m.awayId === myId);
    if (mine) s.push({ kind: "mine", match: mine });
    if (data.matches.length > (mine ? 1 : 0)) s.push({ kind: "others" });
    (data.day?.events ?? []).forEach((ev: any, n: number) => s.push({ kind: "event", n, ev }));
    s.push({ kind: "table" });
    if (data.chronicle) s.push({ kind: "chronicle" });
    return s;
  }, [data, myId]);

  const step = steps[i];
  const last = i === steps.length - 1;
  const next = () => (last ? onClose() : setI(i + 1));

  return (
    <div className="modal show" role="dialog" aria-label={`Serata della giornata ${md}`}>
      <div className="show-top" style={{ display: "block" }}>
        <AppBar title={stepTitle(step, md)} left={<span className="stage-count">{steps.length ? `${i + 1}/${steps.length}` : ""}</span>} right={<MuteButton />} onClose={onClose} progress={steps.length ? (i + 1) / steps.length : 0} />
      </div>
      <div className="show-body">
        {err && <div className="error">{err}</div>}
        {!data && !err && <p>Carico la serata…</p>}
        {step?.kind === "intro" && (
          <div className="show-center">
            <div className="kicker">{d.solo ? `Stagione ${d.league.season}` : `${fmtDate(data.date)} · ore 21:00`}</div>
            <div className="show-title">Giornata {md}</div>
            <p className="muted">{data.matches.length} partite, {data.day?.events?.length ?? 0} ruote evento, la classifica nuova e la prima pagina.</p>
          </div>
        )}
        {step?.kind === "mine" && <MineStep m={step.match} clubsById={clubsById} myId={myId} />}
        {step?.kind === "others" && <OthersStep matches={data.matches} clubsById={clubsById} myId={myId} />}
        {step?.kind === "event" && <EventStep key={step.n} n={step.n} total={data.day.events.length} ev={step.ev} order={data.day.clubOrder} clubsById={clubsById} myId={myId} onDone={() => {}} />}
        {step?.kind === "table" && <TableStep table={data.day?.table} prev={data.prevTable} clubsById={clubsById} myId={myId} fallback={d.table} />}
        {step?.kind === "chronicle" && (
          <div className="news" style={{ textAlign: "left" }}>
            <div className="kicker">La prima pagina</div>
            <h2>{data.chronicle.title}</h2>
            <div className="body">{data.chronicle.body}</div>
          </div>
        )}
      </div>
      {step && (
        <div className="show-foot">
          {i > 0 && <button className="btn ghost" onClick={() => setI(i - 1)}>Indietro</button>}
          <button className="btn grow" onClick={next}>{last ? "Fine della serata" : i === 0 ? "Inizia" : "Avanti"}</button>
        </div>
      )}
    </div>
  );
}

function scorers(m: any, side: "home" | "away") {
  return m.data.events.filter((e: any) => e.type === "gol" && e.team === side).map((e: any) => `${e.player} ${e.minute}'${e.schema === "rigore" ? " (rig.)" : ""}`).join(", ");
}

function MineStep({ m, clubsById, myId }: { m: any; clubsById: Map<string, any>; myId: string }) {
  const h = clubsById.get(m.homeId), a = clubsById.get(m.awayId);
  const meHome = m.homeId === myId;
  const my = meHome ? m.hg : m.ag, their = meHome ? m.ag : m.hg;
  const verdict = my > their ? "Vittoria" : my === their ? "Pareggio" : "Sconfitta";
  return (
    <div>
      <div className="kicker" style={{ textAlign: "center" }}>{verdict}{m.data.derby ? " · derby" : ""}</div>
      <ScoreHead h={h} a={a} hg={m.hg} ag={m.ag} />
      <Replay highlights={m.data.highlights} events={m.data.events} stats={m.data.stats} modules={[m.data.choices?.[0]?.modulo ?? "4-4-2", m.data.choices?.[1]?.modulo ?? "4-4-2"]} home={h} away={a} seed={m.id} />
    </div>
  );
}

function OthersStep({ matches, clubsById, myId }: { matches: any[]; clubsById: Map<string, any>; myId: string }) {
  const [open, setOpen] = useState<any>(null);
  const others = matches.filter((m) => m.homeId !== myId && m.awayId !== myId);
  if (open) {
    const h = clubsById.get(open.homeId), a = clubsById.get(open.awayId);
    return (
      <div>
        <button className="btn ghost small" onClick={() => setOpen(null)}>Torna ai risultati</button>
        <div className="small" style={{ textAlign: "center", margin: "10px 0" }}>{h.name} {open.hg}-{open.ag} {a.name}</div>
        <Replay highlights={open.data.highlights} events={open.data.events} stats={open.data.stats} modules={[open.data.choices?.[0]?.modulo ?? "4-4-2", open.data.choices?.[1]?.modulo ?? "4-4-2"]} home={h} away={a} seed={open.id} />
      </div>
    );
  }
  return (
    <div>
      <div className="kicker">Dagli altri campi</div>
      {others.map((m) => {
        const h = clubsById.get(m.homeId), a = clubsById.get(m.awayId);
        return (
          <button key={m.id} className="result-card" onClick={() => setOpen(m)}>
            <div className="match" style={{ borderBottom: 0, padding: 0 }}>
              <span className="h"><span className="swatch" style={{ background: h.colors[0] }} />{h.name}</span>
              <span className="score">{m.hg}-{m.ag}</span>
              <span className="a">{a.name}<span className="swatch" style={{ background: a.colors[0], marginLeft: 7, marginRight: 0 }} /></span>
            </div>
            <div className="small muted" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
              <span style={{ textAlign: "right" }}>{scorers(m, "home")}</span><span>{scorers(m, "away")}</span>
            </div>
            <div className="small" style={{ color: "var(--amber)", marginTop: 4 }}>Guarda gli highlights</div>
          </button>
        );
      })}
    </div>
  );
}

function EventStep({ n, total, ev, order, clubsById, myId }: { n: number; total: number; ev: any; order: string[]; clubsById: Map<string, any>; myId: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"ready" | "spin1" | "spun1" | "spin2" | "done">("ready");
  const [t1, setT1] = useState<SpinTarget | null>(null);
  const [t2, setT2] = useState<SpinTarget | null>(null);
  const needsClub = !!ev.clubId;
  const clubWheel: Wheel = useMemo(() => ({
    id: "club", title: "Chi colpisce?", subtitle: "La ruota sceglie il club", emoji: "🎯", palette: "teal",
    segments: order.map((id) => ({ label: clubsById.get(id)?.name ?? "?", weight: 1 })),
  }), [order, clubsById]);
  const clubIdx = Math.max(0, order.indexOf(ev.clubId));
  const evDef = DAILY_EVENTS[ev.eventIndex];
  const hitsMe = ev.clubId && ev.clubId === myId;
  const evShown = phase !== "ready" && phase !== "spin1";
  const go1 = () => { unlockAudio(); setPhase("spin1"); setT1({ index: ev.eventIndex, key: Date.now() }); };
  const go2 = () => { unlockAudio(); setPhase("spin2"); setT2({ index: clubIdx, key: Date.now() }); };
  return (
    <div className="stage-inline">
      <div className="kicker">Evento {n + 1} di {total}</div>
      <div className="pill">Ruota degli eventi</div>
      <div className="wheel-box" style={{ width: "min(76vw, 300px)", margin: "10px auto" }}>
        <WheelCanvas wheel={EVENT_WHEEL} target={t1} hub="🎡" onDone={() => { ding(); setPhase(needsClub ? "spun1" : "done"); }} />
      </div>
      {phase === "ready" && <button className="btn pulse" onClick={go1}>Gira la ruota degli eventi</button>}
      {phase === "spin1" && <button className="btn" disabled>Gira…</button>}
      {evShown && (
        <div className="event-card">
          <span className="ev-ico" aria-hidden>{evDef?.icon}</span>
          <div><strong>{evDef?.label}</strong><div className="small muted">{needsClub ? "A chi tocca? Lo decide la seconda ruota." : ev.text}</div></div>
        </div>
      )}
      {needsClub && evShown && (
        <>
          <div className="pill" style={{ marginTop: 18, fontSize: 22 }}>Chi colpisce?</div>
          <div className="wheel-box" style={{ width: "min(62vw, 240px)", margin: "10px auto" }}>
            <WheelCanvas wheel={clubWheel} target={t2} hub="🎯" onDone={() => { ding(!!hitsMe); setPhase("done"); }} />
          </div>
          {phase === "spun1" && <button className="btn pulse" onClick={go2}>Gira: chi colpisce?</button>}
          {phase === "spin2" && <button className="btn" disabled>Gira…</button>}
        </>
      )}
      {phase === "done" && needsClub && (() => {
        const cl = clubsById.get(ev.clubId);
        return (
          <div className="colpisce" style={hitsMe ? { boxShadow: "0 0 18px rgba(255,179,26,.4)" } : undefined}>
            {cl && <Crest name={cl.name} colors={cl.colors} shape={cl.crest} size={44} />}
            <div><strong>Colpisce: {cl?.name}</strong>{hitsMe ? <span style={{ color: "var(--amber)" }}> · tocca a te!</span> : null}<div className="small muted">{ev.text}</div></div>
          </div>
        );
      })()}
    </div>
  );
}

function TableStep({ table, prev, clubsById, myId, fallback }: { table: any[] | undefined; prev: any[] | null; clubsById: Map<string, any>; myId: string; fallback: any[] }) {
  const rows = table ?? fallback;
  const prevPos = new Map<string, number>((prev ?? []).map((r: any, i: number) => [r.id, i]));
  return (
    <div>
      <div className="kicker">La classifica dopo la serata</div>
      <table className="table">
        <thead><tr><th>#</th><th>Squadra</th><th>G</th><th>DR</th><th>Pt</th></tr></thead>
        <tbody>
          {rows.map((r: any, i: number) => {
            const c = clubsById.get(r.id);
            const p = prevPos.get(r.id);
            const delta = p === undefined ? 0 : p - i;
            return (
              <tr key={r.id} className={r.id === myId ? "me" : ""}>
                <td>{i + 1}<span className={`delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>{delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : ""}</span></td>
                <td><span className="swatch" style={{ background: c?.colors[0] }} />{c?.name}</td>
                <td>{r.g}</td>
                <td>{r.gf - r.gs > 0 ? "+" : ""}{r.gf - r.gs}</td>
                <td className="pts">{r.pt}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
