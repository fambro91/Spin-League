import { useState } from "react";
import { api } from "../api";
import { WHEELS } from "../../shared/wheels";
import { WheelCanvas, type SpinTarget } from "../components/WheelCanvas";
import type { SpinRecord } from "../../shared/types";

type Props = { token: string; creation: { done: SpinRecord[]; next: string | null; remaining: number; streak: number; luckyCount: number }; onFinished: () => void };

export function Creation({ token, creation, onFinished }: Props) {
  const [wheelId, setWheelId] = useState<string>(creation.next ?? "citta");
  const [target, setTarget] = useState<SpinTarget | null>(null);
  const [phase, setPhase] = useState<"ready" | "spinning" | "revealed">("ready");
  const [res, setRes] = useState<{ record: SpinRecord; combo: boolean; next: string | null; remaining: number; status: string; streak: number } | null>(null);
  const [done, setDone] = useState<SpinRecord[]>(creation.done);
  const [streak, setStreak] = useState(creation.streak);
  const [remaining, setRemaining] = useState(creation.remaining);
  const [showCombo, setShowCombo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wheel = WHEELS[wheelId];
  const gold = wheelId === "lucky";

  const spin = async () => {
    setErr(null); setPhase("spinning");
    try {
      const r = await api(`me/${token}/spin`, { method: "POST" });
      setRes(r);
      setTarget({ index: r.record.index, key: Date.now() });
    } catch (e: any) { setErr(e.message); setPhase("ready"); }
  };
  const revealed = () => {
    if (!res) return;
    setPhase("revealed");
    setDone((d) => [...d, res.record]);
    setStreak(res.streak);
    setRemaining(res.remaining);
    if (res.combo) setTimeout(() => setShowCombo(true), 700);
  };
  const next = () => {
    if (!res) return;
    if (!res.next) { onFinished(); return; }
    setWheelId(res.next); setRes(null); setTarget(null); setPhase("ready"); setShowCombo(false);
  };

  const total = done.length + remaining;
  const luckyCounts = wheel.segments.some((s) => s.lucky);

  return (
    <div className="stage">
      <div className="progress" aria-label={`Ruota ${done.length + 1} di circa ${total}`}><div style={{ width: `${(100 * done.length) / Math.max(1, total)}%` }} /></div>
      <div className="emoji" style={{ marginTop: 14 }} aria-hidden>{wheel.emoji}</div>
      <div className="pill" style={gold ? { color: "#ffb31a", borderColor: "#ffb31a" } : undefined}>{wheel.title}</div>
      <div className="subtitle">{wheel.subtitle}</div>
      <div className="result" aria-live="polite">{phase === "revealed" && res ? res.record.label : phase === "spinning" ? "…" : " "}</div>
      <div className="note">{phase === "revealed" && res ? (res.record.note ?? (res.record.lucky ? "★ Spin fortunato" : "")) : ""}</div>

      <div className={`wheel-box ${gold ? "gold" : ""}`}>
        <WheelCanvas wheel={wheel} target={target} onDone={revealed} gold={gold} />
      </div>

      {err && <div className="error">{err}</div>}
      {phase === "ready" && <button className="btn" onClick={spin}>{gold ? "Gira la ruota dorata" : "Gira la ruota"}</button>}
      {phase === "spinning" && <button className="btn" disabled>Gira…</button>}
      {phase === "revealed" && !showCombo && <button className="btn" onClick={next}>{res?.next ? "Prossima ruota" : "Dai un nome al club"}</button>}

      <div className="streak" aria-label={`Spin fortunati di fila: ${streak} su 3`}>
        {luckyCounts || streak > 0 ? <>Lucky Streak {[0, 1, 2].map((i) => <i key={i} className={i < streak ? "on" : ""} />)}</> : <span>&nbsp;</span>}
      </div>

      {done.length > 0 && (
        <details style={{ marginTop: 22, width: "100%", maxWidth: 400, textAlign: "left" }}>
          <summary className="muted small" style={{ cursor: "pointer" }}>Ruote già girate ({done.length})</summary>
          <ul className="small" style={{ paddingLeft: 18 }}>
            {done.map((r, i) => <li key={i}>{WHEELS[r.wheel]?.title}: <strong>{r.label}</strong>{r.lucky ? " ★" : ""}{r.note ? ` — ${r.note}` : ""}</li>)}
          </ul>
        </details>
      )}

      {showCombo && (
        <div className="combo" role="dialog" aria-label="Combo">
          <div>
            <div className="big">COMBO</div>
            <p style={{ fontFamily: "var(--body)", color: "var(--chalk)", fontSize: 18, margin: "14px 0 22px" }}>Tre spin fortunati di fila: si sblocca la ruota dorata.</p>
            <button className="btn" onClick={next}>Vai alla ruota dorata</button>
          </div>
        </div>
      )}
    </div>
  );
}
