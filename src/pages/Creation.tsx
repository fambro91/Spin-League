import { useState } from "react";
import { api } from "../api";
import { WHEELS } from "../../shared/wheels";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import { Confetti } from "../components/Confetti";
import { MuteButton } from "../components/MuteButton";
import { AppBar } from "../components/AppBar";
import { ding, unlockAudio } from "../feedback";
import type { SpinRecord } from "../../shared/types";

type Props = { onRestart?: React.ReactNode; token: string; creation: { done: SpinRecord[]; next: string | null; remaining: number; streak: number; luckyCount: number }; onFinished: () => void };
type SpinRes = { record: SpinRecord; combo: boolean; next: string | null; remaining: number; status: string; streak: number };

function resultLabel(wheelId: string, r: SpinRecord) {
  const seg = WHEELS[wheelId]?.segments[r.index];
  if (wheelId.startsWith("rep_") && typeof seg?.data === "number") return `${r.label} ${seg.data > 0 ? "+" : seg.data < 0 ? "−" : "±"}${Math.abs(seg.data)}`;
  return r.label;
}

export function Creation({ token, creation, onFinished, onRestart }: Props) {
  const [wheelId, setWheelId] = useState<string>(creation.next ?? "citta");
  const [target, setTarget] = useState<SpinTarget | null>(null);
  const [phase, setPhase] = useState<"ready" | "spinning" | "revealed">("ready");
  const [res, setRes] = useState<SpinRes | null>(null);
  const [done, setDone] = useState<SpinRecord[]>(creation.done);
  const [streak, setStreak] = useState(creation.streak);
  const [remaining, setRemaining] = useState(creation.remaining);
  const [showCombo, setShowCombo] = useState(false);
  const [unlock, setUnlock] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const wheel = WHEELS[wheelId];
  const gold = wheelId === "lucky";
  const special = !!wheel.special;

  const spin = async () => {
    unlockAudio();
    setErr(null); setPhase("spinning");
    try {
      const r: SpinRes = await api(`me/${token}/spin`, { method: "POST" });
      setRes(r);
      setTarget({ index: r.record.index, key: Date.now() });
    } catch (e: any) { setErr(e.message); setPhase("ready"); }
  };
  const revealed = () => {
    if (!res) return;
    setPhase("revealed");
    ding(res.record.lucky || gold);
    setDone((d) => [...d, res.record]);
    setStreak(res.streak);
    setRemaining(res.remaining);
    if (res.combo) setTimeout(() => setShowCombo(true), 700);
  };
  const go = (id: string) => { setWheelId(id); setRes(null); setTarget(null); setPhase("ready"); setShowCombo(false); setUnlock(null); };
  const next = () => {
    if (!res) return;
    if (!res.next) { onFinished(); return; }
    // ruota speciale: prima l'annuncio
    if (WHEELS[res.next]?.special && unlock !== res.next) { setShowCombo(false); setUnlock(res.next); ding(true); return; }
    go(res.next);
  };

  const total = done.length + remaining;
  const counts = wheel.segments.some((s) => s.lucky);

  return (
    <div className="stage">
      <AppBar title="Crea il tuo club" left={onRestart ?? <span className="stage-count">{Math.min(done.length + 1, total)}/{total}</span>} right={<MuteButton />} progress={done.length / Math.max(1, total)} />

      <div className={`question ${gold ? "gold" : ""} ${special ? "special" : ""}`}>
        <span className="q-badge" aria-hidden>{wheel.emoji}</span>
        <div>
          <div className="q-title">{wheel.title}</div>
          <div className="q-text">{wheel.question ?? wheel.subtitle}</div>
        </div>
      </div>

      <div className={`wheel-box ${gold ? "gold" : ""} ${special ? "special" : ""}`}>
        <WheelCanvas wheel={wheel} target={target} onDone={revealed} gold={gold} hub={wheel.emoji} />
      </div>

      <div className="result" aria-live="polite">{phase === "revealed" && res ? res.record.label : phase === "spinning" ? "…" : " "}</div>
      <div className="note-row">
        {phase === "revealed" && res?.record.lucky && <span className="ribbon">★ SPIN FORTUNATO</span>}
        {phase === "revealed" && special && <span className="ribbon special">✦ TRATTO SPECIALE</span>}
        {phase === "revealed" && res?.record.note && <span className="note">{res.record.note}</span>}
      </div>

      {err && <div className="error">{err}</div>}
      <div className="stage-actions">
        {phase === "ready" && <button className="btn pulse" onClick={spin}>{gold ? "Gira la ruota dorata" : special ? "Gira la ruota speciale" : "Gira la ruota"}</button>}
        {phase === "spinning" && <button className="btn" disabled>Gira…</button>}
        {phase === "revealed" && !showCombo && <button className="btn" onClick={next}>{res?.next ? "Prossima ruota" : "Dai un nome al club"}</button>}
      </div>

      <div className="streak-card" aria-label={`Spin fortunati di fila: ${streak} su 3`}>
        <span>Lucky Streak</span>
        <span className="streak-dots">{[0, 1, 2].map((i) => <i key={i} className={i < streak ? "on" : ""} />)}</span>
        <span className="small muted">{special ? "le ruote speciali non contano" : counts ? "3 di fila = ruota dorata" : "questa ruota non conta"}</span>
      </div>

      {done.length > 0 && (
        <details className="recap">
          <summary className="muted small">Ruote già girate ({done.length})</summary>
          <ul className="small">
            {done.map((r, i) => <li key={i}>{WHEELS[r.wheel]?.title}: <strong>{r.label}</strong>{r.lucky ? " ★" : ""}{r.note ? ` — ${r.note}` : ""}</li>)}
          </ul>
        </details>
      )}

      {unlock && WHEELS[unlock] && (
        <div className="unlock" role="dialog" aria-label="Ruota speciale sbloccata">
          <div>
            <span className="em" aria-hidden>{WHEELS[unlock].emoji}</span>
            <div className="tag">Ruota speciale sbloccata</div>
            <div className="big">{WHEELS[unlock].title}</div>
            <p className="why">Perché: {WHEELS[unlock].unlock}</p>
            <button className="btn pulse" onClick={() => go(unlock)}>Vai alla ruota</button>
          </div>
        </div>
      )}

      {showCombo && (
        <div className="combo" role="dialog" aria-label="Combo">
          <Confetti />
          <div>
            <div className="big">COMBO</div>
            <p style={{ fontFamily: "var(--body)", color: "var(--chalk)", fontSize: 18, margin: "14px 0 22px" }}>Tre spin fortunati di fila: si sblocca la ruota dorata.</p>
            <button className="btn pulse" onClick={() => res?.next && go(res.next)}>Vai alla ruota dorata</button>
          </div>
        </div>
      )}
    </div>
  );
}
