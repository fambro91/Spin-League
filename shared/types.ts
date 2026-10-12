export type Reparto = "por" | "dif" | "cen" | "att" | "pan" | "all";
export const REPARTI: Reparto[] = ["por", "dif", "cen", "att", "pan", "all"];
export const REPARTO_LABEL: Record<Reparto, string> = {
  por: "Portiere",
  dif: "Difesa",
  cen: "Centrocampo",
  att: "Attacco",
  pan: "Panchina",
  all: "Allenatore",
};
export type Ratings = Record<Reparto, number>;

export type Modulo = "4-3-3" | "3-4-3" | "4-4-2" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-5-1";
export const MODULI: Modulo[] = ["4-3-3", "3-4-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1"];
export type Atteggiamento = "equilibrato" | "offensivo" | "difensivo" | "contropiede" | "pressing";
export const ATTEGGIAMENTI: { id: Atteggiamento; label: string }[] = [
  { id: "equilibrato", label: "Equilibrato" },
  { id: "offensivo", label: "Offensivo" },
  { id: "difensivo", label: "Difensivo" },
  { id: "contropiede", label: "Contropiede" },
  { id: "pressing", label: "Pressing alto" },
];
export type Turnover = "nessuno" | "parziale" | "massiccio";
export type Discorso = "nessuno" | "motivare" | "calmare";

export type CoachStyle =
  | "difensivista" | "giochista" | "sergente" | "motivatore" | "camaleonte" | "visionario" | "bandiera";

export type Choices = {
  modulo: Modulo;
  atteggiamento: Atteggiamento;
  turnover: Turnover;
  discorso: Discorso;
};

export type RosterPlayer = { name: string; ruolo: "POR" | "DIF" | "CEN" | "ATT" };

export type Fuoriclasse = {
  name: string;
  ruolo: Reparto; // por/dif/cen/att
  level: number; // 0..4
  levelLabel: string;
  bonus: number;
  decays: boolean;
};

export type LuckyOp =
  | { kind: "add"; rep: Reparto; delta: number }
  | { kind: "set"; rep: Reparto; value: number }
  | { kind: "budget"; delta: number }
  | { kind: "fuoriPromo" }
  | { kind: "stadio" };

/** Dati grezzi raccolti durante gli spin. I valori finali si calcolano in computeClub. */
export type Draft = {
  city?: string;
  region?: string;
  blasone?: string;
  base?: number;
  repMods: Partial<Record<Reparto, number>>;
  coachStyle?: CoachStyle;
  coachLabel?: string;
  preferredModule?: Modulo | "tutti";
  budget?: number;
  stadium?: { label: string; incasso: number; idx: number };
  fans?: { label: string; campo: number; ultras: boolean };
  moraleBonus: number;
  fuoriLevel?: number;
  fuoriRuolo?: Reparto;
  sponsor?: string;
  luckyOps: LuckyOp[];
  notes: string[];
};

export type SpinRecord = { wheel: string; index: number; label: string; lucky: boolean; note?: string };

export type CreationState = {
  queue: string[];
  done: SpinRecord[];
  streak: number;
  luckyCount: number;
  pendingReparto: { kind: "add"; delta: number; times: number } | { kind: "set"; value: number } | null;
  draft: Draft;
};

export type Identity = {
  name: string;
  colors: [string, string];
  crest: "scudo" | "cerchio" | "rombo" | "stella";
  fuoriclasseName: string;
};

export type Club = {
  name: string;
  colors: [string, string];
  crest: Identity["crest"];
  city: string;
  region: string;
  blasone: string;
  ratings: Ratings; // valori di partenza (con fuoriclasse e lucky)
  coachStyle: CoachStyle;
  coachLabel: string;
  coachName?: string;
  preferredModule: Modulo | "tutti";
  stadium: { label: string; incasso: number };
  fans: { label: string; campo: number; ultras: boolean };
  fuoriclasse: Fuoriclasse | null;
  sponsor: string;
  roster: RosterPlayer[];
  initialMorale: number;
  initialBudget: number;
  voto: number;
  classe: string;
  notes: string[];
};

export type Modifier = { rep: Reparto; delta: number; untilMatchday: number; label: string };

export type ClubState = {
  cond: number;
  morale: number;
  budget: number;
  ratings: Ratings; // valori correnti permanenti (mercato, primavera...)
  modifiers: Modifier[];
  choices: Choices;
  confirmedFor: number | null; // giornata per cui ha confermato
  campoSqualificato: boolean;
  pendingDecision: "fuoriclasse" | null;
  marketOps: number;
  marketDelta: Partial<Record<Reparto, number>>;
  lastResults: ("V" | "N" | "P")[];
};

export type MatchEvent = {
  minute: number;
  team: "home" | "away";
  type: "gol" | "parata" | "palo" | "fuori" | "rosso" | "giallo";
  player?: string;
  schema?: string;
  score?: [number, number];
};

export type MatchResult = {
  homeGoals: number;
  awayGoals: number;
  xg: [number, number];
  events: MatchEvent[];
  highlights: MatchEvent[];
};
