import { useState } from "react";
import { isMuted, setMuted, unlockAudio } from "../feedback";

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button className="icon-btn" aria-label={m ? "Attiva i suoni" : "Disattiva i suoni"} aria-pressed={!m}
      onClick={() => { unlockAudio(); setMuted(!m); setM(!m); }}>{m ? "🔇" : "🔊"}</button>
  );
}
