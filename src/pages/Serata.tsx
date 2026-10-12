import { useEffect, useMemo, useState } from "react";
import { api, fmtDate, store } from "../api";
import { DAILY_EVENTS } from "../../shared/league";
import type { Wheel } from "../../shared/wheels";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import { Replay } from "../components/Replay";
import { Crest } from "../components/ClubBits";

const EVENT_WHEEL: Wheel = {
  id: "eventi", title: "Ruota degli eventi", subtitle: "Cosa succede stanotte nel campionato", emoji: "🎡", palette: "rainbow",
  segments: DAILY_EVENTS.map((e) => ({ label: e.label, weight: e.weight })),
};

type Step =
  | { kind: "intro" }
  | { kind: "mine"; match: any }
  | { kind: "others" }
  | { kind: "event"; n: number; ev: { eventIndex: number; clubId: string | null; text: string } }
  | { kind: "table" }
  | { kind: "chronicle" };

export function seenKey(leagueId: string, season: number) { return `spin:seen:${leagueId}:${season}`; }

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
      <div className="show-top">
        <div className="dots" aria-hidden>{steps.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
        <button className="btn ghost small" onClick={onClose}>Esci</button>
      </div>
      <div className="show-body">
        {err && <div className="error">{err}</div>}
        {!data && !err && <p>Carico la serata…</p>}
        {step?.kind === "intro" && (
          <div className="show-center">
            <div className="kicker">{fmtDate(data.date)} · ore 21:00</div>
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
  return m.data.events.filter((e: any) => e.type === "gol" && e.team === side).map((e: any) => `${e.player} ${e.minute}'`).join(", ");
}

function MineStep({ m, clubsById, myId }: { m: any; clubsById: Map<string, any>; myId: string }) {
  const h = clubsById.get(m.homeId), a = clubsById.get(m.awayId);
  const meHome = m.homeId === myId;
  const my = meHome ? m.hg : m.ag, their = meHome ? m.ag : m.hg;
  const verdict = my > their ? "Vittoria" : my === their ? "Pareggio" : "Sconfitta";
  return (
    <div>
      <div className="kicker">La tua partita · {verdict}</div>
      <div className="row" style={{ justifyContent: "center", gap: 14, margin: "8px 0 4px" }}>
        <Crest name={h.name} colors={h.colors} shape={h.crest} size={48} />
        <span className="show-score">{m.hg} - {m.ag}</span>
        <Crest name={a.name} colors={a.colors} shape={a.crest} size={48} />
      </div>
      <div className="small" style={{ textAlign: "center", marginBottom: 12 }}>{h.name} – {a.name}{m.data.derby ? " · derby" : ""}</div>
      <Replay highlights={m.data.highlights} home={h} away={a} seed={m.id} />
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
        <Replay highlights={open.data.highlights} home={h} away={a} seed={open.id} />
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
  const evLabel = DAILY_EVENTS[ev.eventIndex]?.label ?? "";
  const showClubWheel = phase === "spun1" || phase === "spin2" || phase === "done";
  const wheel = showClubWheel && needsClub ? clubWheel : EVENT_WHEEL;
  const hitsMe = ev.clubId && ev.clubId === myId;

  const go = () => {
    if (phase === "ready") { setPhase("spin1"); setT1({ index: ev.eventIndex, key: Date.now() }); }
    else if (phase === "spun1") { setPhase("spin2"); setT2({ index: clubIdx, key: Date.now() }); }
  };
  return (
    <div className="stage-inline">
      <div className="kicker">Evento {n + 1} di {total}</div>
      <div className="pill">{wheel.title}</div>
      <div className="subtitle">{wheel.subtitle}</div>
      <div className="result" aria-live="polite">
        {phase === "spun1" || phase === "spin2" ? evLabel : phase === "done" ? (needsClub ? clubsById.get(ev.clubId)?.name : evLabel) : " "}
      </div>
      <div className="wheel-box" style={{ width: "min(80vw, 340px)" }}>
        {wheel === EVENT_WHEEL
          ? <WheelCanvas key="ev" wheel={EVENT_WHEEL} target={t1} onDone={() => setPhase(needsClub ? "spun1" : "done")} />
          : <WheelCanvas key="club" wheel={clubWheel} target={t2} onDone={() => setPhase("done")} />}
      </div>
      {phase === "ready" && <button className="btn" onClick={go}>Gira la ruota degli eventi</button>}
      {phase === "spun1" && <button className="btn" onClick={go}>Chi colpisce? Gira</button>}
      {(phase === "spin1" || phase === "spin2") && <button className="btn" disabled>Gira…</button>}
      {phase === "done" && <div className={`event-text ${hitsMe ? "me" : ""}`}>{hitsMe ? "Tocca a te! " : ""}{ev.text}</div>}
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
