// Carriera "dinastia": due divisioni, obiettivi della società, fiducia, ruote di fine stagione.
import type { Club, ClubState, Reparto } from "./types";
import { REPARTO_LABEL } from "./types";
import type { Rng } from "./rng";
import type { Wheel } from "./wheels";
import { clamp, voto, classe } from "./club";
import { has } from "./traits";

export type Division = "A" | "B";
export const DIV_LABEL: Record<Division, string> = { A: "Serie A", B: "Serie B" };

export type ObjectiveId = "titolo" | "promozione" | "europa" | "meta" | "salvezza";
export type Objective = { id: ObjectiveId; label: string; maxPos: number; bilancio?: boolean; budgetStart?: number };

export type PalmaresEntry = { season: number; division: Division; club: string; pos: number; n: number; outcome: string; objective: string; ok: boolean };

export type SeasonSummary = {
  season: number; division: Division; pos: number; n: number; club: string;
  objective: Objective | null; ok: boolean; fiducia: number; fiduciaDelta: number;
  you: "promosso" | "retrocesso" | "campione" | null; promoted: string[]; relegated: string[];
  notes: string[]; esonero: boolean;
};

export type CareerData = {
  objective: Objective | null;
  fiducia: number; // 0-100
  fails: number; // obiettivi mancati di fila
  palmares: PalmaresEntry[];
  /** Ruote da girare prima del via (pre/post stagione). */
  wheels: string[];
  summary: SeasonSummary | null;
  teams: number;
  spins: { wheel: string; label: string; note?: string }[];
};

export const PROMO = 2; // promosse/retrocesse

export function newCareerData(teams: number): CareerData {
  return { objective: null, fiducia: 60, fails: 0, palmares: [], wheels: ["obiettivo"], summary: null, teams, spins: [] };
}

/* ---------- obiettivo della società ---------- */

function objectiveOptions(div: Division, n: number): Record<ObjectiveId, Objective> {
  return {
    titolo: { id: "titolo", label: div === "B" ? "Vincere la B" : "Scudetto", maxPos: 1 },
    promozione: { id: "promozione", label: "Promozione in A", maxPos: PROMO },
    europa: { id: "europa", label: "Podio", maxPos: 3 },
    meta: { id: "meta", label: "Metà classifica", maxPos: Math.ceil(n / 2) },
    salvezza: { id: "salvezza", label: "Salvezza", maxPos: n - PROMO },
  };
}

/** Ruota dell'obiettivo: i pesi dipendono da quanto è forte il club nella sua divisione e dal presidente. */
export function objectiveWheel(div: Division, n: number, expectedPos: number, club: Club): Wheel {
  const o = objectiveOptions(div, n);
  const top = div === "B" ? o.promozione : o.europa;
  const strong = expectedPos <= 2, mid = expectedPos <= Math.ceil(n / 2);
  let w: [Objective, number][] = strong ? [[o.titolo, 35], [top, 45], [o.meta, 20]]
    : mid ? [[o.titolo, 8], [top, 32], [o.meta, 45], [o.salvezza, 15]]
    : [[top, 10], [o.meta, 35], [o.salvezza, 55]];
  // il presidente vulcanico pretende di più
  if (has(club, "pres_vulcanico")) w = w.map(([ob, x], i) => [ob, i < 2 ? x * 2 : x]);
  return {
    id: "obiettivo", title: "Obiettivo della società", subtitle: "Cosa ti chiede il presidente", question: "Cosa ti chiede il presidente per questa stagione?",
    emoji: "🎯", palette: "blue", segments: w.map(([ob, weight]) => ({ label: ob.label, weight, data: ob.id })),
  };
}

export function objectiveFrom(div: Division, n: number, id: ObjectiveId, club: Club, budget: number): Objective {
  const ob = { ...objectiveOptions(div, n)[id] };
  if (has(club, "pres_affari")) { ob.bilancio = true; ob.budgetStart = budget; }
  return ob;
}

export function objectiveMet(ob: Objective | null, pos: number, budget: number): boolean {
  if (!ob) return true;
  if (pos > ob.maxPos) return false;
  if (ob.bilancio && ob.budgetStart != null && budget < ob.budgetStart) return false;
  return true;
}

/* ---------- ruote di fine stagione ---------- */

export const END_WHEELS: Record<string, Wheel> = {
  giovanili: {
    id: "giovanili", title: "Settore giovanile", subtitle: "Cosa esce dalla Primavera?", question: "Cosa esce quest'anno dalla Primavera?", emoji: "🌱", palette: "teal",
    segments: [
      { label: "Nessun talento", weight: 22, data: 0 }, { label: "Un buon ragazzo: +1", weight: 30, data: 1 },
      { label: "Promessa: +2", weight: 26, data: 2 }, { label: "Talento: +3", weight: 15, data: 3 }, { label: "Gioiello: +4", weight: 7, data: 4 },
    ],
  },
  rinnovo: {
    id: "rinnovo", title: "Rinnovo del fuoriclasse", subtitle: "La tua stella resta?", question: "Il contratto della tua stella scade: cosa succede?", emoji: "✍️", palette: "gold",
    segments: [
      { label: "Rinnova felice", weight: 35, data: "ok" }, { label: "Chiede l'aumento: −20 M€", weight: 30, data: "aumento" },
      { label: "Promette grandi cose: +1", weight: 15, data: "plus" }, { label: "Se ne va a parametro zero", weight: 20, data: "via" },
    ],
  },
  sponsor: {
    id: "sponsor", title: "Sponsor", subtitle: "Chi paga la maglia quest'anno?", question: "Chi paga la maglia quest'anno?", emoji: "👕", palette: "blue",
    segments: [
      { label: "Confermato: +10 M€", weight: 35, data: 10 }, { label: "Nuovo sponsor: +25 M€", weight: 20, data: 25 },
      { label: "Sponsor locale: +5 M€", weight: 30, data: 5 }, { label: "Lo sponsor scappa", weight: 15, data: 0 },
    ],
  },
};

const FIELD: Reparto[] = ["por", "dif", "cen", "att"];

/** Applica l'esito di una ruota di fine stagione. Ritorna la nota da mostrare. */
export function applyEndWheel(id: string, data: any, club: Club, st: ClubState, rng: Rng): string {
  switch (id) {
    case "giovanili": {
      if (!data) return "Nessun talento quest'anno.";
      const rep = rng.pick(FIELD);
      st.ratings[rep] = clamp(st.ratings[rep] + data, 40, 99);
      return `${REPARTO_LABEL[rep]} +${data}`;
    }
    case "rinnovo": {
      const f = club.fuoriclasse;
      if (!f) return "Nessun fuoriclasse in rosa.";
      if (data === "ok") { st.morale = clamp(st.morale + 5, 0, 100); return `${f.name} resta: morale +5`; }
      if (data === "plus") { f.bonus += 1; st.ratings[f.ruolo] = clamp(st.ratings[f.ruolo] + 1, 40, 99); return `${f.name} promette grandi cose: ${REPARTO_LABEL[f.ruolo]} +1`; }
      if (data === "aumento" && st.budget >= 20) { st.budget -= 20; return `${f.name} resta, ma costa 20 M€`; }
      // se ne va (o non ci sono i soldi per l'aumento)
      st.ratings[f.ruolo] = clamp(st.ratings[f.ruolo] - f.bonus, 40, 99);
      const name = f.name;
      club.fuoriclasse = null;
      return data === "aumento" ? `Non ci sono i soldi per l'aumento: ${name} se ne va` : `${name} se ne va a parametro zero`;
    }
    case "sponsor":
      st.budget += data;
      return data ? `+${data} M€` : "Nessun incasso dallo sponsor";
  }
  return "";
}

/* ---------- invecchiamento e ripartenza ---------- */

/** Fine stagione per ogni club: invecchiamento, fuoriclasse che cala, stato che riparte. */
export function ageClub(club: Club, st: ClubState, rng: Rng, isCpu: boolean): string[] {
  const notes: string[] = [];
  for (const r of ["por", "dif", "cen", "att", "pan", "all"] as Reparto[]) {
    const d = rng.int(-2, 2);
    st.ratings[r] = clamp(st.ratings[r] + d, 40, 99);
  }
  const f = club.fuoriclasse;
  if (f) {
    f.seasons = (f.seasons ?? 1) + 1;
    if (f.seasons > 3 && !has(club, "camp_eterno") && f.bonus > 0) {
      f.bonus -= 1; st.ratings[f.ruolo] = clamp(st.ratings[f.ruolo] - 1, 40, 99);
      notes.push(`${f.name} invecchia: ${REPARTO_LABEL[f.ruolo]} −1`);
    }
  }
  if (isCpu) { const rep = rng.pick(FIELD); st.ratings[rep] = clamp(st.ratings[rep] + rng.int(0, 3), 40, 99); }
  club.voto = voto(st.ratings); club.classe = classe(club.voto);
  return notes;
}

export function resetForSeason(st: ClubState, club: Club) {
  st.cond = 100;
  st.morale = clamp(Math.round(50 + (st.morale - 50) / 2), 0, 100);
  st.modifiers = []; st.lastResults = []; st.marketOps = 0; st.marketDelta = {};
  st.confirmedFor = null; st.campoSqualificato = false; st.pendingDecision = null;
  st.dilemmas = undefined; st.press = undefined; st.predictions = undefined; st.live = undefined; st.homeBoost = 0;
  st.choices = { ...st.choices, discorso: "nessuno", turnover: "nessuno" };
  void club;
}

export function expectedPosition(clubId: string, clubs: { id: string; voto: number }[]): number {
  return [...clubs].sort((a, b) => b.voto - a.voto).findIndex((c) => c.id === clubId) + 1;
}
