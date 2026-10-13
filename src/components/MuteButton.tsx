import { useState } from "react";
import { isMuted, setMuted, unlockAudio } from "../feedback";
import { IcMute, IcSound } from "./Icons";

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  return (
    <button className="icon-btn plain" aria-label={m ? "Attiva i suoni" : "Disattiva i suoni"} aria-pressed={!m}
      onClick={() => { unlockAudio(); setMuted(!m); setM(!m); }}>{m ? <IcMute /> : <IcSound />}</button>
  );
}
