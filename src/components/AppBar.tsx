import type { ReactNode } from "react";
import { IcBack, IcClose } from "./Icons";

/** Barra superiore stile mockup: indietro a sinistra, titolo centrato maiuscolo, azione a destra. */
export function AppBar({ title, onBack, onClose, right, left, progress }: {
  title: string; onBack?: () => void; onClose?: () => void; right?: ReactNode; left?: ReactNode; progress?: number;
}) {
  return (
    <div className="appbar">
      <div className="appbar-row">
        <div className="appbar-side">
          {onBack ? <button className="icon-btn plain" aria-label="Indietro" onClick={onBack}><IcBack /></button> : left}
        </div>
        <h1 className="appbar-title">{title}</h1>
        <div className="appbar-side end">
          {right}
          {onClose && <button className="icon-btn plain" aria-label="Chiudi" onClick={onClose}><IcClose /></button>}
        </div>
      </div>
      {progress !== undefined && <div className="appbar-progress" aria-hidden><div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} /></div>}
    </div>
  );
}
