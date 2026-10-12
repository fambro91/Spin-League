import type { CoachStyle, CreationState, Draft, LuckyOp, Modulo, Reparto, SpinRecord } from "./types";
import { REPARTO_LABEL } from "./types";
import type { Rng } from "./rng";

export type Segment = { label: string; weight: number; lucky?: boolean; data?: any; icon?: string };
export type Wheel = {
  id: string;
  title: string;
  subtitle: string;
  question?: string;
  emoji: string;
  palette: "rainbow" | "pitch" | "gold" | "blue" | "red" | "purple" | "teal";
  segments: Segment[];
};

const CITIES: [string, string][] = [
  ["Lucca", "Toscana"], ["Pisa", "Toscana"], ["Livorno", "Toscana"], ["Firenze", "Toscana"], ["Viareggio", "Toscana"],
  ["Genova", "Liguria"], ["La Spezia", "Liguria"], ["Torino", "Piemonte"], ["Milano", "Lombardia"], ["Bergamo", "Lombardia"],
  ["Brescia", "Lombardia"], ["Verona", "Veneto"], ["Venezia", "Veneto"], ["Bologna", "Emilia-Romagna"], ["Parma", "Emilia-Romagna"],
  ["Ancona", "Marche"], ["Perugia", "Umbria"], ["Roma", "Lazio"], ["Napoli", "Campania"], ["Bari", "Puglia"],
  ["Lecce", "Puglia"], ["Reggio Calabria", "Calabria"], ["Palermo", "Sicilia"], ["Catania", "Sicilia"], ["Cagliari", "Sardegna"],
  ["Trieste", "Friuli-Venezia Giulia"], ["Borgo Calcione", "Toscana"], ["Porto Rimbalzo", "Liguria"],
];

const repartoWheel = (rep: Reparto): Wheel => ({
  id: `rep_${rep}`,
  question: { por: "Quanto è forte il tuo portiere?", dif: "Quanto è solida la tua difesa?", cen: "Chi comanda a centrocampo?", att: "Quanti gol farà il tuo attacco?", pan: "Quanto è lunga la panchina?", all: "Quanto vale il tuo allenatore?" }[rep],
  title: REPARTO_LABEL[rep],
  subtitle: rep === "all" ? "Quanto vale il tuo allenatore" : rep === "pan" ? "Quanto è profonda la rosa" : `Il livello del reparto ${REPARTO_LABEL[rep].toLowerCase()}`,
  emoji: { por: "🧤", dif: "🛡️", cen: "🎯", att: "⚡", pan: "🪑", all: "📋" }[rep],
  palette: "rainbow",
  segments: [
    { label: "Disastro", weight: 5, data: -10 },
    { label: "Scarso", weight: 12, data: -6 },
    { label: "Sotto la media", weight: 20, data: -3 },
    { label: "Nella media", weight: 26, data: 0 },
    { label: "Solido", weight: 20, data: 3, lucky: true },
    { label: "Ottimo", weight: 12, data: 6, lucky: true },
    { label: "Eccellenza", weight: 5, data: 10, lucky: true },
  ],
});

export const WHEELS: Record<string, Wheel> = {
  citta: {
    id: "citta", question: "Dove nasce il tuo club?", title: "Città", subtitle: "Dove nasce il tuo club", emoji: "📍", palette: "teal",
    segments: [
      ...CITIES.map(([c, r]) => ({ label: c, weight: 1, data: r })),
      { label: "Paesino di 800 abitanti", weight: 0.6, data: "" },
    ],
  },
  blasone: {
    id: "blasone", question: "Quanta storia ha il tuo club?", title: "Blasone", subtitle: "La storia decide il livello di partenza", emoji: "🏛️", palette: "purple",
    segments: [
      { label: "Neopromossa", weight: 25, data: 58 },
      { label: "Provinciale", weight: 30, data: 63 },
      { label: "Metà classifica", weight: 20, data: 67 },
      { label: "Nobile decaduta", weight: 12, data: 70 },
      { label: "Ambiziosa", weight: 9, data: 73, lucky: true },
      { label: "Big storica", weight: 4, data: 77, lucky: true },
    ],
  },
  rep_por: repartoWheel("por"),
  rep_dif: repartoWheel("dif"),
  rep_cen: repartoWheel("cen"),
  rep_att: repartoWheel("att"),
  rep_pan: repartoWheel("pan"),
  rep_all: repartoWheel("all"),
  stile: {
    id: "stile", question: "Che tipo di allenatore hai?", title: "Stile dell'allenatore", subtitle: "Come vuole giocare la tua squadra", emoji: "🧠", palette: "blue",
    segments: [
      { label: "Difensivista", weight: 20, data: ["difensivista", "5-3-2"] },
      { label: "Giochista", weight: 20, data: ["giochista", "4-3-3"] },
      { label: "Sergente", weight: 18, data: ["sergente", "4-4-2"] },
      { label: "Motivatore", weight: 18, data: ["motivatore", "4-2-3-1"] },
      { label: "Camaleonte", weight: 14, data: ["camaleonte", "tutti"], lucky: true },
      { label: "Visionario", weight: 8, data: ["visionario", "3-4-3"], lucky: true },
      { label: "Ex bandiera senza patentino", weight: 2, data: ["bandiera", "4-4-2"] },
    ],
  },
  budget: {
    id: "budget", question: "Quanti soldi ha la società?", title: "Budget", subtitle: "Milioni di euro per la stagione", emoji: "💰", palette: "gold",
    segments: [
      { label: "Società in crisi · 5 M€", weight: 15, data: 5 },
      { label: "Bilancio stretto · 15 M€", weight: 25, data: 15 },
      { label: "Gestione sana · 30 M€", weight: 25, data: 30 },
      { label: "Imprenditore locale · 60 M€", weight: 18, data: 60, lucky: true },
      { label: "Fondo americano · 120 M€", weight: 12, data: 120, lucky: true },
      { label: "Proprietario miliardario · 250 M€", weight: 4, data: 250, lucky: true },
      { label: "Proprietà petrolifera · 400 M€", weight: 1, data: 400, lucky: true },
    ],
  },
  stadio: {
    id: "stadio", question: "Dove giochi in casa?", title: "Stadio", subtitle: "Più posti, più incassi", emoji: "🏟️", palette: "pitch",
    segments: [
      { label: "Campo parrocchiale", weight: 5, data: 0.3 },
      { label: "Comunale da 8.000", weight: 25, data: 0.8 },
      { label: "Stadio da 15.000", weight: 30, data: 1.5 },
      { label: "Stadio da 30.000", weight: 25, data: 3, lucky: true },
      { label: "Stadio da 50.000", weight: 12, data: 5, lucky: true },
      { label: "Stadio da 80.000", weight: 3, data: 8, lucky: true },
    ],
  },
  tifoseria: {
    id: "tifoseria", question: "Che tifosi hai?", title: "Tifoseria", subtitle: "Il fattore campo", emoji: "📣", palette: "red",
    segments: [
      { label: "Fredda", weight: 20, data: [0, 0] },
      { label: "Normale", weight: 35, data: [2, 0] },
      { label: "Calda", weight: 25, data: [3, 0], lucky: true },
      { label: "Ultras", weight: 15, data: [4, 0], lucky: true },
      { label: "Gemellata con tutti", weight: 4, data: [2, 10] },
      { label: "Contro la proprietà", weight: 1, data: [0, -15] },
    ],
  },
  fuoriclasse: {
    id: "fuoriclasse", question: "Hai un fuoriclasse in rosa?", title: "Fuoriclasse", subtitle: "Il giocatore che fa la differenza", emoji: "⭐", palette: "gold",
    segments: [
      { label: "Nessun fuoriclasse", weight: 15, data: 0 },
      { label: "Buon giocatore", weight: 40, data: 1 },
      { label: "Titolare in Nazionale", weight: 30, data: 2, lucky: true },
      { label: "Campione", weight: 12, data: 3, lucky: true },
      { label: "Pallone d'Oro a fine carriera", weight: 3, data: 4, lucky: true },
    ],
  },
  ruolo: {
    id: "ruolo", question: "In che ruolo gioca la tua stella?", title: "Ruolo del fuoriclasse", subtitle: "Dove gioca la tua stella", emoji: "👟", palette: "teal",
    segments: [
      { label: "Portiere", weight: 10, data: "por" },
      { label: "Difensore", weight: 25, data: "dif" },
      { label: "Centrocampista", weight: 30, data: "cen" },
      { label: "Attaccante", weight: 35, data: "att" },
    ],
  },
  sponsor: {
    id: "sponsor", question: "Chi c'è sulla maglia?", title: "Sponsor di maglia", subtitle: "Chi paga la maglia", emoji: "👕", palette: "blue",
    segments: [
      { label: "Mobilificio Bianchi", weight: 12, data: 0 },
      { label: "Pizzeria Da Gino", weight: 12, data: 0 },
      { label: "Autofficina Moretti", weight: 12, data: 0 },
      { label: "Caseificio Valserchio", weight: 12, data: 0 },
      { label: "Termoidraulica Fanucci", weight: 12, data: 0 },
      { label: "Gelateria Polare", weight: 12, data: 0 },
      { label: "Agenzia Viaggi Altrove", weight: 12, data: 0 },
      { label: "Panificio Il Forno", weight: 13, data: 0 },
      { label: "Sponsor imbarazzante: Onoranze Sereni", weight: 3, data: 20 },
    ],
  },
  lucky: {
    id: "lucky", question: "Che premio ti porti a casa?", title: "Lucky Streak", subtitle: "Ruota segreta: 3 spin fortunati di fila", emoji: "🎉", palette: "gold",
    segments: [
      { label: "Rinforzo +5", weight: 30, data: "rinforzo" },
      { label: "Iniezione di capitale +50 M€", weight: 25, data: "capitale" },
      { label: "Promozione del fuoriclasse", weight: 15, data: "promo" },
      { label: "Doppio rinforzo +3 +3", weight: 12, data: "doppio" },
      { label: "Allenatore top", weight: 10, data: "alltop" },
      { label: "Max out", weight: 6, data: "maxout" },
      { label: "Stadio nuovo da 80.000", weight: 2, data: "stadio" },
    ],
  },
  reparto_caso: {
    id: "reparto_caso", question: "Dove cade il premio?", title: "Reparto a caso", subtitle: "Dove cade il premio", emoji: "🎲", palette: "rainbow",
    segments: (["por", "dif", "cen", "att", "pan", "all"] as Reparto[]).map((r) => ({ label: REPARTO_LABEL[r], weight: 1, data: r })),
  },
};

export const INITIAL_QUEUE = [
  "citta", "blasone", "rep_por", "rep_dif", "rep_cen", "rep_att", "rep_pan", "rep_all",
  "stile", "budget", "stadio", "tifoseria", "fuoriclasse", "sponsor",
];

export const FUORI_BONUS = [0, 3, 5, 8, 10];
export const FUORI_LABEL = ["Nessun fuoriclasse", "Buon giocatore", "Titolare in Nazionale", "Campione", "Pallone d'Oro a fine carriera"];

export function newCreation(): CreationState {
  return {
    queue: [...INITIAL_QUEUE],
    done: [],
    streak: 0,
    luckyCount: 0,
    pendingReparto: null,
    draft: { repMods: {}, moraleBonus: 0, luckyOps: [], notes: [] },
  };
}

function countsForStreak(w: Wheel) {
  return w.segments.some((s) => s.lucky);
}

/** Esegue il prossimo spin della coda. Muta lo stato e ritorna il record. */
export function doSpin(state: CreationState, rng: Rng): { record: SpinRecord; wheel: Wheel; combo: boolean } | null {
  const wheelId = state.queue.shift();
  if (!wheelId) return null;
  const wheel = WHEELS[wheelId];
  const index = rng.weighted(wheel.segments);
  const seg = wheel.segments[index];
  const d = state.draft;
  let note: string | undefined;

  switch (wheelId) {
    case "citta":
      d.city = seg.label;
      d.region = seg.data;
      if (!seg.data) { d.moraleBonus += 10; note = "Il pubblico del paese vi adora: +10 morale"; }
      break;
    case "blasone":
      d.blasone = seg.label;
      d.base = seg.data;
      break;
    case "stile": {
      const [style, mod] = seg.data as [CoachStyle, Modulo | "tutti"];
      d.coachStyle = style;
      d.coachLabel = seg.label;
      d.preferredModule = mod;
      if (style === "bandiera") { d.repMods.all = (d.repMods.all ?? 0) - 10; d.moraleBonus += 20; note = "Allenatore −10, ma morale +20"; }
      break;
    }
    case "budget":
      d.budget = seg.data;
      break;
    case "stadio":
      d.stadium = { label: seg.label, incasso: seg.data, idx: index };
      break;
    case "tifoseria": {
      let [campo, morale] = seg.data as [number, number];
      let label = seg.label;
      if (d.blasone === "Nobile decaduta" && campo < 3 && morale === 0) {
        label = "Calda"; campo = 3; note = "Nobile decaduta: la tifoseria è almeno Calda";
      }
      d.fans = { label, campo, ultras: label === "Ultras" };
      d.moraleBonus += morale;
      break;
    }
    case "fuoriclasse":
      d.fuoriLevel = seg.data;
      if (seg.data > 0) state.queue.unshift("ruolo");
      break;
    case "ruolo":
      d.fuoriRuolo = seg.data;
      break;
    case "sponsor":
      d.sponsor = seg.label.replace("Sponsor imbarazzante: ", "");
      if (seg.data) { d.luckyOps.push({ kind: "budget", delta: seg.data }); note = "Sponsor imbarazzante: +20 M€"; }
      break;
    case "lucky": {
      const p = seg.data as string;
      if (p === "rinforzo") { state.pendingReparto = { kind: "add", delta: 5, times: 1 }; state.queue.unshift("reparto_caso"); }
      if (p === "doppio") { state.pendingReparto = { kind: "add", delta: 3, times: 2 }; state.queue.unshift("reparto_caso", "reparto_caso"); }
      if (p === "maxout") { state.pendingReparto = { kind: "set", value: 95 }; state.queue.unshift("reparto_caso"); }
      if (p === "capitale") d.luckyOps.push({ kind: "budget", delta: 50 });
      if (p === "promo") d.luckyOps.push({ kind: "fuoriPromo" });
      if (p === "alltop") d.luckyOps.push({ kind: "set", rep: "all", value: 90 });
      if (p === "stadio") d.luckyOps.push({ kind: "stadio" });
      d.notes.push(`Lucky Streak: ${seg.label}`);
      break;
    }
    case "reparto_caso": {
      const rep = seg.data as Reparto;
      const pr = state.pendingReparto;
      if (pr) {
        let op: LuckyOp;
        if (pr.kind === "add") { op = { kind: "add", rep, delta: pr.delta }; pr.times--; if (pr.times <= 0) state.pendingReparto = null; }
        else { op = { kind: "set", rep, value: pr.value }; state.pendingReparto = null; }
        d.luckyOps.push(op);
        note = op.kind === "add" ? `+${op.delta} a ${REPARTO_LABEL[rep]}` : `${REPARTO_LABEL[rep]} portato a ${op.value}`;
      }
      break;
    }
    default:
      if (wheelId.startsWith("rep_")) {
        const rep = wheelId.slice(4) as Reparto;
        d.repMods[rep] = (d.repMods[rep] ?? 0) + seg.data;
      }
  }

  // Lucky streak
  let combo = false;
  const lucky = !!seg.lucky;
  if (countsForStreak(wheel)) {
    if (lucky) {
      state.streak++;
      if (state.streak >= 3 && state.luckyCount < 2) {
        state.streak = 0;
        state.luckyCount++;
        state.queue.unshift("lucky");
        combo = true;
      }
    } else state.streak = 0;
  }

  const record: SpinRecord = { wheel: wheelId, index, label: seg.label, lucky, note };
  state.done.push(record);
  return { record, wheel, combo };
}
