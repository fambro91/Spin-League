import { useState } from "react";
import { api } from "../api";
import { AppBar } from "../components/AppBar";
import { Crest } from "../components/ClubBits";
import { DILEMMA_BY_ID, INVESTMENTS, PRESS_TONES, TRAININGS } from "../../shared/manager";
import { REPARTI, REPARTO_LABEL, type Reparto } from "../../shared/types";

type Sheet = "dilemmi" | "stampa" | "pronostici" | "sfida";

/** Card "Agenda di oggi" nella scheda Oggi. */
export function AgendaCard({ d, onOpen, openTactics }: { d: any; onOpen: (s: Sheet) => void; openTactics: () => void }) {
  const st = d.mine?.state, ag = d.agenda;
  if (!st || !ag) return null;
  const md = ag.md;
  const formazione = st.confirmedFor === md;
  const dil = st.dilemmas?.md === md ? st.dilemmas.cards : [];
  const dilDone = dil.filter((x: any) => x.choice !== null).length;
  const press = st.press?.md === md;
  const others = d.matches.filter((m: any) => m.matchday === md && m.homeId !== d.mine.id && m.awayId !== d.mine.id);
  const preds = st.predictions?.md === md ? Object.keys(st.predictions.picks).length : 0;
  const ch = ag.challenge;
  const incoming = ch && ch.status === "proposta" && ch.to_club === d.mine.id;
  const items = [
    { k: "f", label: "Formazione", done: formazione, info: formazione ? "Pronta" : "Da fare", go: openTactics },
    { k: "d", label: "Decisioni del giorno", done: dil.length > 0 && dilDone === dil.length, info: `${dilDone}/${dil.length}`, go: () => onOpen("dilemmi") },
    { k: "s", label: "Conferenza stampa", done: press, info: press ? "Fatta" : "Facoltativa", go: () => onOpen("stampa") },
    ...(others.length ? [{ k: "p", label: "Pronostici", done: preds === others.length, info: `${preds}/${others.length}`, go: () => onOpen("pronostici") }] : []),
    ...(ag.oppHuman ? [{ k: "c", label: incoming ? "Sei stato sfidato!" : "Sfida l'avversario", done: !!ch && ch.status !== "proposta" || (!!ch && !incoming), info: ch ? (ch.status === "accettata" ? `${ch.stake} M€ in palio` : ch.status === "proposta" ? (incoming ? "Rispondi" : "In attesa") : ch.status) : "Facoltativa", go: () => onOpen("sfida") }] : []),
  ];
  const done = items.filter((i) => i.done).length;
  return (
    <div className={`panel ${done < items.length ? "cta-card" : ""}`}>
      <div className="row spread">
        <h3 style={{ margin: 0 }}>Agenda di oggi</h3>
        <span className={`chip ${done === items.length ? "done" : "todo"}`}>{done}/{items.length}</span>
      </div>
      <p className="small muted" style={{ margin: "2px 0 8px" }}>Tutto entro le 21:00.</p>
      <div className="agenda">
        {items.map((i) => (
          <button key={i.k} className={`agenda-item ${i.done ? "done" : ""} ${i.k === "c" && incoming ? "alert" : ""}`} onClick={i.go}>
            <span className="ag-check" aria-hidden>{i.done ? "✓" : ""}</span>
            <span className="grow">{i.label}</span>
            <span className="small muted">{i.info}</span>
            <span aria-hidden className="muted">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function useAct(reload: () => Promise<void>) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setErr(null);
    try { const r = await fn(); await reload(); return r; } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return { err, busy, act };
}

export function DilemmaSheet({ d, token, reload, onClose }: { d: any; token: string; reload: () => Promise<void>; onClose: () => void }) {
  const st = d.mine.state, md = d.agenda.md;
  const cards = st.dilemmas?.md === md ? st.dilemmas.cards : [];
  const { err, busy, act } = useAct(reload);
  return (
    <div className="modal" role="dialog" aria-label="Decisioni del giorno">
      <div className="wrap">
        <AppBar title="Decisioni del giorno" onBack={onClose} />
        <p className="small muted" style={{ textAlign: "center" }}>Budget {st.budget} M€ · condizione {st.cond} · morale {st.morale}. Se non scegli entro le 21:00, vale l'opzione prudente.</p>
        {err && <div className="error">{err}</div>}
        {cards.map((pick: any) => {
          const def = DILEMMA_BY_ID.get(pick.id);
          if (!def) return null;
          return (
            <div key={pick.id} className="panel dilemma">
              <div className="serata-card">
                <div className="serata-ico" aria-hidden>{def.icon}</div>
                <div><h3 style={{ margin: 0 }}>{def.title}</h3><p className="small muted" style={{ margin: "2px 0 0" }}>{def.text}</p></div>
              </div>
              {pick.choice === null ? (
                <div className="tiles" style={{ marginTop: 12 }}>
                  {def.options.map((o, i) => (
                    <button key={i} className="tile" disabled={busy || (o.cost !== undefined && st.budget < o.cost)} onClick={() => act(() => api(`me/${token}/dilemma`, { body: { id: pick.id, option: i } }))}>
                      <strong>{o.label}{i === def.def ? <span className="small muted"> · prudente</span> : null}</strong><span>{o.desc}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="event-text" style={{ marginTop: 12, maxWidth: "none" }}>
                  <span className="small muted">Hai scelto: {def.options[pick.choice]?.label}</span><br />{pick.result}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PressSheet({ d, token, reload, onClose }: { d: any; token: string; reload: () => Promise<void>; onClose: () => void }) {
  const st = d.mine.state, md = d.agenda.md;
  const done = st.press?.md === md ? st.press : null;
  const [tone, setTone] = useState<string>("provocatoria");
  const [text, setText] = useState("");
  const { err, busy, act } = useAct(reload);
  const opp = d.clubs.find((c: any) => c.id === d.agenda.oppId);
  return (
    <div className="modal" role="dialog" aria-label="Conferenza stampa">
      <div className="wrap">
        <AppBar title="Conferenza stampa" onBack={onClose} />
        {opp && (
          <div className="serata-card" style={{ margin: "6px 0 14px" }}>
            <Crest name={opp.name} colors={opp.colors} shape={opp.crest} size={52} />
            <div><div className="small muted">Prossimo avversario</div><strong>{opp.name}</strong><div className="small muted">presidente {opp.owner}</div></div>
          </div>
        )}
        {done ? (
          <div className="panel">
            <h3>Hai già parlato</h3>
            <p>Tono: <strong>{PRESS_TONES.find((t) => t.id === done.tone)?.label}</strong></p>
            {done.text && <p className="event-text" style={{ maxWidth: "none" }}>«{done.text}»</p>}
            <p className="small muted">L'effetto arriva alle 21:00, in base al risultato.</p>
          </div>
        ) : (
          <>
            {err && <div className="error">{err}</div>}
            <div className="tiles">
              {PRESS_TONES.map((t) => <button key={t.id} className="tile" aria-pressed={tone === t.id} onClick={() => setTone(t.id)}><strong>{t.label}</strong><span>{t.desc}</span></button>)}
            </div>
            {tone !== "silenzio" && (
              <label className="field" style={{ marginTop: 14 }}><span>{tone === "provocatoria" ? "La tua frase (arriva subito nel gruppo Telegram)" : "La tua frase (facoltativa)"}</span>
                <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={3} placeholder={tone === "provocatoria" ? "Domani sera vi rimandiamo in Serie B…" : "Rispetto per l'avversario, pensiamo a lavorare."} />
                <span className="small muted" style={{ textAlign: "right" }}>{text.length}/120</span>
              </label>
            )}
            <button className="btn block" style={{ marginTop: 10 }} disabled={busy || (tone === "provocatoria" && text.trim().length < 3)} onClick={async () => { const r = await act(() => api(`me/${token}/press`, { body: { tone, text } })); if (r) onClose(); }}>
              {tone === "silenzio" ? "Silenzio stampa" : "Parla ai giornalisti"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PredictionsSheet({ d, token, reload, onClose }: { d: any; token: string; reload: () => Promise<void>; onClose: () => void }) {
  const st = d.mine.state, md = d.agenda.md;
  const others = d.matches.filter((m: any) => m.matchday === md && m.homeId !== d.mine.id && m.awayId !== d.mine.id);
  const prev = st.predictions?.md === md ? st.predictions : null;
  const [picks, setPicks] = useState<Record<string, string>>(prev?.picks ?? {});
  const [exactId, setExactId] = useState<string>(prev?.exact?.matchId ?? others[0]?.id ?? "");
  const [eh, setEh] = useState<number>(prev?.exact?.h ?? 1);
  const [ea, setEa] = useState<number>(prev?.exact?.a ?? 1);
  const { err, busy, act } = useAct(reload);
  const byId = new Map<string, any>(d.clubs.map((c: any) => [c.id, c]));
  const ranking = d.clubs.filter((c: any) => !c.isCpu).sort((a: any, b: any) => (b.predPoints ?? 0) - (a.predPoints ?? 0));
  return (
    <div className="modal" role="dialog" aria-label="Pronostici">
      <div className="wrap">
        <AppBar title="Pronostici" onBack={onClose} />
        <p className="small muted" style={{ textAlign: "center" }}>1 punto per ogni segno giusto, 3 per il risultato esatto. Ogni punto vale anche 1 M€.</p>
        {err && <div className="error">{err}</div>}
        <div className="panel">
          {others.map((m: any) => {
            const h = byId.get(m.homeId), a = byId.get(m.awayId);
            return (
              <div key={m.id} className="pred-row">
                <div className="small"><strong>{h?.name}</strong> – <strong>{a?.name}</strong></div>
                <div className="seg">
                  {(["1", "X", "2"] as const).map((v) => <button key={v} type="button" aria-pressed={picks[m.id] === v} onClick={() => setPicks({ ...picks, [m.id]: v })}>{v}</button>)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="panel">
          <h3>Risultato esatto (+3)</h3>
          <select value={exactId} onChange={(e) => setExactId(e.target.value)}>
            {others.map((m: any) => <option key={m.id} value={m.id}>{byId.get(m.homeId)?.name} – {byId.get(m.awayId)?.name}</option>)}
          </select>
          <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
            <input type="number" min={0} max={9} value={eh} onChange={(e) => setEh(Number(e.target.value))} style={{ width: 70, textAlign: "center" }} aria-label="Gol casa" />
            <strong>–</strong>
            <input type="number" min={0} max={9} value={ea} onChange={(e) => setEa(Number(e.target.value))} style={{ width: 70, textAlign: "center" }} aria-label="Gol ospiti" />
          </div>
        </div>
        <button className="btn block" disabled={busy} onClick={async () => { const r = await act(() => api(`me/${token}/predictions`, { body: { picks, exact: exactId ? { matchId: exactId, h: eh, a: ea } : undefined } })); if (r) onClose(); }}>Salva i pronostici</button>
        <div className="panel" style={{ marginTop: 14 }}>
          <h3>Classifica pronostici</h3>
          {ranking.map((c: any, i: number) => <div key={c.id} className="roster-row"><span className="muted">{i + 1}.</span><span>{c.owner}</span><strong>{c.predPoints ?? 0}</strong></div>)}
        </div>
      </div>
    </div>
  );
}

export function ChallengeSheet({ d, token, reload, onClose }: { d: any; token: string; reload: () => Promise<void>; onClose: () => void }) {
  const ag = d.agenda, st = d.mine.state, ch = ag.challenge;
  const [stake, setStake] = useState(20);
  const { err, busy, act } = useAct(reload);
  const opp = d.clubs.find((c: any) => c.id === ag.oppId);
  const incoming = ch && ch.status === "proposta" && ch.to_club === d.mine.id;
  return (
    <div className="modal" role="dialog" aria-label="Sfida">
      <div className="wrap">
        <AppBar title="Sfida diretta" onBack={onClose} />
        {opp && (
          <div className="score-head">
            <div><Crest name={d.mine.club.name} colors={d.mine.club.colors} shape={d.mine.club.crest} size={54} /><div className="nm">{d.mine.club.name}</div><div className="vt">{d.player.name}</div></div>
            <div className="sc" style={{ fontSize: 34 }}>VS</div>
            <div><Crest name={opp.name} colors={opp.colors} shape={opp.crest} size={54} /><div className="nm">{opp.name}</div><div className="vt">{opp.owner}</div></div>
          </div>
        )}
        {err && <div className="error">{err}</div>}
        {!ch || ["rifiutata", "ritirata", "annullata"].includes(ch.status) ? (
          <div className="panel">
            {ch && <p className="small muted">La sfida precedente è stata {ch.status}.</p>}
            <p>Chi vince la partita prende tutta la posta; con il pareggio torna indietro. Budget: {st.budget} M€.</p>
            <div className="stake">{stake} M€</div>
            <input type="range" min={5} max={Math.max(5, Math.min(50, Math.floor(st.budget / 5) * 5))} step={5} value={stake} onChange={(e) => setStake(Number(e.target.value))} aria-label="Posta in milioni" style={{ width: "100%" }} />
            <button className="btn block" style={{ marginTop: 12 }} disabled={busy || st.budget < 5} onClick={async () => { const r = await act(() => api(`me/${token}/challenge`, { body: { stake } })); if (r) onClose(); }}>Lancia la sfida</button>
          </div>
        ) : incoming ? (
          <div className="panel cta-card">
            <h3>{opp?.owner} ti sfida per {ch.stake} M€</h3>
            <p className="small muted">Se accetti, {ch.stake} M€ vengono messi da parte subito. Hai {st.budget} M€.</p>
            <div className="row">
              <button className="btn grow" disabled={busy} onClick={() => act(() => api(`me/${token}/challenge/${ch.id}`, { body: { accept: true } }))}>Accetta</button>
              <button className="btn ghost grow" disabled={busy} onClick={() => act(() => api(`me/${token}/challenge/${ch.id}`, { body: { accept: false } }))}>Rifiuta</button>
            </div>
          </div>
        ) : ch.status === "proposta" ? (
          <div className="panel">
            <h3>Sfida lanciata: {ch.stake} M€</h3>
            <p className="small muted">In attesa della risposta di {opp?.owner}.</p>
            <button className="btn ghost" disabled={busy} onClick={() => act(() => api(`me/${token}/challenge/${ch.id}`, { body: { accept: false } }))}>Ritira la sfida</button>
          </div>
        ) : (
          <div className="panel"><h3>Sfida accettata</h3><p><strong>{ch.stake} M€</strong> a testa sul piatto: si decide alle 21:00.</p>{ch.result && <p>{ch.result}</p>}</div>
        )}
      </div>
    </div>
  );
}

/** Pannello "Gestione" nella scheda Squadra: allenamento e investimenti. */
export function ManagementPanel({ d, token, reload }: { d: any; token: string; reload: () => Promise<void> }) {
  const st = d.mine.state;
  const { err, busy, act } = useAct(reload);
  const [msg, setMsg] = useState<string | null>(null);
  const owned: string[] = st.investments ?? [];
  return (
    <div className="panel">
      <h3>Allenamento</h3>
      <p className="small muted">Il focus resta attivo finché non lo cambi.</p>
      {err && <div className="error">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div className="tiles">
        {TRAININGS.map((t) => (
          <button key={t.id} className="tile" aria-pressed={st.training === t.id} disabled={busy} onClick={() => act(() => api(`me/${token}/training`, { body: { focus: t.id, rep: st.tecnicaRep ?? "att" } }))}>
            <strong>{t.icon} {t.label}</strong><span>{t.desc}</span>
          </button>
        ))}
      </div>
      {st.training === "tecnica" && (
        <label className="field" style={{ marginTop: 10 }}><span>Reparto da migliorare ({st.tecnicaCount ?? 0}/3 giornate)</span>
          <select value={st.tecnicaRep ?? "att"} onChange={(e) => act(() => api(`me/${token}/training`, { body: { focus: "tecnica", rep: e.target.value as Reparto } }))}>
            {REPARTI.map((r) => <option key={r} value={r}>{REPARTO_LABEL[r]}</option>)}
          </select>
        </label>
      )}
      <h3 style={{ marginTop: 18 }}>Investimenti</h3>
      <p className="small muted">Budget {st.budget} M€. Ogni investimento si fa una volta sola.</p>
      {INVESTMENTS.map((inv) => {
        const has = owned.includes(inv.id);
        return (
          <div key={inv.id} className="invest-row">
            <span className="serata-ico" style={{ width: 40, height: 40, fontSize: 20 }} aria-hidden>{inv.icon}</span>
            <div className="grow"><strong>{inv.label}</strong><div className="small muted">{inv.desc}</div></div>
            {has ? <span className="chip done">Fatto</span> : <button className="btn small" disabled={busy || st.budget < inv.cost} onClick={async () => { const r = await act(() => api(`me/${token}/invest`, { body: { id: inv.id } })); if (r) setMsg(r.msg); }}>{inv.cost} M€</button>}
          </div>
        );
      })}
    </div>
  );
}
