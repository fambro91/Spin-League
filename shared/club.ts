import type { Club, ClubState, Draft, Identity, Ratings, Reparto, RosterPlayer } from "./types";
import { REPARTI } from "./types";
import { FUORI_BONUS, FUORI_LABEL } from "./wheels";
import { makeRng } from "./rng";

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const NOMI = ["Marco", "Luca", "Andrea", "Matteo", "Lorenzo", "Davide", "Simone", "Federico", "Alessio", "Tommaso", "Riccardo", "Gabriele", "Nicolò", "Filippo", "Edoardo", "Samuele", "Diego", "Mattia", "Giacomo", "Pietro", "Emanuele", "Stefano", "Christian", "Daniele", "Kevin", "Yusuf", "Mamadou", "Iván", "Joao", "Lukas", "Mateo", "Ousmane", "Nikola", "Sander", "Bruno", "Elia", "Leonardo", "Michele"];
const COGNOMI = ["Rossi", "Bianchi", "Ferrari", "Esposito", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile", "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "D'Angelo", "Marchetti", "Parisi", "Villa", "Conte", "Ferraro", "Fabbri", "Bianco", "Marini", "Grasso", "Valentini", "Messina", "Sala", "Diallo", "Petrović", "Silva", "Novak", "Jensen", "Kovač", "Traoré", "Pereira", "Lindqvist", "Okafor", "Fambrini", "Pucci", "Del Carlo", "Bertolucci"];

export function generateRoster(seed: string, fuoriName?: string, fuoriRuolo?: Reparto): RosterPlayer[] {
  const rng = makeRng("roster:" + seed);
  const used = new Set<string>();
  const name = () => {
    for (;;) {
      const n = `${rng.pick(NOMI)} ${rng.pick(COGNOMI)}`;
      if (!used.has(n)) { used.add(n); return n; }
    }
  };
  const roster: RosterPlayer[] = [];
  const counts: [RosterPlayer["ruolo"], number][] = [["POR", 2], ["DIF", 6], ["CEN", 5], ["ATT", 5]];
  for (const [r, n] of counts) for (let i = 0; i < n; i++) roster.push({ name: name(), ruolo: r });
  if (fuoriName && fuoriRuolo && fuoriRuolo !== "pan" && fuoriRuolo !== "all") {
    const map = { por: "POR", dif: "DIF", cen: "CEN", att: "ATT" } as const;
    const idx = roster.findIndex((p) => p.ruolo === map[fuoriRuolo]);
    roster[idx] = { name: fuoriName, ruolo: map[fuoriRuolo] };
  }
  return roster;
}

export const COACH_NAMES: Record<string, string[]> = {
  difensivista: ["Max Allegria", "José Mourigno", "Cholo Simeoncino", "Rocco Catenacci"],
  giochista: ["Pep Guardiolina", "Maurizio Sarrino", "Roberto De Zerbino", "Arrigo Sacchetto"],
  sergente: ["Antonio Contessa", "Fabio Capellone", "Giovanni Trapattino", "Marcello Lippone"],
  motivatore: ["Carletto Sopracciglio", "Jürgen Kloppetto", "Claudio Ranierino", "Sir Alex Fergusoni"],
  camaleonte: ["Luciano Spallettone", "Simone Inzaghetto", "Gian Piero Gasperinho", "Stefano Piolino"],
  visionario: ["Zdenek Zemanov", "Johan Cruijffino", "Marcelo Bielsetta", "Gigi Maifredino"],
  bandiera: ["Capitan Tottino", "Pippo Bandierone", "Javier Zanettino", "Paolo Maldinetto"],
};

export function coachNameFor(style: string, seed: string): string {
  const list = COACH_NAMES[style] ?? COACH_NAMES.giochista;
  return makeRng("coach:" + seed).pick(list);
}

export const VOTO_WEIGHTS: Ratings = { att: 0.2, cen: 0.2, dif: 0.2, por: 0.15, pan: 0.1, all: 0.15 };

export function voto(r: Ratings): number {
  return Math.round(REPARTI.reduce((s, k) => s + r[k] * VOTO_WEIGHTS[k], 0) * 10) / 10;
}

export function classe(v: number): string {
  if (v >= 80) return "S";
  if (v >= 75) return "A";
  if (v >= 70) return "B";
  if (v >= 65) return "C";
  if (v >= 60) return "D";
  return "E";
}

export function computeRatings(d: Draft): { ratings: Ratings; fuoriLevel: number; stadiumUpgrade: boolean; budgetBonus: number } {
  const base = d.base ?? 63;
  const r = {} as Ratings;
  for (const k of REPARTI) r[k] = base + (d.repMods[k] ?? 0);
  let fuoriLevel = d.fuoriLevel ?? 0;
  let stadiumUpgrade = false;
  let budgetBonus = 0;
  for (const op of d.luckyOps) {
    if (op.kind === "fuoriPromo") fuoriLevel = Math.min(4, fuoriLevel + 1);
    if (op.kind === "stadio") stadiumUpgrade = true;
    if (op.kind === "budget") budgetBonus += op.delta;
  }
  if (fuoriLevel > 0 && d.fuoriRuolo) r[d.fuoriRuolo] += FUORI_BONUS[fuoriLevel];
  for (const op of d.luckyOps) {
    if (op.kind === "add") r[op.rep] += op.delta;
    if (op.kind === "set") r[op.rep] = Math.max(r[op.rep], op.value);
  }
  for (const k of REPARTI) r[k] = clamp(Math.round(r[k]), 40, 99);
  return { ratings: r, fuoriLevel, stadiumUpgrade, budgetBonus };
}

export function computeClub(d: Draft, id: Identity, seed: string): Club {
  const { ratings, fuoriLevel, stadiumUpgrade, budgetBonus } = computeRatings(d);
  // Ruolo mancante se la promozione arriva senza fuoriclasse: diventa attaccante.
  const fuoriRuolo: Reparto = d.fuoriRuolo ?? "att";
  if (fuoriLevel > 0 && !d.fuoriRuolo) ratings.att = clamp(ratings.att + FUORI_BONUS[fuoriLevel], 40, 99);
  const fuoriclasse = fuoriLevel > 0
    ? { name: id.fuoriclasseName || "Il Fenomeno", ruolo: fuoriRuolo, level: fuoriLevel, levelLabel: FUORI_LABEL[fuoriLevel], bonus: FUORI_BONUS[fuoriLevel], decays: fuoriLevel === 4 }
    : null;
  const stadium = stadiumUpgrade ? { label: "Stadio da 80.000", incasso: 8 } : { label: d.stadium?.label ?? "Comunale da 8.000", incasso: d.stadium?.incasso ?? 0.8 };
  const v = voto(ratings);
  return {
    name: id.name,
    colors: id.colors,
    crest: id.crest,
    city: d.city ?? "Lucca",
    region: d.region ?? "",
    blasone: d.blasone ?? "Provinciale",
    ratings,
    coachStyle: d.coachStyle ?? "giochista",
    coachLabel: d.coachLabel ?? "Giochista",
    coachName: coachNameFor(d.coachStyle ?? "giochista", seed),
    preferredModule: d.preferredModule ?? "4-3-3",
    stadium,
    fans: d.fans ?? { label: "Normale", campo: 2, ultras: false },
    fuoriclasse,
    sponsor: d.sponsor ?? "",
    roster: generateRoster(seed, fuoriclasse?.name, fuoriclasse?.ruolo),
    initialMorale: clamp(50 + d.moraleBonus, 0, 100),
    initialBudget: (d.budget ?? 15) + budgetBonus,
    voto: v,
    classe: classe(v),
    notes: d.notes,
  };
}

export function initialState(c: Club): ClubState {
  return {
    cond: 100,
    morale: c.initialMorale,
    budget: c.initialBudget,
    ratings: { ...c.ratings },
    modifiers: [],
    choices: {
      modulo: c.preferredModule === "tutti" ? "4-3-3" : c.preferredModule,
      atteggiamento: "equilibrato",
      turnover: "nessuno",
      discorso: "nessuno",
    },
    confirmedFor: null,
    campoSqualificato: false,
    pendingDecision: null,
    marketOps: 0,
    marketDelta: {},
    lastResults: [],
  };
}

const CPU_NAMES = ["Atletico", "Real", "Sporting", "Virtus", "Pro", "Union", "Dinamo", "Olimpia", "Audace", "Fortitudo"];
const CPU_COLORS: [string, string][] = [["#1d4ed8", "#ffffff"], ["#b91c1c", "#111827"], ["#15803d", "#ffffff"], ["#7c3aed", "#fde047"], ["#0f172a", "#f8fafc"], ["#ea580c", "#1e293b"], ["#0e7490", "#fef3c7"], ["#be185d", "#f1f5f9"]];

export function cpuIdentity(seed: string, city: string): Identity {
  const rng = makeRng("cpu:" + seed);
  return {
    name: `${rng.pick(CPU_NAMES)} ${city}`,
    colors: rng.pick(CPU_COLORS),
    crest: rng.pick(["scudo", "cerchio", "rombo", "stella"] as const),
    fuoriclasseName: `${rng.pick(NOMI)} ${rng.pick(COGNOMI)}`,
  };
}
