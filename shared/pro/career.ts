// Carriera giocatore: stato, creazione, stagione (a blocchi), momenti, mercato, crescita, premi.
import { makeRng, randomToken, type Rng } from "../rng";
import { CLUBS, CLUB_BY_ID, CL_SPOTS, LEAGUES, NATION_BY_ID, TABLE_LEAGUES, clubsOf, type LeagueCode, type ProClub } from "./data";
import { goalWheel, proWheel, SUMMER_WHEELS, TOURNAMENT_WHEEL, type Role } from "./wheels";
import type { Wheel } from "../wheels";

export const START_YEAR = 2026;
const clampN = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

export type Pro = {
  name: string; number: number; nation: string; role: Role; sub: string; spec: string; foot: string;
  height: number; speed: number; stamina: number; power: number; character: string;
  talent: number; pot: number; ovr: number; age: number; traits: string[];
};

export type Stats = { apps: number; starts: number; minutes: number; goals: number; assists: number; rSum: number; rN: number; cs: number; yellow: number; red: number; injuredMatches: number; yApps?: number; yGoals?: number; yAssists?: number };
const emptyStats = (): Stats => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, rSum: 0, rN: 0, cs: 0, yellow: 0, red: 0, injuredMatches: 0, yApps: 0, yGoals: 0, yAssists: 0 });

export type Fixture = { round: number; home: string; away: string; hg?: number; ag?: number; me?: { min: number; g: number; a: number; r: number } };
export type Row = { id: string; name: string; pt: number; g: number; gf: number; gs: number };
export type Status = "giovanili" | "riserva" | "rotazione" | "titolare";
export const STATUS_LABEL: Record<Status, string> = { giovanili: "Primavera", riserva: "Riserva", rotazione: "Rotazione", titolare: "Titolare" };

export type Offer = { clubId: string; status: Status; years: number; salary: number; loan?: boolean; note?: string; stay?: boolean };
export type Moment = { id: string; title: string; text: string; icon: string; options: { label: string; desc: string }[] };
export type SeasonRec = {
  year: number; age: number; clubId: string; league: LeagueCode; status: Status; ovr: number; stats: Stats; avg: number;
  pos: number | null; n: number; trophies: string[]; goal: string; goalOk: boolean; loan?: boolean;
};

export type Clou = {
  fixtureIdx: number; opp: string; home: boolean; title: string; step: number;
  score: [number, number]; // [noi, loro]
  base: [number, number]; // gol "di squadra" già decisi
  actions: { minute: number; sit: string; choices: { id: string; label: string; pct: number }[]; result?: string; good?: boolean }[];
  mine: { g: number; a: number; saves: number; err: number };
};

export type ProState = {
  v: 1; id: string;
  phase: "creation" | "name" | "summer" | "season" | "moment" | "clou" | "end" | "offers" | "retired";
  creation: { queue: string[]; done: { wheel: string; label: string; note?: string }[]; draft: Partial<Pro> & { traitsTmp?: string[] } };
  p: Pro;
  clubId: string; contractYears: number; salary: number; loanFrom?: string | null;
  status: Status; rel: number; morale: number; form: number;
  year: number; season: number;
  strengths: Record<string, number>;
  lastTables: Partial<Record<LeagueCode, Row[]>>;
  // stagione in corso
  fixtures: Fixture[]; segment: number; stats: Stats; injury: number; goal: { label: string; kind: string; n: number } | null;
  wheels: string[]; moment: Moment | null; momentsSeen: string[]; clou: Clou | null; clouRound: number;
  promisedOffer?: string | null;
  // fine stagione
  report: any | null; offers: Offer[];
  history: SeasonRec[];
  trophies: { league: number; cl: number; ballon: number; topScorer: number; caps: number; intlGoals: number; intl: string[]; cups: string[] };
  news: string[];
};

/* ---------------- creazione ---------------- */

const CREATION = ["nazione", "ruolo", "tipo", "spec", "piede", "altezza", "velocita", "resistenza", "forza", "carattere", "talento", "potenziale", "vivaio"];

export function newPro(): ProState {
  return {
    v: 1, id: randomToken(8), phase: "creation",
    creation: { queue: [...CREATION], done: [], draft: { traits: [] } },
    p: null as unknown as Pro, clubId: "", contractYears: 3, salary: 0.1, status: "giovanili", rel: 50, morale: 60, form: 0,
    year: START_YEAR, season: 1, strengths: Object.fromEntries(CLUBS.map((c) => [c.id, c.strength])), lastTables: {},
    fixtures: [], segment: 0, stats: emptyStats(), injury: 0, goal: null, wheels: [], moment: null, momentsSeen: [], clou: null, clouRound: 0,
    report: null, offers: [], history: [], trophies: { league: 0, cl: 0, ballon: 0, topScorer: 0, caps: 0, intlGoals: 0, intl: [], cups: [] }, news: [],
  };
}

export function currentWheel(s: ProState): Wheel | null {
  const id = s.phase === "creation" ? s.creation.queue[0] : s.wheels[0];
  if (!id) return null;
  const d = s.creation.draft;
  if (id === "obiettivo") return goalWheel(s.p.role, s.p.sub, s.status === "giovanili");
  if (id === "torneo") return TOURNAMENT_WHEEL(NATION_BY_ID.get(s.p.nation)!.strength);
  if (SUMMER_WHEELS[id]) return SUMMER_WHEELS[id];
  return proWheel(id, { role: d.role as Role, nation: d.nation, sub: d.sub });
}

/** Gira la ruota corrente (creazione, estate o torneo). Ritorna indice, etichetta e nota. */
export function spinPro(s: ProState, rng: Rng): { index: number; label: string; note?: string; special?: string[] } {
  const w = currentWheel(s);
  if (!w) throw new Error("Nessuna ruota da girare");
  const index = rng.weighted(w.segments);
  const seg = w.segments[index];
  let note: string | undefined;
  const unlock: string[] = [];
  if (s.phase === "creation") {
    const d = s.creation.draft;
    switch (w.id) {
      case "nazione": d.nation = seg.data; break;
      case "ruolo": d.role = seg.data; break;
      case "tipo": d.sub = seg.data; break;
      case "spec": d.spec = seg.data; break;
      case "piede": d.foot = seg.data; break;
      case "altezza": d.height = seg.data; break;
      case "velocita": d.speed = seg.data; break;
      case "resistenza": d.stamina = seg.data; break;
      case "forza": d.power = seg.data; break;
      case "carattere": d.character = seg.data; break;
      case "talento": d.talent = seg.data; break;
      case "potenziale": d.pot = Math.max(seg.data, (d.talent ?? 60) + 8); break;
      case "vivaio": s.clubId = seg.data; break;
      default: (d.traits ??= []).push(seg.data); note = undefined;
    }
    // sblocchi
    if (w.id === "forza") {
      if (d.role === "ATT" && (d.height ?? 0) >= 186) unlock.push("sp_torre");
      if ((d.speed ?? 0) >= 4 && (d.role === "ATT" || d.sub === "Terzino" || d.sub === "Mezzala")) unlock.push("sp_freccia");
      if (d.role === "POR" && (d.height ?? 200) <= 184) unlock.push("sp_tascabile");
      if (d.role === "DIF" && (d.height ?? 0) >= 190 && (d.power ?? 0) >= 2) unlock.push("sp_muro");
    }
    if (w.id === "potenziale" && ((d.talent ?? 0) >= 68 || (d.pot ?? 0) >= 93)) unlock.push("sp_fenomeno");
    s.creation.queue.shift();
    if (unlock.length) s.creation.queue.unshift(...unlock);
    s.creation.done.push({ wheel: w.id, label: seg.label, note });
    if (!s.creation.queue.length) s.phase = "name";
    return { index, label: seg.label, note, special: unlock };
  }
  // ruote dell'estate / del torneo
  switch (w.id) {
    case "ritiro":
      s.form = seg.data;
      if (seg.data < 0) { s.injury = 2; note = "Salti le prime 2 giornate"; } else note = seg.data > 0 ? `Forma +${seg.data}` : "Partenza in salita";
      break;
    case "obiettivo": s.goal = { label: seg.label, ...seg.data }; note = "La società ti valuterà su questo."; break;
    case "torneo": {
      const t = seg.data as string;
      const nat = NATION_BY_ID.get(s.p.nation)!;
      const name = s.year % 4 === 2 ? "Mondiale" : nat.league === "BRA" || nat.league === "ARG" ? "Copa América" : "Europeo";
      if (t === "campioni") { s.trophies.cups.push(`${name} ${s.year}`); note = `${nat.name} campione: ${name} vinto!`; }
      else note = { finale: "Finale persa", semi: "Fuori in semifinale", quarti: "Fuori ai quarti", gironi: "Fuori ai gironi" }[t];
      s.trophies.intl.push(`${name} ${s.year}: ${seg.label}`);
      break;
    }
  }
  s.wheels.shift();
  return { index, label: seg.label, note };
}

/** Valutazione iniziale: talento + quanto il fisico si adatta al ruolo + tratti. */
export function fitBonus(d: Partial<Pro>): number {
  let f = 0;
  const h = d.height ?? 180, sp = d.speed ?? 2, pw = d.power ?? 2;
  if (d.role === "POR") f += h >= 190 ? 2 : h <= 180 ? -2 : 0;
  if (d.role === "DIF") f += (h >= 188 ? 1 : h <= 176 ? -1 : 0) + (pw === 3 ? 1 : pw === 1 ? -1 : 0) + (d.sub === "Terzino" && sp >= 3 ? 1 : 0);
  if (d.role === "CEN") f += (d.stamina === 3 ? 1 : d.stamina === 1 ? -1 : 0) + (d.sub === "Mediano" && pw === 3 ? 1 : 0);
  if (d.role === "ATT") f += (sp >= 3 ? 1 : sp === 1 ? -1 : 0) + (d.sub === "Prima punta" && (h >= 186 || pw === 3) ? 1 : 0) + (d.sub === "Ala" && sp === 4 ? 1 : 0);
  if (d.foot === "ambidestro") f += 1;
  const t = d.traits ?? [];
  if (t.includes("tasc_riflessi") || t.includes("muro_insuperabile")) f += 2;
  if (t.includes("tasc_uscite")) f -= 2;
  return clampN(f, -4, 4);
}

export function finishCreation(s: ProState, name: string, number: number) {
  const d = s.creation.draft;
  const ovr = clampN((d.talent ?? 58) + fitBonus(d), 45, 75);
  s.p = {
    name: name.trim() || "Mario Rossi", number: clampN(Math.round(number) || 10, 1, 99), nation: d.nation ?? "ita", role: (d.role ?? "ATT") as Role,
    sub: d.sub ?? "Prima punta", spec: d.spec ?? "", foot: d.foot ?? "destro", height: d.height ?? 180, speed: d.speed ?? 2, stamina: d.stamina ?? 2,
    power: d.power ?? 2, character: d.character ?? "Professionista", talent: d.talent ?? 58, pot: d.pot ?? 80, ovr, age: 17, traits: d.traits ?? [],
  };
  s.status = "giovanili"; s.contractYears = 3; s.salary = 0.1;
  s.news.unshift(`${s.p.name} firma il primo contratto con il settore giovanile del ${CLUB_BY_ID.get(s.clubId)!.name}.`);
  startSummer(s);
}

/* ---------------- stagione ---------------- */

const ROUND_ROBIN = (ids: string[]): [string, string][][] => {
  const n = ids.length + (ids.length % 2);
  const arr = [...ids]; if (arr.length < n) arr.push("__bye");
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; if (a !== "__bye" && b !== "__bye") round.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(round); arr.splice(1, 0, arr.pop()!);
  }
  return [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a] as [string, string]))];
};

/** Squadre del campionato del club: reali + avversari generici per i campionati senza tabella completa. */
function leagueTeams(s: ProState, league: LeagueCode): { id: string; name: string; strength: number }[] {
  const real = clubsOf(league).map((c) => ({ id: c.id, name: c.name, strength: s.strengths[c.id] ?? c.strength }));
  if (LEAGUES[league].table) return real;
  const avg = real.reduce((a, b) => a + b.strength, 0) / real.length;
  const rng = makeRng(`${s.id}:filler:${league}:${s.year}`);
  const filler = Array.from({ length: 18 - real.length }, (_, i) => ({ id: `${league}_f${i}`, name: `Avversaria ${i + 1}`, strength: Math.round(avg - 4 + rng.next() * 6) }));
  for (const f of filler) s.strengths[f.id] = f.strength;
  return [...real, ...filler];
}
const strengthOf = (s: ProState, id: string) => s.strengths[id] ?? 64;

export const myLeague = (s: ProState): LeagueCode => CLUB_BY_ID.get(s.clubId)!.league;

/** Ruolo in rosa in base a valutazione e forza del club. */
export function statusFor(ovr: number, clubStrength: number, age: number): Status {
  const d = ovr - clubStrength;
  if (age <= 18 && d < -10) return "giovanili";
  if (d >= 0) return "titolare";
  if (d >= -4) return "rotazione";
  if (d >= -11) return "riserva";
  return age <= 20 ? "giovanili" : "riserva";
}

export function startSummer(s: ProState) {
  s.phase = "summer";
  s.stats = emptyStats(); s.segment = 0; s.injury = 0; s.form = 0; s.moment = null; s.momentsSeen = []; s.clou = null; s.report = null; s.offers = [];
  s.promisedOffer = null;
  s.wheels = ["ritiro", "obiettivo"];
  if (s.year % 2 === 0 && s.history.length && s.trophies.caps > 0) s.wheels.unshift("torneo");
  const club = CLUB_BY_ID.get(s.clubId)!;
  if (s.history.length === 0) s.status = statusFor(s.p.ovr, s.strengths[s.clubId], s.p.age);
  // calendario del tuo campionato
  const teams = leagueTeams(s, club.league);
  const rng = makeRng(`${s.id}:cal:${s.year}`);
  const ids = teams.map((t) => t.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = rng.int(0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  s.fixtures = ROUND_ROBIN(ids).flatMap((rd, r) => rd.map(([home, away]) => ({ round: r + 1, home, away })));
  const total = Math.max(...s.fixtures.map((f) => f.round));
  // il momento clou: partita contro la rivale più forte nel girone di ritorno
  const mine = s.fixtures.filter((f) => (f.home === s.clubId || f.away === s.clubId) && f.round > total / 2);
  const big = [...mine].sort((a, b) => strengthOf(s, a.home === s.clubId ? a.away : a.home) - strengthOf(s, b.home === s.clubId ? b.away : b.home)).pop();
  s.clouRound = big?.round ?? total;
}

export function totalRounds(s: ProState) { return Math.max(...s.fixtures.map((f) => f.round)); }
export const SEGMENTS = 4;
function segmentEnd(s: ProState, seg: number) { return Math.round((totalRounds(s) * (seg + 1)) / SEGMENTS); }

function poisson(rng: Rng, l: number) { return rng.poisson(Math.max(0.05, l)); }
function xg(a: number, b: number, home: boolean) { return 1.32 * Math.exp((a - b) / 22) * (home ? 1.1 : 0.9); }

/** Quote di gol/assist del giocatore sul totale della squadra, per ruolo e caratteristiche. */
export function shares(p: Pro): { g: number; a: number } {
  const base: Record<string, [number, number]> = {
    "Prima punta": [0.32, 0.08], "Seconda punta": [0.24, 0.14], "Falso nove": [0.22, 0.16], Ala: [0.18, 0.2],
    Trequartista: [0.14, 0.22], Mezzala: [0.09, 0.14], Regista: [0.04, 0.18], Mediano: [0.03, 0.06],
    Terzino: [0.03, 0.12], Centrale: [0.04, 0.02], Libero: [0.03, 0.04], "Classico tra i pali": [0, 0], "Portiere-libero": [0, 0.01],
  };
  let [g, a] = base[p.sub] ?? [0.1, 0.1];
  const t = p.traits, sp = p.spec;
  if (sp === "Colpo di testa" || sp === "Rapace d'area") g += 0.05;
  if (sp === "Tiro a giro" || sp === "Tiro da fuori") g += 0.03;
  if (sp === "Inserimenti") g += 0.04;
  if (sp === "Filtranti" || sp === "Spinta sulla fascia") a += 0.05;
  if (sp === "Gioco aereo") g += 0.03;
  if (t.includes("torre_gol") || t.includes("muro_corner")) g += 0.05;
  if (t.includes("torre_sponda") || t.includes("freccia_dribbling")) a += 0.05;
  if (t.includes("freccia_contro")) g += 0.04;
  return { g, a };
}

function matchRating(rng: Rng, p: Pro, clubS: number, g: number, a: number, won: boolean, lost: boolean, conceded: number, form: number, morale: number): number {
  let r = 6.0 + (p.ovr - clubS) * 0.03 + g * 0.8 + a * 0.45 + (won ? 0.3 : lost ? -0.3 : 0) + form * 0.15 + (morale - 60) / 200 + (rng.next() - 0.5) * 0.9;
  if (p.role === "POR") r += conceded === 0 ? 0.6 : -0.3 * Math.max(0, conceded - 1);
  if (p.role === "DIF") r += conceded === 0 ? 0.35 : -0.15 * Math.max(0, conceded - 1);
  if (p.traits.includes("fen_riflettori")) r = 6.3 + (r - 6.3) * 1.35;
  if (p.traits.includes("torre_lento") && g > 0) r += 0.4;
  if (p.traits.includes("freccia_recupero") && p.role !== "ATT") r += 0.15;
  return clampN(Math.round(r * 2) / 2, 4, 10);
}

/** Probabilità di giocare una partita, da titolare o entrando dalla panchina. */
function playChance(s: ProState): { start: number; sub: number } {
  const relAdj = (s.rel - 50) / 250;
  switch (s.status) {
    case "titolare": return { start: clampN(0.86 + relAdj, 0.5, 0.97), sub: 0.6 };
    case "rotazione": return { start: clampN(0.5 + relAdj, 0.2, 0.8), sub: 0.6 };
    case "riserva": return { start: clampN(0.16 + relAdj, 0.04, 0.4), sub: 0.4 };
    default: return { start: 0.02, sub: 0.12 };
  }
}

/** Simula una partita del tuo campionato (con o senza di te). */
function playFixture(s: ProState, f: Fixture, rng: Rng) {
  const hs = strengthOf(s, f.home), as = strengthOf(s, f.away);
  const mineH = f.home === s.clubId, mineA = f.away === s.clubId;
  if (!mineH && !mineA) { f.hg = Math.min(7, poisson(rng, xg(hs, as, true))); f.ag = Math.min(7, poisson(rng, xg(as, hs, false))); return; }
  const clubS = mineH ? hs : as;
  let min = 0;
  if (s.injury > 0) { s.injury--; s.stats.injuredMatches++; }
  else { const pc = playChance(s); if (rng.chance(pc.start)) min = 90; else if (rng.chance(pc.sub)) min = rng.int(10, 35); }
  if (!min && s.status === "giovanili" && s.injury === 0) {
    // partita con la Primavera
    const sh = shares(s.p), q = clampN(1 + (s.p.ovr - 55) / 18, 0.5, 2.2);
    s.stats.yApps = (s.stats.yApps ?? 0) + 1;
    s.stats.yGoals = (s.stats.yGoals ?? 0) + poisson(rng, sh.g * 1.6 * q);
    s.stats.yAssists = (s.stats.yAssists ?? 0) + poisson(rng, sh.a * 1.4 * q);
  }
  // il tuo contributo alla forza della squadra
  const boost = min ? ((s.p.ovr - clubS) * 0.18 + s.form * 0.4) * (min / 90) : 0;
  const us = clubS + boost, them = mineH ? as : hs;
  const gUs = Math.min(7, poisson(rng, xg(us, them, mineH))), gThem = Math.min(7, poisson(rng, xg(them, us, !mineH)));
  f.hg = mineH ? gUs : gThem; f.ag = mineH ? gThem : gUs;
  if (!min) return;
  const sh = shares(s.p), q = clampN(1 + (s.p.ovr - clubS) / 25 + s.form * 0.04, 0.4, 1.9) * (min / 90);
  let g = 0, a = 0;
  for (let i = 0; i < gUs; i++) { if (rng.chance(sh.g * q)) g++; else if (rng.chance(sh.a * q * 0.85)) a++; }
  const r = matchRating(rng, s.p, clubS, g, a, gUs > gThem, gUs < gThem, gThem, s.form, s.morale);
  const st = s.stats;
  st.apps++; if (min === 90) st.starts++; st.minutes += min; st.goals += g; st.assists += a; st.rSum += r; st.rN++;
  if (gThem === 0 && min >= 60) st.cs++;
  const yc = (s.p.role === "DIF" || s.p.sub === "Mediano" ? 0.18 : 0.08) * (s.p.character === "Testa calda" || s.p.traits.includes("muro_gialli") ? 1.8 : 1);
  if (rng.chance(yc)) st.yellow++;
  if (rng.chance(yc / 12)) { st.red++; s.injury = Math.max(s.injury, 1); }
  // infortuni
  const inj = 0.011 * (s.p.stamina === 1 ? 2 : s.p.stamina === 3 ? 0.5 : 1) * (s.p.age >= 31 ? 1.4 : 1);
  if (rng.chance(inj)) { const n = rng.int(1, 6); s.injury = Math.max(s.injury, n); s.news.unshift(`Infortunio: ${n} ${n === 1 ? "partita" : "partite"} di stop.`); }
  f.me = { min, g, a, r };
}

/** Gioca fino al prossimo momento (o al momento clou, o alla fine). */
export function playSegment(s: ProState, rng: Rng) {
  if (s.phase !== "season") throw new Error("Non è il momento di giocare.");
  const end = segmentEnd(s, s.segment);
  for (const f of s.fixtures) {
    if (f.hg != null || f.round > end) continue;
    if (f.round === s.clouRound && (f.home === s.clubId || f.away === s.clubId) && !s.clou && s.status !== "giovanili") {
      // ci fermiamo per il momento clou
      s.clou = setupClou(s, s.fixtures.indexOf(f), rng);
      s.phase = "clou";
      return;
    }
    playFixture(s, f, rng);
  }
  s.segment++;
  if (s.segment >= SEGMENTS) { endSeason(s, rng); return; }
  s.moment = pickMoment(s, rng);
  s.phase = s.moment ? "moment" : "season";
}

export function table(s: ProState, fixtures = s.fixtures, league = myLeague(s)): Row[] {
  const teams = leagueTeams(s, league);
  const rows = new Map(teams.map((t) => [t.id, { id: t.id, name: t.name, pt: 0, g: 0, gf: 0, gs: 0 }]));
  for (const f of fixtures) {
    if (f.hg == null) continue;
    const h = rows.get(f.home)!, a = rows.get(f.away)!;
    h.g++; a.g++; h.gf += f.hg; h.gs += f.ag!; a.gf += f.ag!; a.gs += f.hg;
    if (f.hg > f.ag!) h.pt += 3; else if (f.hg < f.ag!) a.pt += 3; else { h.pt++; a.pt++; }
  }
  return [...rows.values()].sort((x, y) => y.pt - x.pt || (y.gf - y.gs) - (x.gf - x.gs) || y.gf - x.gf);
}

/* ---------------- momenti chiave ---------------- */

type MomentDef = { id: string; icon: string; title: string; when: (s: ProState) => boolean; text: (s: ProState) => string; options: { label: string; desc: string; apply: (s: ProState, rng: Rng) => string }[] };
const avgR = (st: Stats) => (st.rN ? st.rSum / st.rN : 0);
const clubName = (s: ProState) => CLUB_BY_ID.get(s.clubId)!.name;

const MOMENTS: MomentDef[] = [
  { id: "panchina", icon: "🪑", title: "Il mister ti lascia fuori", when: (s) => s.status !== "giovanili" && s.stats.starts < s.stats.apps * 0.7,
    text: () => "Da qualche settimana parti dalla panchina. In allenamento senti di meritare di più.",
    options: [
      { label: "Lavoro in silenzio", desc: "Rapporto col mister in crescita, forma +1", apply: (s) => { s.rel += 10; s.form += 1; return "Il mister nota il tuo impegno."; } },
      { label: "Bussi alla porta del mister", desc: "Rischioso: o ti promuove o si irrita", apply: (s, r) => { if (r.chance(0.5)) { s.status = s.status === "riserva" ? "rotazione" : "titolare"; s.rel += 5; return "Ti dà fiducia: più spazio da subito!"; } s.rel -= 15; return "Non l'ha presa bene. Rapporto in calo."; } },
      { label: "Sfoghi la rabbia sui social", desc: "Morale su, rapporto giù", apply: (s) => { s.morale += 10; s.rel -= 20; s.promisedOffer = "cessione"; return "Il post fa il giro del web. A fine anno qualcuno ti cercherà, ma il mister è furioso."; } },
    ] },
  { id: "rigore", icon: "⚪", title: "Rigore al 90'", when: (s) => s.p.role !== "POR" && s.status !== "giovanili",
    text: (s) => `Rigore decisivo per il ${clubName(s)} all'ultimo minuto. Il rigorista è in panchina.`,
    options: [
      { label: "Lo tiro io", desc: "Gloria o polvere", apply: (s, r) => { const p = 0.7 + (s.p.spec === "Tiro a giro" ? 0.06 : 0) + (s.p.character === "Leader" ? 0.05 : 0); if (r.chance(p)) { s.stats.goals++; s.morale += 12; s.form += 1; s.rel += 5; return "GOL! Lo stadio esplode."; } s.morale -= 12; s.form -= 1; return "Parato. Notte insonne."; } },
      { label: "Lo lascio al capitano", desc: "Nessun rischio, nessuna gloria", apply: (s) => { s.rel += 3; return "Il capitano segna, la squadra ti ringrazia."; } },
    ] },
  { id: "parata", icon: "🧤", title: "Rigore contro nel derby", when: (s) => s.p.role === "POR" && s.status !== "giovanili",
    text: () => "Derby, ultimo minuto, rigore per gli avversari. Il tiratore si prepara.",
    options: [
      { label: "Tuffo a sinistra", desc: "Lato preferito dei destri", apply: (s, r) => saveOutcome(s, r, 0.38) },
      { label: "Resto in mezzo", desc: "Rischio massimo", apply: (s, r) => saveOutcome(s, r, 0.22) },
      { label: "Tuffo a destra", desc: "Sorprenderlo", apply: (s, r) => saveOutcome(s, r, 0.32) },
    ] },
  { id: "infortunio", icon: "🩹", title: "Fastidio muscolare", when: (s) => s.injury === 0,
    text: () => "Senti tirare il muscolo dopo l'allenamento. I medici sono divisi.",
    options: [
      { label: "Gioco lo stesso", desc: "Rischi uno stop lungo", apply: (s, r) => { if (r.chance(0.35)) { s.injury = 4; return "Lo strappo arriva: 4 partite fuori."; } s.rel += 5; return "Stringi i denti e vai. Il mister apprezza."; } },
      { label: "Mi fermo una settimana", desc: "Una partita persa, niente rischi", apply: (s) => { s.injury = 1; return "Una partita ai box, poi torni al 100%."; } },
    ] },
  { id: "gennaio", icon: "📞", title: "Il telefono squilla a gennaio", when: (s) => avgR(s.stats) >= 6.6 && s.segment >= 1,
    text: (s) => `Il tuo agente ti dice che un club più importante del ${clubName(s)} ti segue.`,
    options: [
      { label: "Resto concentrato", desc: "Rapporto col mister e forma su", apply: (s) => { s.rel += 8; s.form += 1; return "Testa al campo. Ne riparliamo a giugno."; } },
      { label: "Fammi sapere a giugno", desc: "A fine stagione arriverà un'offerta in più", apply: (s) => { s.promisedOffer = "big"; s.morale += 5; return "L'agente lavora sottotraccia."; } },
    ] },
  { id: "notte", icon: "🎉", title: "Festa prima della partita", when: (s) => s.p.character === "Testa calda" || s.p.character === "Genio e sregolatezza" || s.p.age <= 21,
    text: () => "Gli amici ti invitano a una festa la sera prima di una partita importante.",
    options: [
      { label: "Vado, solo un'ora", desc: "Morale su, ma se ti beccano…", apply: (s, r) => { s.morale += 8; if (r.chance(0.4)) { s.rel -= 20; s.form -= 1; return "Foto sui giornali: multa e panchina."; } return "Nessuno se ne accorge. Ti senti carico."; } },
      { label: "Resto a casa", desc: "Professionalità", apply: (s) => { s.form += 1; s.rel += 3; return "Dormi bene e giochi meglio."; } },
    ] },
  { id: "capitano", icon: "©️", title: "Fascia da capitano", when: (s) => s.status === "titolare" && (s.p.character === "Leader" || s.p.age >= 24),
    text: () => "Il capitano si fa male: il mister ti chiede di prendere la fascia per un mese.",
    options: [
      { label: "Accetto con orgoglio", desc: "Pressione, ma voti più alti se rispondi", apply: (s, r) => { if (r.chance(0.65)) { s.form += 1; s.rel += 10; return "Guidi la squadra da leader vero."; } s.morale -= 8; return "La fascia pesa: qualche partita sottotono."; } },
      { label: "Meglio un compagno più esperto", desc: "Nessun rischio", apply: (s) => { s.rel -= 3; return "Il mister annuisce, un po' deluso."; } },
    ] },
  { id: "primavera", icon: "🌱", title: "Chiamata dalla prima squadra", when: (s) => s.status === "giovanili",
    text: (s) => `Il mister del ${clubName(s)} ti chiama ad allenarti con i grandi.`,
    options: [
      { label: "Do tutto in allenamento", desc: "Puoi guadagnarti il posto in panchina", apply: (s, r) => { if (r.chance(0.55 + (s.p.ovr - 55) / 50)) { s.status = "riserva"; s.rel += 10; return "Ti porta in panchina: inizia l'avventura tra i grandi!"; } s.form += 1; return "Torni in Primavera, ma più forte."; } },
      { label: "Resto in Primavera a segnare", desc: "Più minuti, più fiducia", apply: (s) => { s.morale += 10; s.form += 1; return "Fai il fenomeno tra i ragazzi."; } },
    ] },
  { id: "intervista", icon: "🎤", title: "Intervista scomoda", when: () => true,
    text: () => "Un giornalista ti chiede se il club è abbastanza ambizioso per te.",
    options: [
      { label: "Qui sto benissimo", desc: "Tifosi e mister contenti", apply: (s) => { s.rel += 6; s.morale += 4; return "I tifosi ti adorano."; } },
      { label: "Voglio vincere, ovunque", desc: "Attiri le big, irriti il club", apply: (s) => { s.rel -= 8; s.promisedOffer = s.promisedOffer ?? "big"; return "Il titolo fa rumore: le big prendono nota."; } },
    ] },
  { id: "allenamento", icon: "🏋️", title: "Doppia seduta", when: () => true,
    text: () => "Il preparatore ti propone un programma extra di allenamento.",
    options: [
      { label: "Tecnica", desc: "Crescita +1 a fine anno", apply: (s) => { s.p.traits.push("_extra"); return "Ore in più con il pallone."; } },
      { label: "Fisico", desc: "Meno infortuni, forma +1", apply: (s) => { s.form += 1; s.injury = Math.max(0, s.injury - 1); return "Ti senti una roccia."; } },
      { label: "Riposo", desc: "Morale su", apply: (s) => { s.morale += 8; return "Testa libera."; } },
    ] },
];

function saveOutcome(s: ProState, r: Rng, p: number) {
  const bonus = s.p.spec === "Para-rigori" || s.p.traits.includes("tasc_paratutto") ? 0.15 : 0;
  if (r.chance(p + bonus)) { s.morale += 12; s.form += 1; s.rel += 5; s.stats.rSum += 1; return "PARATO! Sei l'eroe del derby."; }
  s.morale -= 6; return "Gol. Avevi scelto il lato sbagliato.";
}

function pickMoment(s: ProState, rng: Rng): Moment | null {
  const pool = MOMENTS.filter((m) => !s.momentsSeen.includes(m.id) && m.when(s));
  if (!pool.length) return null;
  const m = rng.pick(pool);
  s.momentsSeen.push(m.id);
  return { id: m.id, title: m.title, text: m.text(s), icon: m.icon, options: m.options.map((o) => ({ label: o.label, desc: o.desc })) };
}

export function chooseMoment(s: ProState, idx: number, rng: Rng): string {
  if (s.phase !== "moment" || !s.moment) throw new Error("Nessun momento in corso.");
  const def = MOMENTS.find((m) => m.id === s.moment!.id)!;
  const res = def.options[idx].apply(s, rng);
  s.rel = clampN(s.rel, 0, 100); s.morale = clampN(s.morale, 0, 100); s.form = clampN(s.form, -3, 3);
  s.news.unshift(`${s.moment.title}: ${res}`);
  s.moment = null; s.phase = "season";
  return res;
}

/* ---------------- momento clou (partita in diretta) ---------------- */

type Sit = { sit: string; choices: { id: string; label: string; pct: number }[] };
function situations(p: Pro): Sit[] {
  const sp = (x: string) => (p.spec === x ? 0.12 : 0);
  const h = p.height >= 186 ? 0.1 : p.height <= 174 ? -0.1 : 0, v = (p.speed - 2) * 0.06, q = (p.ovr - 70) / 100;
  const c = (id: string, label: string, pct: number) => ({ id, label, pct: clampN(Math.round((pct + q) * 100) / 100, 0.08, 0.9) });
  if (p.role === "ATT") return [
    { sit: "Palla al limite dell'area, difesa schierata.", choices: [c("giro", "Tiro a giro", 0.3 + sp("Tiro a giro")), c("potenza", "Tiro di potenza", 0.26), c("pass", "Passaggio al compagno", 0.4)] },
    { sit: "Cross dalla fascia, sei in mezzo a due difensori.", choices: [c("testa", "Colpo di testa", 0.3 + h + sp("Colpo di testa")), c("volo", "Girata al volo", 0.22 + sp("Rapace d'area")), c("velo", "Velo per il compagno", 0.35)] },
    { sit: "Sei solo davanti al portiere!", choices: [c("dribbling", "Dribbling sul portiere", 0.42 + v + sp("Velocità")), c("pallonetto", "Pallonetto", 0.38), c("secco", "Tiro secco sul primo palo", 0.45 + sp("Rapace d'area"))] },
  ];
  if (p.role === "CEN") return [
    { sit: "Spazio a centrocampo, l'attaccante scatta.", choices: [c("filtrante", "Filtrante", 0.42 + sp("Filtranti")), c("fuori", "Tiro da fuori", 0.2 + sp("Tiro da fuori")), c("dribbling", "Dribbling", 0.3 + v)] },
    { sit: "Contropiede avversario, sei l'ultimo a centrocampo.", choices: [c("recupero", "Intervento deciso", 0.5 + sp("Recupero palla")), c("tattico", "Fallo tattico (giallo)", 0.75), c("temporeggia", "Temporeggi", 0.45)] },
    { sit: "Punizione dal limite.", choices: [c("punizione", "Calcio diretto", 0.22 + sp("Tiro da fuori")), c("schema", "Schema per l'inserimento", 0.3 + sp("Inserimenti"))] },
  ];
  if (p.role === "DIF") return [
    { sit: "Il loro centravanti scatta sul filo del fuorigioco.", choices: [c("anticipo", "Anticipo", 0.5 + sp("Anticipo") + v), c("scivolata", "Scivolata", 0.55), c("accompagna", "Lo accompagni", 0.45)] },
    { sit: "Calcio d'angolo per voi.", choices: [c("stacco", "Stacco di testa", 0.22 + h + sp("Gioco aereo")), c("blocco", "Blocco per il compagno", 0.3)] },
    { sit: "Il loro numero 10 punta te.", choices: [c("stretta", "Marcatura stretta", 0.5 + sp("Leadership")), c("chiudi", "Chiudi la linea di passaggio", 0.48), c("raddoppio", "Chiami il raddoppio", 0.5)] },
  ];
  return [
    { sit: "Tiro da fuori angolato.", choices: [c("sx", "Tuffo a sinistra", 0.5 + sp("Riflessi")), c("dx", "Tuffo a destra", 0.5 + sp("Riflessi"))] },
    { sit: "Cross alto in area piccola.", choices: [c("uscita", "Esci di pugno", 0.5 + h + sp("Uscite alte")), c("linea", "Resti sulla linea", 0.45)] },
    { sit: "Uno contro uno con l'attaccante.", choices: [c("esci", "Esci a valanga", 0.48 + sp("Uscite alte")), c("aspetta", "Aspetti fino all'ultimo", 0.45 + sp("Riflessi"))] },
  ];
}

function setupClou(s: ProState, fixtureIdx: number, rng: Rng): Clou {
  const f = s.fixtures[fixtureIdx];
  const home = f.home === s.clubId;
  const opp = home ? f.away : f.home;
  const us = strengthOf(s, s.clubId), them = strengthOf(s, opp);
  // le "altre" occasioni della partita (senza i tuoi tre momenti)
  const base: [number, number] = [Math.min(5, poisson(rng, xg(us, them, home) * 0.7)), Math.min(5, poisson(rng, xg(them, us, !home) * 0.75))];
  const mins = [rng.int(12, 35), rng.int(48, 70), rng.int(78, 89)];
  const sits = situations(s.p);
  return {
    fixtureIdx, opp, home, title: `${home ? CLUB_BY_ID.get(s.clubId)!.name : CLUB_BY_ID.get(opp)?.name ?? opp} – ${home ? CLUB_BY_ID.get(opp)?.name ?? opp : CLUB_BY_ID.get(s.clubId)!.name}`,
    step: 0, score: [0, 0], base, actions: sits.map((x, i) => ({ minute: mins[i], sit: x.sit, choices: x.choices })), mine: { g: 0, a: 0, saves: 0, err: 0 },
  };
}

const ATTACK = new Set(["giro", "potenza", "testa", "volo", "dribbling", "pallonetto", "secco", "fuori", "punizione", "stacco"]);
const ASSIST = new Set(["pass", "velo", "filtrante", "schema", "blocco"]);

export function clouAction(s: ProState, choiceId: string, rng: Rng): { good: boolean; text: string } {
  const c = s.clou!;
  const act = c.actions[c.step];
  const ch = act.choices.find((x) => x.id === choiceId)!;
  const ok = rng.chance(ch.pct);
  let text: string;
  if (ATTACK.has(ch.id)) { if (ok) { c.mine.g++; c.score[0]++; text = "GOL! È tuo!"; } else text = rng.pick(["Fuori di un soffio.", "Il portiere ci arriva.", "Traversa!"]); }
  else if (ASSIST.has(ch.id)) { if (ok) { c.mine.a++; c.score[0]++; text = "Assist perfetto: il compagno segna!"; } else text = "L'azione sfuma."; }
  else { // difesa / portiere
    if (ok) { c.mine.saves++; text = s.p.role === "POR" ? "Parata decisiva!" : "Pallone recuperato, pericolo sventato!"; }
    else { c.mine.err++; c.score[1]++; text = ch.id === "scivolata" && rng.chance(0.3) ? "Rigore per loro… e gol." : "Ti saltano: gol degli avversari."; }
    if (ch.id === "tattico") { s.stats.yellow++; text += " (giallo per te)"; }
  }
  act.result = text; act.good = ok;
  c.step++;
  return { good: ok, text };
}

/** Chiude il momento clou: salva il risultato nella giornata e riprende la stagione. */
export function finishClou(s: ProState, rng: Rng) {
  const c = s.clou!;
  const f = s.fixtures[c.fixtureIdx];
  const us = c.base[0] + c.score[0], them = c.base[1] + c.score[1];
  f.hg = c.home ? us : them; f.ag = c.home ? them : us;
  const clubS = strengthOf(s, s.clubId);
  let r = matchRating(rng, s.p, clubS, c.mine.g, c.mine.a, us > them, us < them, them, s.form, s.morale) + c.mine.saves * 0.4 - c.mine.err * 0.5;
  r = clampN(Math.round(r * 2) / 2, 4, 10);
  const st = s.stats; st.apps++; st.starts++; st.minutes += 90; st.goals += c.mine.g; st.assists += c.mine.a; st.rSum += r; st.rN++; if (them === 0) st.cs++;
  f.me = { min: 90, g: c.mine.g, a: c.mine.a, r };
  s.news.unshift(`Momento clou: ${CLUB_BY_ID.get(f.home)?.name ?? "?"} ${f.hg}-${f.ag} ${CLUB_BY_ID.get(f.away)?.name ?? "?"} · voto ${String(r).replace(".", ",")}`);
  s.morale = clampN(s.morale + (us > them ? 8 : us < them ? -6 : 0), 0, 100);
  s.phase = "season";
}

/* ---------------- fine stagione ---------------- */

function simulateLeagueTable(s: ProState, league: LeagueCode, rng: Rng): Row[] {
  const teams = leagueTeams(s, league);
  const fx: Fixture[] = ROUND_ROBIN(teams.map((t) => t.id)).flatMap((rd, r) => rd.map(([home, away]) => ({ round: r + 1, home, away })));
  for (const f of fx) { const hs = strengthOf(s, f.home), as = strengthOf(s, f.away); f.hg = Math.min(7, poisson(rng, xg(hs, as, true))); f.ag = Math.min(7, poisson(rng, xg(as, hs, false))); }
  return table(s, fx, league);
}

const winP = (a: number, b: number) => 1 / (1 + Math.exp(-(a - b) / 5));

export function endSeason(s: ProState, rng: Rng) {
  const league = myLeague(s);
  const tables: Partial<Record<LeagueCode, Row[]>> = {};
  for (const l of TABLE_LEAGUES) tables[l] = l === league ? table(s) : simulateLeagueTable(s, l, rng);
  const myTable = table(s);
  const pos = myTable.findIndex((r) => r.id === s.clubId) + 1;
  const trophies: string[] = [];
  const lname = LEAGUES[league].name;
  if (pos === 1) { trophies.push(lname); s.trophies.league++; }

  // Champions League: qualificate dalla stagione prima (la prima volta: le più forti)
  const qualified: string[] = [];
  for (const l of TABLE_LEAGUES) {
    const prev = s.lastTables[l] ?? clubsOf(l).sort((a, b) => b.strength - a.strength).map((c) => ({ id: c.id } as Row));
    qualified.push(...prev.slice(0, CL_SPOTS[l] ?? 0).map((r) => r.id));
  }
  let cl = [...qualified].sort((a, b) => strengthOf(s, b) - strengthOf(s, a)).slice(0, 16);
  const inCL = cl.includes(s.clubId);
  let clRound = "";
  const roundNames = ["Ottavi", "Quarti", "Semifinale", "Finale"];
  for (let r = 0; r < 4 && cl.length > 1; r++) {
    const next: string[] = [];
    for (let i = 0; i < cl.length; i += 2) {
      const a = cl[i], b = cl[i + 1];
      let sa = strengthOf(s, a), sb = strengthOf(s, b);
      if (a === s.clubId) sa += (s.p.ovr - sa) * 0.12; if (b === s.clubId) sb += (s.p.ovr - sb) * 0.12;
      const w = rng.chance(winP(sa, sb)) ? a : b;
      next.push(w);
      if ((a === s.clubId || b === s.clubId) && s.status !== "giovanili") {
        // le tue partite di coppa
        const pc = playChance(s);
        for (let leg = 0; leg < (r < 3 ? 2 : 1); leg++) {
          if (!rng.chance(pc.start + 0.05)) continue;
          const sh = shares(s.p), q = clampN(1 + (s.p.ovr - strengthOf(s, s.clubId)) / 25, 0.4, 1.8);
          const goals = poisson(rng, 1.4);
          let g = 0, as = 0; for (let k = 0; k < goals; k++) { if (rng.chance(sh.g * q)) g++; else if (rng.chance(sh.a * q * 0.85)) as++; }
          s.stats.apps++; s.stats.starts++; s.stats.minutes += 90; s.stats.goals += g; s.stats.assists += as;
          const rr = clampN(6.1 + g * 0.8 + as * 0.4 + (rng.next() - 0.5), 4, 10); s.stats.rSum += rr; s.stats.rN++;
        }
        clRound = w === s.clubId ? (r === 3 ? "Vincitore" : roundNames[r + 1]) : roundNames[r];
      }
    }
    cl = next.sort(() => rng.next() - 0.5);
  }
  if (inCL && clRound === "Vincitore") { trophies.push("Champions League"); s.trophies.cl++; }

  // premi individuali
  const st = s.stats, avg = st.rN ? r1(st.rSum / st.rN) : 0;
  const topRival = Math.round((LEAGUES[league].stars >= 4 ? 21 : 18) + rng.next() * 8);
  const topScorer = st.goals > topRival;
  if (topScorer) { trophies.push(`Capocannoniere ${lname}`); s.trophies.topScorer++; }
  const score = s.p.ovr * 1.4 + st.goals * 0.6 + st.assists * 0.35 + avg * 5 + (pos === 1 ? 6 : 0) + (clRound === "Vincitore" ? 12 : clRound === "Finale" ? 6 : 0) + (topScorer ? 4 : 0) + LEAGUES[league].stars * 2;
  const rivals = [203, 197, 192, 188, 185, 182, 179, 176, 173, 170].map((x) => x + (rng.next() - 0.5) * 14);
  let ballonRank = rivals.filter((x) => x > score).length + 1;
  if (ballonRank > 10) ballonRank = 11 + Math.floor((Math.min(...rivals) - score) / 2.5);
  if (st.apps < 12) ballonRank = 99;
  if (ballonRank === 1 && st.apps >= 15) { trophies.push("Pallone d'Oro"); s.trophies.ballon++; }

  // nazionale
  const nat = NATION_BY_ID.get(s.p.nation)!;
  let natLine = "";
  if (s.p.age >= 18 && s.p.ovr >= nat.strength - 4 && st.apps >= 8) {
    const caps = rng.int(5, 9); s.trophies.caps += caps;
    const ig = s.p.role === "ATT" ? rng.int(0, 4) : s.p.role === "CEN" ? rng.int(0, 2) : rng.int(0, 1);
    s.trophies.intlGoals += ig;
    natLine = `Convocato con ${nat.flag} ${nat.name}: ${caps} presenze${ig ? `, ${ig} gol` : ""}.`;
  } else if (s.p.age >= 18 && s.p.ovr >= nat.strength - 9) natLine = "Il ct ti osserva: ancora non basta per la nazionale.";

  // obiettivo personale
  const g = s.goal;
  const val = !g ? 0 : g.kind === "gol" ? st.goals : g.kind === "assist" ? st.assists : g.kind === "voto" ? avg : g.kind === "pres" ? st.apps : g.kind === "ygol" ? (st.yGoals ?? 0) + st.goals : g.kind === "yapps" ? (st.yApps ?? 0) + st.apps : st.cs;
  const goalOk = !!g && val >= g.n;

  // crescita
  const before = s.p.ovr;
  const age = s.p.age;
  const share = clampN(st.minutes / (totalRounds(s) * 90), 0, 1);
  const ageF = age <= 19 ? 5 : age <= 21 ? 4 : age <= 23 ? 3 : age <= 26 ? 1.5 : age <= 29 ? 0.3 : age <= 31 ? -1 : age <= 33 ? -2.2 : -3.6;
  let delta = ageF * (age < 27 ? clampN((s.p.pot - s.p.ovr) / 11, 0, 1.1) : 1) * (0.3 + 0.9 * share) + (avg ? (avg - 6.3) * 1.2 : -0.5) + (rng.next() - 0.5) * 2;
  if (s.p.traits.includes("fen_precoce") && age <= 21) delta += 1.5;
  if (s.p.traits.includes("_extra")) { delta += 1; s.p.traits = s.p.traits.filter((t) => t !== "_extra"); }
  if (s.p.character === "Professionista" && age >= 29) delta += 0.6;
  if (goalOk) delta += 0.7;
  let newOvr = Math.round(before + delta);
  if (delta > 0) newOvr = Math.min(newOvr, Math.max(before, s.p.pot));
  s.p.ovr = clampN(newOvr, 40, 97);
  const notes: string[] = [];
  if (age >= 29 && s.p.speed > 1 && rng.chance(0.3)) { s.p.speed--; notes.push("Perdi un po' di velocità con gli anni."); }

  // club: forza che cambia un po' ogni anno
  for (const c of CLUBS) s.strengths[c.id] = clampN(Math.round((s.strengths[c.id] ?? c.strength) + (c.strength - (s.strengths[c.id] ?? c.strength)) * 0.3 + (rng.next() - 0.5) * 4), 58, 92);

  const rec: SeasonRec = {
    year: s.year, age, clubId: s.clubId, league, status: s.status, ovr: before, stats: { ...st }, avg, pos, n: myTable.length,
    trophies, goal: g?.label ?? "—", goalOk, loan: !!s.loanFrom,
  };
  s.history.push(rec);
  s.lastTables = tables;
  s.report = {
    year: s.year, age, pos, n: myTable.length, league: lname, clRound: inCL ? clRound || "Ottavi" : null, trophies, avg, stats: { ...st },
    ovrBefore: before, ovrAfter: s.p.ovr, ballonRank, topRival, natLine, goal: g?.label ?? null, goalOk, notes, tables,
  };
  s.contractYears--;
  s.phase = "end";
}

/* ---------------- mercato ---------------- */

export function marketValue(p: Pro): number {
  const base = Math.max(0.2, Math.pow(Math.max(0, p.ovr - 50), 2.2) / 60);
  const ageK = p.age <= 21 ? 1.6 : p.age <= 24 ? 1.3 : p.age <= 28 ? 1 : p.age <= 31 ? 0.6 : 0.3;
  const potK = p.age <= 23 ? 1 + Math.max(0, p.pot - p.ovr) / 20 : 1;
  return Math.round(base * ageK * potK * 10) / 10;
}
function salaryFor(ovr: number, league: LeagueCode, rich = false) {
  const k = { 5: 1.3, 4: 1, 3: 0.65, 2: 0.45, 1: 0.3 }[LEAGUES[league].stars] ?? 0.5;
  return Math.round(Math.max(0.1, Math.pow(Math.max(0, ovr - 55), 1.9) / 70 * k * (rich ? 2.4 : 1)) * 10) / 10;
}

export function makeOffers(s: ProState, rng: Rng): Offer[] {
  const p = s.p;
  const cur = CLUB_BY_ID.get(s.clubId)!;
  const recent = s.history[s.history.length - 1];
  const form = recent ? recent.avg - 6.3 : 0;
  const eff = p.ovr + form * 2 + (p.traits.includes("fen_figlio") ? 2 : 0) + (p.age <= 21 ? Math.min(4, (p.pot - p.ovr) / 4) : 0);
  const candidates = CLUBS.filter((c) => c.id !== s.clubId).map((c) => {
    const S = s.strengths[c.id];
    const gap = eff - S;
    let w = 0;
    if (gap >= -5 && gap <= 6) w = 10 - Math.abs(gap - 0.5);
    if (S >= 84 && eff >= S - 5) w += 4; // le big puntano su chi è vicino al loro livello
    if (LEAGUES[c.league].stars >= 4) w *= 1.2;
    if ((c.league === "NED" || c.league === "POR") && p.age <= 22) w *= 1.6;
    if ((c.league === "SAU" || c.league === "USA") && p.age < 30) w *= 0.2;
    if ((c.league === "SAU" || c.league === "USA") && p.age >= 31) w = Math.max(w, 6) * 1.5;
    return { c, w: Math.max(0, w) };
  }).filter((x) => x.w > 0.5);
  const offers: Offer[] = [];
  const used = new Set<string>();
  const n = s.promisedOffer ? 3 : rng.int(1, 3);
  for (let i = 0; i < n && candidates.length; i++) {
    const pool = candidates.filter((x) => !used.has(x.c.id));
    if (!pool.length) break;
    // l'offerta promessa a gennaio arriva da un club più forte
    const pick = i === 0 && s.promisedOffer === "big" ? [...pool].sort((a, b) => s.strengths[b.c.id] - s.strengths[a.c.id]).find((x) => s.strengths[x.c.id] > s.strengths[s.clubId]) ?? pool[0] : pool[rng.weighted(pool.map((x) => ({ weight: x.w })))];
    used.add(pick.c.id);
    const S = s.strengths[pick.c.id];
    const rich = pick.c.league === "SAU" || (pick.c.league === "USA" && p.age >= 30);
    offers.push({ clubId: pick.c.id, status: statusFor(p.ovr, S, p.age), years: p.age >= 32 ? rng.int(1, 2) : rng.int(2, 5), salary: salaryFor(p.ovr, pick.c.league, rich) });
  }
  // giovani poco impiegati: prestito per crescere
  if (p.age <= 21 && (s.status === "giovanili" || s.status === "riserva")) {
    const loanPool = CLUBS.filter((c) => c.id !== s.clubId && !used.has(c.id) && s.strengths[c.id] <= p.ovr + 8).sort((a, b) => Math.abs(s.strengths[a.id] - p.ovr - 4) - Math.abs(s.strengths[b.id] - p.ovr - 4)).slice(0, 6);
    if (loanPool.length) { const lc = rng.pick(loanPool); offers.push({ clubId: lc.id, status: statusFor(p.ovr, s.strengths[lc.id], p.age), years: 1, salary: Math.max(0.2, salaryFor(p.ovr, lc.league)), loan: true, note: `In prestito dal ${cur.name}` }); }
  }
  // restare / rinnovare
  const stay: Offer = { clubId: s.clubId, status: statusFor(p.ovr, s.strengths[s.clubId], p.age), years: s.contractYears > 0 ? s.contractYears : rng.int(1, 3), salary: s.contractYears > 0 ? s.salary : salaryFor(p.ovr, cur.league), stay: true, note: s.contractYears > 0 ? `Contratto fino al ${s.year + 1 + s.contractYears}` : "Rinnovo offerto" };
  if (s.loanFrom) { stay.clubId = s.loanFrom; stay.note = "Rientro dal prestito"; stay.status = statusFor(p.ovr, s.strengths[s.loanFrom], p.age); }
  // se il rapporto è pessimo il club non rinnova
  if (!(s.contractYears <= 0 && s.rel < 20)) offers.unshift(stay);
  // mai senza squadra: almeno un club di categoria inferiore si fa avanti
  if (!offers.length) {
    const low = [...CLUBS].filter((c) => c.id !== s.clubId).sort((a, b) => Math.abs(s.strengths[a.id] - p.ovr + 2) - Math.abs(s.strengths[b.id] - p.ovr + 2))[0];
    offers.push({ clubId: low.id, status: statusFor(p.ovr, s.strengths[low.id], p.age), years: 1, salary: salaryFor(p.ovr, low.league), note: "Svincolato: unica offerta" });
  }
  return offers;
}

export function retireForced(s: ProState): string | null {
  const a = s.p.age;
  if (a >= 41) return "A 41 anni il corpo dice basta.";
  if (a >= 33 && s.p.ovr < 60) return "Le offerte non arrivano più: è tempo di appendere gli scarpini.";
  return null;
}
export const canRetire = (s: ProState) => s.p.age >= 32;
export function retireChance(s: ProState): number { return s.p.age < 33 ? 0 : clampN((s.p.age - 32) * 0.1 + (s.p.ovr < 68 ? 0.15 : 0), 0, 0.85); }

/** Dopo il report: prepara le offerte (o il ritiro). */
export function goToOffers(s: ProState, rng: Rng) {
  s.p.age++;
  const forced = retireForced(s);
  if (forced) { retire(s, forced); return; }
  if (rng.chance(retireChance(s))) { retire(s, `a ${s.p.age} anni il fisico non regge più i ritmi.`); return; }
  s.offers = makeOffers(s, rng);
  s.phase = "offers";
}

export function acceptOffer(s: ProState, idx: number) {
  const o = s.offers[idx];
  if (!o) throw new Error("Offerta non valida.");
  const from = s.clubId;
  if (o.loan) s.loanFrom = s.loanFrom ?? from; else if (!o.stay) s.loanFrom = null;
  if (o.stay && s.loanFrom && o.clubId === s.loanFrom) s.loanFrom = null;
  if (!o.stay || o.clubId !== from) { s.news.unshift(`${o.loan ? "Prestito" : "Trasferimento"}: ${s.p.name} passa al ${CLUB_BY_ID.get(o.clubId)!.name} (${LEAGUES[CLUB_BY_ID.get(o.clubId)!.league].name}).`); s.rel = 50; }
  s.clubId = o.clubId; s.contractYears = o.years; s.salary = o.salary; s.status = o.status;
  s.year++; s.season++;
  startSummer(s);
}

export function retire(s: ProState, why: string) {
  s.phase = "retired";
  s.report = { ...(s.report ?? {}), retired: why };
  s.news.unshift(`${s.p.name} si ritira: ${why}`);
}

/* ---------------- riepilogo carriera ---------------- */

export function careerTotals(s: ProState) {
  const t = { apps: 0, goals: 0, assists: 0, cs: 0, rSum: 0, rN: 0 };
  for (const h of s.history) { t.apps += h.stats.apps; t.goals += h.stats.goals; t.assists += h.stats.assists; t.cs += h.stats.cs; t.rSum += h.stats.rSum; t.rN += h.stats.rN; }
  const peak = Math.max(...s.history.map((h) => h.ovr), s.p?.ovr ?? 0);
  const clubs = [...new Set(s.history.map((h) => h.clubId))];
  const legend = Math.round(peak * 0.6 + s.trophies.league * 4 + s.trophies.cl * 8 + s.trophies.ballon * 15 + s.trophies.topScorer * 3 + Math.min(30, t.goals / 12) + Math.min(10, s.trophies.caps / 10) + s.trophies.cups.length * 8);
  const verdict = legend >= 110 ? "Leggenda del calcio" : legend >= 90 ? "Campione" : legend >= 72 ? "Ottima carriera" : legend >= 58 ? "Onesto professionista" : "Carriera di provincia";
  return { ...t, avg: t.rN ? r1(t.rSum / t.rN) : 0, peak, clubs, legend, verdict };
}
