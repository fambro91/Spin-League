import type { Atteggiamento, Choices, Club, ClubState, MatchEvent, MatchResult, MatchStats, Modulo, Ratings, RosterPlayer } from "./types";
import { makeRng, type Rng } from "./rng";
import { clamp } from "./club";

export const XG_BASE = Number((globalThis as any).process?.env?.XG_BASE ?? 1.25);
export const XG_SCALE = Number((globalThis as any).process?.env?.XG_SCALE ?? 33);
export const OFFENSIVE: Modulo[] = ["4-3-3", "3-4-3"];
export const DEFENSIVE: Modulo[] = ["5-3-2", "4-5-1"];

export type TeamCtx = { club: Club; state: ClubState; choices: Choices; home: boolean };

/** Reparti effettivi per la partita: permanenti + infortuni/squalifiche + modulo + stile + turnover. */
export function effectiveRatings(t: TeamCtx, matchday: number): Ratings {
  const r = { ...t.state.ratings };
  for (const m of t.state.modifiers) if (m.untilMatchday >= matchday) r[m.rep] += m.delta;
  const f = t.club.fuoriclasse;
  if (f && f.decays) r[f.ruolo] -= Math.min(f.bonus, Math.floor((matchday - 1) / 4));
  const c = t.choices;
  if (OFFENSIVE.includes(c.modulo)) { r.att += 2; r.dif -= 2; }
  if (DEFENSIVE.includes(c.modulo)) { r.dif += 2; r.att -= 2; }
  if (t.club.preferredModule === "tutti" || t.club.preferredModule === c.modulo) { r.att += 2; r.cen += 2; r.dif += 2; }
  if (t.club.coachStyle === "giochista") r.cen += 2;
  if (t.state.training === "tattica") { r.att += 1; r.cen += 1; r.dif += 1; }
  if (c.turnover === "parziale") { r.att -= 2; r.cen -= 2; r.dif -= 2; }
  if (c.turnover === "massiccio") { r.att = (r.att + r.pan) / 2; r.cen = (r.cen + r.pan) / 2; r.dif = (r.dif + r.pan) / 2; }
  for (const k of Object.keys(r) as (keyof Ratings)[]) r[k] = clamp(r[k], 30, 99);
  return r;
}

export function matchMorale(t: TeamCtx): number {
  let m = t.state.morale;
  if (t.choices.discorso === "motivare") m += 5;
  if (t.choices.discorso === "calmare") m += m > 50 ? -Math.min(10, m - 50) : Math.min(10, 50 - m);
  return clamp(m, 0, 100);
}

export function strengths(t: TeamCtx, matchday: number) {
  const r = effectiveRatings(t, matchday);
  const off = 0.6 * r.att + 0.4 * r.cen;
  const dif = 0.6 * r.dif + 0.25 * r.por + 0.15 * r.cen;
  const campo = t.home && !t.state.campoSqualificato ? t.club.fans.campo + (t.state.homeBoost ?? 0) + (t.state.investments?.includes("curva") ? 1 : 0) : 0;
  const M = campo + (matchMorale(t) - 50) / 10 + (r.all - 70) / 10;
  const k = 0.85 + 0.15 * (t.state.cond / 100);
  return { off: (off + M) * k, dif: (dif + M) * k, r };
}

function kProp(a: Atteggiamento, opp: Atteggiamento) {
  switch (a) {
    case "offensivo": return 1.2;
    case "difensivo": return 0.8;
    case "contropiede": return opp === "offensivo" || opp === "pressing" ? 1.25 : 0.9;
    case "pressing": return 1.1;
    default: return 1;
  }
}
function kConc(t: TeamCtx) {
  switch (t.choices.atteggiamento) {
    case "offensivo": return 1.15;
    case "difensivo": return t.club.coachStyle === "difensivista" ? 0.65 : 0.75;
    case "contropiede": return 0.85;
    case "pressing": return 0.9;
    default: return 1;
  }
}

export function expectedGoals(home: TeamCtx, away: TeamCtx, matchday: number): [number, number] {
  const h = strengths(home, matchday), a = strengths(away, matchday);
  const xh = XG_BASE * Math.exp((h.off - a.dif) / XG_SCALE) * kProp(home.choices.atteggiamento, away.choices.atteggiamento) * kConc(away);
  const xa = XG_BASE * Math.exp((a.off - h.dif) / XG_SCALE) * kProp(away.choices.atteggiamento, home.choices.atteggiamento) * kConc(home);
  return [xh, xa];
}

function pickScorer(rng: Rng, roster: RosterPlayer[], fuori: string | undefined): RosterPlayer {
  const group = rng.weighted([{ weight: 60 }, { weight: 30 }, { weight: 10 }]);
  const ruolo = (["ATT", "CEN", "DIF"] as const)[group];
  const pool = roster.filter((p) => p.ruolo === ruolo);
  const weighted = pool.map((p) => ({ p, weight: p.name === fuori ? 2 : 1 }));
  return weighted[rng.weighted(weighted)].p;
}

export const ASSIST_RATE = 0.7;
/** Ultimo passaggio: centrocampisti 45%, attaccanti 35%, difensori 20%; fuoriclasse peso doppio; mai il marcatore. */
function pickAssist(rng: Rng, roster: RosterPlayer[], scorer: string, fuori: string | undefined): RosterPlayer | null {
  const W = { CEN: 45, ATT: 35, DIF: 20, POR: 0 } as const;
  const pool = roster.filter((p) => p.name !== scorer && p.ruolo !== "POR");
  if (!pool.length) return null;
  const n = (r: RosterPlayer["ruolo"]) => pool.filter((p) => p.ruolo === r).length || 1;
  const ws = pool.map((p) => ({ p, weight: (W[p.ruolo] / n(p.ruolo)) * (p.name === fuori ? 2 : 1) }));
  return ws[rng.weighted(ws)].p;
}

function pickSchema(rng: Rng, t: TeamCtx, r: Ratings, scorer: RosterPlayer, isGoal: boolean): string {
  if (isGoal && rng.chance(0.08)) return "rigore";
  const wide = ["4-3-3", "3-4-3", "4-4-2", "3-5-2", "5-3-2"].includes(t.choices.modulo);
  const opts = [
    { id: "cross", weight: 2 + (wide ? 1 : 0) + (r.att > r.cen ? 1 : 0) },
    { id: "fraseggio", weight: 2 + (r.cen >= r.att ? 1 : 0) + (t.club.coachStyle === "giochista" ? 2 : 0) },
    { id: "tiro_fuori", weight: 1 + (r.cen > r.att + 3 ? 2 : 0) },
    { id: "contropiede", weight: 1 + (t.choices.atteggiamento === "contropiede" ? 4 : 0) },
    { id: "recupero", weight: 0.5 + (t.choices.atteggiamento === "pressing" ? 4 : 0) },
    { id: "piazzato", weight: 1 + (scorer.ruolo === "DIF" ? 8 : 0) },
  ];
  return opts[rng.weighted(opts)].id;
}

const POSS_ADJ: Record<Atteggiamento, number> = { equilibrato: 0, offensivo: 3, difensivo: -4, contropiede: -5, pressing: 3 };

/** Tiri dagli eventi; possesso dal confronto dei centrocampi e dagli atteggiamenti. */
export function matchStats(events: MatchEvent[], cenH: number, cenA: number, attH: Atteggiamento, attA: Atteggiamento, rng?: Rng): MatchStats {
  const shots: [number, number] = [0, 0], onTarget: [number, number] = [0, 0];
  for (const e of events) {
    if (e.type === "rosso" || e.type === "giallo") continue;
    const i = e.team === "home" ? 0 : 1;
    shots[i]++;
    if (e.type === "gol" || e.type === "parata") onTarget[i]++;
  }
  let p = 50 + (cenH - cenA) * 1.2 + POSS_ADJ[attH] - POSS_ADJ[attA] + (rng ? (rng.next() - 0.5) * 6 : 0);
  p = Math.round(clamp(p, 30, 70));
  return { shots, onTarget, possession: [p, 100 - p] };
}

export function simulateMatch(home: TeamCtx, away: TeamCtx, matchday: number, seed: string): MatchResult {
  const rng = makeRng(seed);
  const [xh, xa] = expectedGoals(home, away, matchday);
  const sh = strengths(home, matchday), sa = strengths(away, matchday);
  const teams = { home: { t: home, xg: xh, r: sh.r, goals: 0, red: false }, away: { t: away, xg: xa, r: sa.r, goals: 0, red: false } };
  const events: MatchEvent[] = [];
  const pRed = 1 - Math.pow(0.96, 1 / 6);

  for (let b = 0; b < 6; b++) {
    for (const side of ["home", "away"] as const) {
      const me = teams[side], other = teams[side === "home" ? "away" : "home"];
      if (!me.red && rng.chance(pRed)) {
        me.red = true;
        const pl = rng.pick(me.t.club.roster.filter((p) => p.ruolo !== "POR"));
        events.push({ minute: b * 15 + rng.int(1, 15), team: side, type: "rosso", player: pl.name });
      }
      let lambda = me.xg / 6;
      if (me.red) lambda *= 0.7;
      if (other.red) lambda *= 1.3;
      const goals = Math.min(rng.poisson(lambda), 7 - me.goals);
      for (let g = 0; g < goals; g++) {
        const scorer = pickScorer(rng, me.t.club.roster, me.t.club.fuoriclasse?.name);
        me.goals++;
        events.push({ minute: b * 15 + rng.int(1, 15), team: side, type: "gol", player: scorer.name, role: scorer.ruolo, schema: pickSchema(rng, me.t, me.r, scorer, true) });
      }
      const misses = rng.poisson(lambda * 1.5);
      for (let m = 0; m < misses; m++) {
        const shooter = pickScorer(rng, me.t.club.roster, me.t.club.fuoriclasse?.name);
        const kind = rng.weighted([{ weight: 5 }, { weight: 1 }, { weight: 4 }]);
        events.push({ minute: b * 15 + rng.int(1, 15), team: side, type: (["parata", "palo", "fuori"] as const)[kind], player: shooter.name, role: shooter.ruolo, schema: pickSchema(rng, me.t, me.r, shooter, false) });
      }
    }
  }
  events.sort((a, b) => a.minute - b.minute);
  // Assist con un generatore separato: non altera risultati e marcatori già tarati.
  const arng = makeRng(seed + ":assist");
  for (const e of events) {
    if (e.type !== "gol" || e.schema === "rigore" || !arng.chance(ASSIST_RATE)) continue;
    const t = teams[e.team].t;
    const ap = pickAssist(arng, t.club.roster, e.player!, t.club.fuoriclasse?.name);
    if (ap) { e.assist = ap.name; e.assistRole = ap.ruolo; }
  }
  let h = 0, a = 0;
  for (const e of events) {
    if (e.type === "gol") { if (e.team === "home") h++; else a++; }
    e.score = [h, a];
  }
  const must = events.filter((e) => e.type === "gol" || e.type === "rosso" || e.type === "palo");
  const rest = events.filter((e) => e.type === "parata" || e.type === "fuori");
  const highlights = [...must];
  for (const e of rest) { if (highlights.length >= 8) break; if (e.type === "parata" || highlights.length < 5) highlights.push(e); }
  highlights.sort((x, y) => x.minute - y.minute);
  const stats = matchStats(events, sh.r.cen, sa.r.cen, home.choices.atteggiamento, away.choices.atteggiamento, rng);
  return { homeGoals: teams.home.goals, awayGoals: teams.away.goals, xg: [Math.round(xh * 100) / 100, Math.round(xa * 100) / 100], events, highlights: highlights.slice(0, Math.max(8, must.length)), stats };
}
