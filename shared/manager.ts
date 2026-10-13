// Gestione del club tra una giornata e l'altra: dilemmi, allenamento, investimenti, pronostici.
import type { Club, ClubState, DilemmaPick, Reparto, Training } from "./types";
import { REPARTO_LABEL } from "./types";
import { clamp } from "./club";
import type { Rng } from "./rng";
import { makeRng } from "./rng";
import { sellFuoriclasse } from "./league";

type Ctx = { c: Club; s: ClubState; md: number; rng: Rng; medico: boolean };
type Option = { label: string; desc: string; cost?: number; apply: (x: Ctx) => string };
export type Dilemma = { id: string; icon: string; title: string; text: string; options: Option[]; def: number; when?: (c: Club, s: ClubState) => boolean };

const mor = (s: ClubState, d: number) => { s.morale = clamp(s.morale + d, 0, 100); };
const cond = (s: ClubState, d: number) => { s.cond = clamp(s.cond + d, 0, 100); };
const money = (s: ClubState, d: number) => { s.budget = Math.round((s.budget + d) * 10) / 10; };
const injDur = (x: Ctx) => (x.medico ? 2 : 3);
const REPS: Reparto[] = ["por", "dif", "cen", "att"];

export const DILEMMAS: Dilemma[] = [
  { id: "amichevole", icon: "✈️", title: "Amichevole all'estero", text: "Uno sponsor offre 15 M€ per un'amichevole in Arabia a metà settimana.", def: 1, options: [
    { label: "Accetta", desc: "+15 M€, condizione −10", apply: ({ s }) => { money(s, 15); cond(s, -10); return "Incassati 15 M€, ma le gambe sono pesanti."; } },
    { label: "Rifiuta", desc: "Nessun effetto", apply: () => "La squadra resta a casa ad allenarsi." },
  ] },
  { id: "aumento", icon: "💼", title: "Il capitano chiede l'aumento", text: "Il capitano bussa alla porta del presidente: vuole un ritocco dell'ingaggio.", def: 1, options: [
    { label: "Paga 8 M€", desc: "Morale +5", cost: 8, apply: ({ s }) => { money(s, -8); mor(s, 5); return "Capitano soddisfatto, spogliatoio sereno."; } },
    { label: "Rifiuta", desc: "Morale −8", apply: ({ s }) => { mor(s, -8); return "Il capitano tiene il muso. Morale −8."; } },
  ] },
  { id: "fastidio", icon: "🩹", title: "Fastidio muscolare del fuoriclasse", text: "Il fuoriclasse sente tirare il flessore. Il medico è prudente, lui vuole giocare.", def: 1, when: (c) => !!c.fuoriclasse, options: [
    { label: "Gioca", desc: "30% di infortunio per 3 giornate", apply: (x) => {
      const f = x.c.fuoriclasse!;
      if (x.rng.chance(0.3)) { x.s.modifiers.push({ rep: f.ruolo, delta: -f.bonus, untilMatchday: x.md + injDur(x) - 1, label: "Fuoriclasse infortunato" }); return `Ahia: ${f.name} si fa male, fuori per ${injDur(x)} giornate.`; }
      return `${f.name} stringe i denti e sta bene.`;
    } },
    { label: "Riposa", desc: "Niente bonus del fuoriclasse nella prossima", apply: (x) => { const f = x.c.fuoriclasse!; x.s.modifiers.push({ rep: f.ruolo, delta: -f.bonus, untilMatchday: x.md, label: "Fuoriclasse a riposo" }); return `${f.name} resta in tribuna per precauzione.`; } },
  ] },
  { id: "ultras", icon: "📣", title: "Gli ultras chiedono un incontro", text: "La curva vuole parlare con l'allenatore prima della prossima partita.", def: 1, options: [
    { label: "Vai", desc: "Fattore campo +2 nella prossima in casa", apply: ({ s }) => { s.homeBoost = 2; return "La curva promette una bolgia alla prossima in casa."; } },
    { label: "Declina", desc: "Morale −5", apply: ({ s }) => { mor(s, -5); return "Striscione polemico al campo d'allenamento. Morale −5."; } },
  ] },
  { id: "prova", icon: "🌱", title: "Un ragazzo in prova", text: "Un procuratore propone un giovane talento: 10 M€ per tesserarlo.", def: 1, options: [
    { label: "Prendilo", desc: "10 M€, 50% di +2 alla Panchina", cost: 10, apply: ({ s, rng }) => { money(s, -10); if (rng.chance(0.5)) { s.ratings.pan = clamp(s.ratings.pan + 2, 40, 99); return "Colpo! Il ragazzo è forte: Panchina +2."; } return "Il ragazzo non è ancora pronto. Soldi spesi."; } },
    { label: "Lascialo andare", desc: "Nessun effetto", apply: () => "Il procuratore bussa a un'altra porta." },
  ] },
  { id: "ritiro", icon: "🏨", title: "Dopo la sconfitta", text: "La sconfitta brucia. Ritiro punitivo o giorno libero?", def: 1, when: (_c, s) => s.lastResults.at(-1) === "P", options: [
    { label: "Ritiro punitivo", desc: "Morale −5, condizione +8", apply: ({ s }) => { mor(s, -5); cond(s, 8); return "Tutti in ritiro: musi lunghi ma gambe fresche."; } },
    { label: "Giorno libero", desc: "Morale +5", apply: ({ s }) => { mor(s, 5); return "Giorno libero: si riparte col sorriso."; } },
  ] },
  { id: "giornalista", icon: "🎤", title: "Il giornalista provoca", text: "In conferenza un giornalista dice che la tua squadra «gioca un calcio da oratorio».", def: 1, options: [
    { label: "Rispondi a tono", desc: "Morale +5, 25% di multa da 3 M€", apply: ({ s, rng }) => { mor(s, 5); if (rng.chance(0.25)) { money(s, -3); return "Risposta memorabile… e multa da 3 M€."; } return "Risposta memorabile, lo spogliatoio applaude."; } },
    { label: "No comment", desc: "Nessun effetto", apply: () => "Sorriso di circostanza e via." },
  ] },
  { id: "tv", icon: "📺", title: "Intervista in TV", text: "Una TV locale vuole l'allenatore in studio per una sera.", def: 1, options: [
    { label: "Partecipa", desc: "+3 M€, morale +2", apply: ({ s }) => { money(s, 3); mor(s, 2); return "Ascolti record: +3 M€."; } },
    { label: "Rifiuta", desc: "Nessun effetto", apply: () => "L'allenatore preferisce studiare l'avversario." },
  ] },
  { id: "porte_aperte", icon: "🎟️", title: "Allenamento a porte aperte", text: "I tifosi chiedono di assistere all'allenamento.", def: 1, options: [
    { label: "Apri le porte", desc: "Morale +6, condizione −5", apply: ({ s }) => { mor(s, 6); cond(s, -5); return "Festa al campo, ma l'allenamento è più intenso del previsto."; } },
    { label: "Porte chiuse", desc: "Nessun effetto", apply: () => "Allenamento tranquillo." },
  ] },
  { id: "festa", icon: "🪩", title: "Il bomber in discoteca", text: "Foto del tuo attaccante in discoteca alle 3 di notte girano sui social.", def: 0, options: [
    { label: "Punisci", desc: "Morale −4", apply: ({ s }) => { mor(s, -4); return "Multa e panchina morale. Lo spogliatoio prende nota."; } },
    { label: "Chiudi un occhio", desc: "40% Attacco −4 nella prossima, altrimenti morale +4", apply: (x) => { if (x.rng.chance(0.4)) { x.s.modifiers.push({ rep: "att", delta: -4, untilMatchday: x.md, label: "Bomber stanco" }); return "Il bomber è a pezzi: Attacco −4 nella prossima."; } mor(x.s, 4); return "Nessuna conseguenza e gruppo più unito. Morale +4."; } },
  ] },
  { id: "nutrizionista", icon: "🥗", title: "Nuovo nutrizionista", text: "Un nutrizionista famoso propone un piano per la squadra: 6 M€.", def: 1, options: [
    { label: "Ingaggialo", desc: "6 M€, condizione +10", cost: 6, apply: ({ s }) => { money(s, -6); cond(s, 10); return "Via i carboidrati della sera: condizione +10."; } },
    { label: "No grazie", desc: "Nessun effetto", apply: () => "Si continua con la pasta in bianco." },
  ] },
  { id: "sceicco", icon: "🛢️", title: "Offerta dallo sceicco", text: "Un club arabo offre 80 M€ per il tuo fuoriclasse.", def: 1, when: (c) => !!c.fuoriclasse, options: [
    { label: "Vendi", desc: "+80 M€, perdi il fuoriclasse", apply: ({ c, s }) => { const n = c.fuoriclasse!.name; sellFuoriclasse(c, s); money(s, 20); return `${n} parte per il deserto: +80 M€.`; } },
    { label: "Rifiuta", desc: "Morale +5", apply: ({ s }) => { mor(s, 5); return "«Non è in vendita». I tifosi esultano: morale +5."; } },
  ] },
  { id: "preparatore", icon: "🏋️", title: "Preparatore atletico", text: "Si libera un preparatore di livello: 12 M€.", def: 1, options: [
    { label: "Ingaggialo", desc: "12 M€, condizione +15", cost: 12, apply: ({ s }) => { money(s, -12); cond(s, 15); return "Nuovi carichi di lavoro: condizione +15."; } },
    { label: "No grazie", desc: "Nessun effetto", apply: () => "Resta il vecchio preparatore." },
  ] },
  { id: "voci", icon: "🗞️", title: "Voci di spogliatoio", text: "Si parla di un gruppetto che rema contro l'allenatore.", def: 1, options: [
    { label: "Riunione chiarificatrice", desc: "Morale −3, poi tutto tranquillo", apply: ({ s }) => { mor(s, -3); return "Due ore di riunione: morale −3, ma aria più pulita."; } },
    { label: "Ignora", desc: "20% di morale −10", apply: ({ s, rng }) => { if (rng.chance(0.2)) { mor(s, -10); return "La situazione esplode: morale −10."; } return "Le voci si spengono da sole."; } },
  ] },
  { id: "benefica", icon: "🤝", title: "Partita benefica", text: "Il comune chiede una partita di beneficenza con le vecchie glorie.", def: 1, options: [
    { label: "Partecipa", desc: "Morale +8, condizione −5", apply: ({ s }) => { mor(s, 8); cond(s, -5); return "Bella serata per la città: morale +8."; } },
    { label: "Declina", desc: "Nessun effetto", apply: () => "Si manda un pallone autografato." },
  ] },
  { id: "maglia", icon: "👕", title: "Maglia celebrativa", text: "Il marketing propone una maglia retrò: costa 5 M€ produrla.", def: 1, options: [
    { label: "Producila", desc: "5 M€, 50% di incassare 12 M€", cost: 5, apply: ({ s, rng }) => { money(s, -5); if (rng.chance(0.5)) { money(s, 12); return "Sold out! +12 M€ di vendite."; } return "Magazzini pieni di maglie invendute."; } },
    { label: "Lascia perdere", desc: "Nessun effetto", apply: () => "La maglia resta nel cassetto." },
  ] },
  { id: "analista", icon: "📊", title: "Analista video", text: "Un analista offre uno studio dettagliato del prossimo avversario: 8 M€.", def: 1, options: [
    { label: "Compra lo studio", desc: "8 M€, Attacco, Centrocampo e Difesa +2 nella prossima", cost: 8, apply: (x) => { money(x.s, -8); for (const r of ["att", "cen", "dif"] as Reparto[]) x.s.modifiers.push({ rep: r, delta: 2, untilMatchday: x.md, label: "Studio avversario" }); return "Avversario studiato al millimetro: +2 ai reparti di campo nella prossima."; } },
    { label: "Ci pensiamo noi", desc: "Nessun effetto", apply: () => "Si guarda la partita in TV, come sempre." },
  ] },
  { id: "influencer", icon: "📱", title: "Un influencer al campo", text: "Un influencer da 2 milioni di follower vuole girare un video con la squadra.", def: 1, options: [
    { label: "Ospitalo", desc: "+4 M€, morale −3", apply: ({ s }) => { money(s, 4); mor(s, -3); return "Video virale (+4 M€), ma che distrazione."; } },
    { label: "Niente video", desc: "Nessun effetto", apply: () => "Allenamento lontano dai telefoni." },
  ] },
  { id: "lite_vice", icon: "😤", title: "Lite con il vice", text: "L'allenatore e il suo vice litigano davanti a tutti.", def: 1, options: [
    { label: "Via il vice", desc: "Allenatore −1, morale +6", apply: ({ s }) => { s.ratings.all = clamp(s.ratings.all - 1, 40, 99); mor(s, 6); return "Il vice se ne va: Allenatore −1, ma tensione sparita (morale +6)."; } },
    { label: "Fate pace", desc: "Morale −4", apply: ({ s }) => { mor(s, -4); return "Stretta di mano gelida. Morale −4."; } },
  ] },
  { id: "doppio_allenamento", icon: "⏱️", title: "Doppio allenamento", text: "Lo staff propone una doppia seduta per preparare la partita.", def: 1, options: [
    { label: "Doppia seduta", desc: "Reparto a caso +2 nella prossima, condizione −8", apply: (x) => { const r = x.rng.pick(REPS); x.s.modifiers.push({ rep: r, delta: 2, untilMatchday: x.md, label: "Lavoro specifico" }); cond(x.s, -8); return `${REPARTO_LABEL[r]} +2 nella prossima, ma condizione −8.`; } },
    { label: "Seduta normale", desc: "Nessun effetto", apply: () => "Allenamento di routine." },
  ] },
];

export const DILEMMA_BY_ID = new Map(DILEMMAS.map((d) => [d.id, d]));

/** Pesca 2 dilemmi deterministici per club e giornata. */
export function dealDilemmas(seed: string, c: Club, s: ClubState, md: number): DilemmaPick[] {
  const rng = makeRng(`dil:${seed}:${md}`);
  const pool = DILEMMAS.filter((d) => !d.when || d.when(c, s));
  const out: DilemmaPick[] = [];
  while (out.length < 2 && pool.length) {
    const i = Math.floor(rng.next() * pool.length);
    out.push({ id: pool[i].id, choice: null });
    pool.splice(i, 1);
  }
  return out;
}

export function applyDilemma(c: Club, s: ClubState, pick: DilemmaPick, option: number, md: number, rng: Rng): string {
  const d = DILEMMA_BY_ID.get(pick.id);
  if (!d) throw new Error("Dilemma sconosciuto.");
  const opt = d.options[option];
  if (!opt) throw new Error("Opzione non valida.");
  if (opt.cost && s.budget < opt.cost) throw new Error(`Servono ${opt.cost} M€, ne hai ${s.budget}.`);
  if (d.when && !d.when(c, s)) { pick.choice = option; pick.result = "La situazione si è risolta da sola."; return pick.result; }
  const res = opt.apply({ c, s, md, rng, medico: !!s.investments?.includes("medico") });
  pick.choice = option;
  pick.result = res;
  return res;
}

export const TRAININGS: { id: Training; icon: string; label: string; desc: string }[] = [
  { id: "fisico", icon: "🏃", label: "Fisico", desc: "+3 di recupero della condizione ogni giornata" },
  { id: "tattica", icon: "📋", label: "Tattica", desc: "+1 ad Attacco, Centrocampo e Difesa in partita" },
  { id: "tecnica", icon: "⚽", label: "Tecnica", desc: "Ogni 3 giornate +1 permanente al reparto scelto" },
  { id: "gruppo", icon: "🤝", label: "Gruppo", desc: "+3 morale ogni giornata" },
];

export const INVESTMENTS: { id: string; icon: string; label: string; cost: number; desc: string }[] = [
  { id: "curva", icon: "🏟️", label: "Curva nuova", cost: 20, desc: "Fattore campo +1" },
  { id: "giovanile", icon: "🌱", label: "Settore giovanile", cost: 20, desc: "Ogni 4 giornate, 25% di talento (+2 a un reparto)" },
  { id: "medico", icon: "🩺", label: "Centro medico", cost: 25, desc: "Infortuni più brevi di 1 giornata, recupero +2" },
  { id: "stadio", icon: "🏗️", label: "Ampliamento stadio", cost: 30, desc: "Stadio al livello successivo, più incassi" },
  { id: "staff", icon: "🧠", label: "Staff tattico", cost: 35, desc: "Allenatore +2 permanente" },
];

const STADIUMS: [string, number][] = [["Campo parrocchiale", 0.3], ["Comunale da 8.000", 0.8], ["Stadio da 15.000", 1.5], ["Stadio da 30.000", 3], ["Stadio da 50.000", 5], ["Stadio da 80.000", 8]];

export function buyInvestment(c: Club, s: ClubState, id: string): string {
  const inv = INVESTMENTS.find((x) => x.id === id);
  if (!inv) throw new Error("Investimento sconosciuto.");
  s.investments = s.investments ?? [];
  if (s.investments.includes(id)) throw new Error("Già fatto.");
  if (s.budget < inv.cost) throw new Error(`Servono ${inv.cost} M€, ne hai ${s.budget}.`);
  if (id === "stadio") {
    const i = STADIUMS.findIndex(([, v]) => v >= c.stadium.incasso);
    if (i >= STADIUMS.length - 1) throw new Error("Lo stadio è già il più grande.");
    const [label, incasso] = STADIUMS[i + 1];
    c.stadium = { label, incasso };
  }
  if (id === "staff") s.ratings.all = clamp(s.ratings.all + 2, 40, 99);
  money(s, -inv.cost);
  s.investments.push(id);
  return `${inv.label}: fatto.`;
}

/** Effetti di allenamento e investimenti dopo ogni giornata. Ritorna eventuali notizie. */
export function dayAfter(c: Club, s: ClubState, md: number, rng: Rng): string[] {
  const news: string[] = [];
  const t = s.training;
  if (t === "fisico") cond(s, 3);
  if (t === "gruppo") mor(s, 3);
  if (t === "tecnica") {
    s.tecnicaCount = (s.tecnicaCount ?? 0) + 1;
    if (s.tecnicaCount >= 3) {
      const r = s.tecnicaRep ?? "att";
      s.ratings[r] = clamp(s.ratings[r] + 1, 40, 99);
      s.tecnicaCount = 0;
      news.push(`${c.name}: il lavoro tecnico paga, ${REPARTO_LABEL[r]} +1.`);
    }
  }
  if (s.investments?.includes("medico")) cond(s, 2);
  if (s.investments?.includes("giovanile") && md % 4 === 0 && rng.chance(0.25)) {
    const r = rng.pick(REPS);
    s.ratings[r] = clamp(s.ratings[r] + 2, 40, 99);
    news.push(`${c.name}: dal settore giovanile sale un talento, ${REPARTO_LABEL[r]} +2.`);
  }
  return news;
}

/** Scelte automatiche delle CPU. */
export function cpuManage(c: Club, s: ClubState) {
  s.training = s.cond < 70 ? "fisico" : "tattica";
  for (const id of ["staff", "curva", "medico"]) {
    const inv = INVESTMENTS.find((x) => x.id === id)!;
    if (!s.investments?.includes(id) && s.budget >= inv.cost + 30) { try { buyInvestment(c, s, id); } catch { /* ignora */ } break; }
  }
}

export function predictionPoints(p: ClubState["predictions"], results: Map<string, [number, number]>): number {
  if (!p) return 0;
  let pts = 0;
  for (const [mid, pick] of Object.entries(p.picks)) {
    const r = results.get(mid);
    if (!r) continue;
    const sign = r[0] > r[1] ? "1" : r[0] < r[1] ? "2" : "X";
    if (sign === pick) pts += 1;
  }
  if (p.exact) { const r = results.get(p.exact.matchId); if (r && r[0] === p.exact.h && r[1] === p.exact.a) pts += 3; }
  return pts;
}

export const PRESS_TONES = [
  { id: "umile", label: "Umile", desc: "Morale +2. Nessun rischio." },
  { id: "provocatoria", label: "Provocatoria", desc: "Se vinci: morale +8 e avversario −5. Se perdi: morale −8." },
  { id: "silenzio", label: "Silenzio stampa", desc: "Nessun effetto." },
] as const;
