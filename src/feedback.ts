import { store } from "./api";

let ctx: AudioContext | null = null;
let lastTick = 0;

export function isMuted() { return store.get("spin:mute") === "1"; }
export function setMuted(m: boolean) { store.set("spin:mute", m ? "1" : "0"); }

/** Va chiamata dentro un gesto dell'utente (tocco) per sbloccare l'audio su iOS. */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* audio non disponibile */ }
}

if (typeof window !== "undefined") window.addEventListener("pointerdown", unlockAudio, { passive: true });

/** Scatto del puntatore: clic breve generato via codice + vibrazione leggera. */
export function tick(speed = 1) {
  const now = performance.now();
  if (now - lastTick < 28) return;
  lastTick = now;
  if (!isMuted() && ctx && ctx.state === "running") {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 1400 + Math.random() * 300;
    g.gain.setValueAtTime(0.05 * Math.min(1, 0.4 + speed), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.04);
  }
  try { navigator.vibrate?.(6); } catch { /* non supportato */ }
}

/** Suono di fine giro (esito). */
export function ding(lucky = false) {
  if (isMuted() || !ctx || ctx.state !== "running") return;
  const notes = lucky ? [880, 1108, 1318] : [660, 880];
  notes.forEach((f, i) => {
    const o = ctx!.createOscillator(), g = ctx!.createGain();
    o.type = "triangle"; o.frequency.value = f;
    const t = ctx!.currentTime + i * 0.09;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(ctx!.destination);
    o.start(t); o.stop(t + 0.4);
  });
  try { navigator.vibrate?.(lucky ? [20, 40, 20, 40, 60] : 25); } catch { /* non supportato */ }
}
