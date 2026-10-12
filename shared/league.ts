import type { Choices, Club, ClubState, MatchResult, Reparto } from "./types";
import { REPARTO_LABEL } from "./types";
import { clamp } from "./club";
import type { Rng } from "./rng";
import { makeRng } from "./rng";

/** Calendario all'italiana (metodo del cerchio / Berger). Ritorno = andata a campi invertiti. */
export function bergerSchedule(n: number): [number, number][][] {
  const ids = Array.from({ length: n }, (_, i) => i);
  const rounds: [number, number][][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const round: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop()!);
  }
  const ritorno = rounds.map((round) => round.map(([a, b]) => [b, a] as [number, number]));
  return [...rounds, ...ritorno];
}

export type Row = {
  id: string; name: string; colors: [string, string]; owner: string;
  g: number; v: number; n: number; p: number; gf: number; gs: number; pt: number; form: string[];
};

export type PlayedMatch = { matchday: number; homeId: string; awayId: string; homeGoals: number; awayGoals: number };

export function standings(clubs: { id: string; name: string; colors: [string, string]; owner: string }[], matches: PlayedMatch[], seed = "x"): Row[] {
  const rows = new Map<string, Row>();
  for (const c of clubs) rows.set(c.id, { id: c.id, name: c.name, colors: c.colors, owner: c.owner, g: 0, v: 0, n: 0, p: 0, gf: 0, gs: 0, pt: 0, form: [] });
  const sorted = [...matches].sort((a, b) => a.matchday - b.matchday);
  for (const m of sorted) {
    const h = rows.get(m.homeId), a = rows.get(m.awayId);
    if (!h || !a) continue;
    h.g++; a.g++; h.gf += m.homeGoals; h.gs += m.awayGoals; a.gf += m.awayGoals; a.gs += m.homeGoals;
    if (m.homeGoals > m.awayGoals) { h.v++; a.p++; h.pt += 3; h.form.push("V"); a.form.push("P"); }
    else if (m.homeGoals < m.awayGoals) { a.v++; h.p++; a.pt += 3; a.form.push("V"); h.form.push("P"); }
    else { h.n++; a.n++; h.pt++; a.pt++; h.form.push("N"); a.form.push("N"); }
  }
  const list = [...rows.values()];
  const h2h = (ids: Set<string>, id: string) => {
    let pt = 0;
    for (const m of matches) {
      if (!ids.has(m.homeId) || !ids.has(m.awayId)) continue;
      if (m.homeId === id) pt += m.homeGoals > m.awayGoals ? 3 : m.homeGoals === m.awayGoals ? 1 : 0;
      if (m.awayId === id) pt += m.awayGoals > m.homeGoals ? 3 : m.homeGoals === m.awayGoals ? 1 : 0;
    }
    return pt;
  };
  const rng = makeRng("tie:" + seed);
  const tiebreak = new Map(list.map((r) => [r.id, rng.next()]));
  list.sort((a, b) => {
    if (b.pt !== a.pt) return b.pt - a.pt;
    const tied = new Set(list.filter((r) => r.pt === a.pt).map((r) => r.id));
    const ha = h2h(tied, a.id), hb = h2h(tied, b.id);
    if (hb !== ha) return hb - ha;
    const da = a.gf - a.gs, db = b.gf - b.gs;
    if (db !== da) return db - da;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return tiebreak.get(a.id)! - tiebreak.get(b.id)!;
  });
  for (const r of list) r.form = r.form.slice(-5);
  return list;
}

export function cpuChoices(c: Club, s: ClubState): Choices {
  return {
    modulo: c.preferredModule === "tutti" ? "4-3-3" : c.preferredModule,
    atteggiamento: "equilibrato",
    turnover: s.cond < 70 ? "parziale" : "nessuno",
    discorso: "nessuno",
  };
}

/** Scelte effettive per la giornata: chi non conferma tiene le ultime, senza discorso, con turnover automatico se stanco. */
export function choicesFor(c: Club, s: ClubState, isCpu: boolean, matchday: number): Choices {
  if (isCpu) return cpuChoices(c, s);
  if (s.confirmedFor === matchday) return s.choices;
  return { ...s.choices, discorso: "nessuno", turnover: s.cond < 60 ? "parziale" : s.choices.turnover };
}

/** Aggiorna condizione, morale, budget dopo la partita. */
export function afterMatch(c: Club, s: ClubState, ch: Choices, goalsFor: number, goalsAgainst: number, home: boolean, derby: boolean, matchday: number) {
  const pressCost = ch.atteggiamento === "pressing" && c.coachStyle !== "visionario" ? 15 : 10;
  const rec = (c.coachStyle === "sergente" ? 9 : 6) + (ch.turnover === "parziale" ? 6 : ch.turnover === "massiccio" ? 15 : 0);
  s.cond = clamp(s.cond - pressCost + rec, 0, 100);

  let m = s.morale;
  if (ch.discorso === "motivare") m += 5;
  if (ch.discorso === "calmare") m += m > 50 ? -Math.min(10, m - 50) : Math.min(10, 50 - m);
  const mult = derby ? 2 : 1;
  const res: "V" | "N" | "P" = goalsFor > goalsAgainst ? "V" : goalsFor === goalsAgainst ? "N" : "P";
  if (res === "V") m += 8 * mult;
  if (res === "P") m -= 6 * mult + (ch.discorso === "motivare" ? 5 : 0);
  if (c.coachStyle === "motivatore") m = Math.max(40, m);
  s.morale = clamp(Math.round(m), 0, 100);

  s.budget = Math.round((s.budget + (home ? c.stadium.incasso : 0) + (res === "V" ? 1 : 0)) * 10) / 10;
  if (home) s.campoSqualificato = false;
  s.modifiers = s.modifiers.filter((x) => x.untilMatchday > matchday);
  s.choices = { ...s.choices, discorso: "nessuno" };
  s.lastResults = [...s.lastResults, res].slice(-5);
  return res;
}

export const DAILY_EVENTS = [
  { id: "tranquilla", label: "Settimana tranquilla", weight: 5 },
  { id: "infortunio", label: "Infortunio", weight: 3 },
  { id: "polemica", label: "Polemica arbitrale", weight: 2 },
  { id: "festa", label: "Tifosi in festa", weight: 2 },
  { id: "squalifica", label: "Squalifica", weight: 2 },
  { id: "rissa", label: "Rissa nello spogliatoio", weight: 2 },
  { id: "mecenate", label: "Mecenate", weight: 1 },
  { id: "talento", label: "Talento dalla Primavera", weight: 1 },
  { id: "fuga", label: "Il fuoriclasse vuole andare via", weight: 1 },
  { id: "campo", label: "Squalifica del campo", weight: 1 },
];

const EVENT_REPS: Reparto[] = ["por", "dif", "cen", "att", "pan"];

export type ClubBundle = { id: string; club: Club; state: ClubState; isCpu: boolean };

/** Gira la ruota evento per un club a caso. matchday = giornata appena giocata. */
export type DayEvent = { clubId: string | null; eventId: string; eventIndex: number; text: string };

export function dailyEvent(rng: Rng, clubs: ClubBundle[], matchday: number): DayEvent {
  for (let tries = 0; tries < 12; tries++) {
    const evIdx = rng.weighted(DAILY_EVENTS);
    const ev = DAILY_EVENTS[evIdx];
    const b = rng.pick(clubs);
    const { club: c, state: s } = b;
    const rep = rng.pick(EVENT_REPS);
    const R = REPARTO_LABEL[rep];
    switch (ev.id) {
      case "tranquilla": return { clubId: null, eventId: ev.id, eventIndex: evIdx, text: "Settimana tranquilla: nessuna notizia." };
      case "infortunio":
        s.modifiers.push({ rep, delta: -5, untilMatchday: matchday + 3, label: "Infortunio" });
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: infortunio, ${R} −5 per 3 giornate.` };
      case "polemica":
        s.morale = clamp(s.morale - 10, 0, 100);
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: polemica arbitrale, morale −10.` };
      case "festa":
        s.morale = clamp(s.morale + 10, 0, 100);
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: tifosi in festa, morale +10.` };
      case "squalifica":
        s.modifiers.push({ rep, delta: -4, untilMatchday: matchday + 1, label: "Squalifica" });
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: squalifica, ${R} −4 nella prossima giornata.` };
      case "rissa":
        s.morale = clamp(s.morale - 15, 0, 100);
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: rissa nello spogliatoio, morale −15.` };
      case "mecenate":
        s.budget += 30;
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: arriva un mecenate, +30 M€.` };
      case "talento":
        s.ratings[rep] = clamp(s.ratings[rep] + 3, 40, 99);
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: talento dalla Primavera, ${R} +3.` };
      case "fuga":
        if (!c.fuoriclasse) continue;
        if (b.isCpu) {
          if (rng.chance(0.5)) { sellFuoriclasse(c, s); return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: il fuoriclasse è stato venduto per 60 M€.` }; }
          s.morale = clamp(s.morale - 10, 0, 100);
          return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: il fuoriclasse resta, ma lo spogliatoio è nervoso (morale −10).` };
        }
        s.pendingDecision = "fuoriclasse";
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: ${c.fuoriclasse.name} vuole andare via. Il presidente deve decidere.` };
      case "campo":
        if (!c.fans.ultras) continue;
        s.campoSqualificato = true;
        return { clubId: b.id, eventId: ev.id, eventIndex: evIdx, text: `${c.name}: campo squalificato, prossima partita in casa senza fattore campo.` };
    }
  }
  return { clubId: null, eventId: "tranquilla", eventIndex: 0, text: "Settimana tranquilla: nessuna notizia." };
}

export function sellFuoriclasse(c: Club, s: ClubState) {
  if (!c.fuoriclasse) return;
  s.ratings[c.fuoriclasse.ruolo] = clamp(s.ratings[c.fuoriclasse.ruolo] - c.fuoriclasse.bonus, 40, 99);
  s.budget += 60;
  c.fuoriclasse = null;
  s.pendingDecision = null;
}

export function marketCost(value: number) { return 2 * Math.max(0, value - 50); }
export function marketIncome(value: number) { return Math.max(0, value - 50); }

export function marketOp(s: ClubState, op: "buy" | "sell", rep: Reparto): string | null {
  if (s.marketOps >= 2) return "Hai già fatto 2 operazioni in questa finestra.";
  const v = s.ratings[rep];
  const delta = s.marketDelta[rep] ?? 0;
  if (op === "buy") {
    if (delta + 2 > 4) return "Questo reparto può salire al massimo di 4 punti per finestra.";
    if (v >= 99) return "Reparto già al massimo.";
    const cost = marketCost(v);
    if (s.budget < cost) return `Servono ${cost} M€, ne hai ${s.budget}.`;
    s.budget -= cost;
    s.ratings[rep] = clamp(v + 2, 40, 99);
    s.marketDelta[rep] = delta + 2;
  } else {
    if (v <= 40) return "Reparto già al minimo.";
    s.budget += marketIncome(v);
    s.ratings[rep] = clamp(v - 2, 40, 99);
    s.marketDelta[rep] = delta - 2;
  }
  s.marketOps++;
  return null;
}

export type Award = { title: string; clubId: string | null; text: string };

export function seasonAwards(rows: Row[], clubs: ClubBundle[], scorers: Map<string, { name: string; clubId: string; goals: number }>): Award[] {
  const byId = new Map(clubs.map((c) => [c.id, c]));
  const awards: Award[] = [];
  const champ = rows[0];
  if (champ) awards.push({ title: "Scudetto", clubId: champ.id, text: `${champ.name} (${champ.owner})` });
  const last = rows[rows.length - 1];
  if (last) awards.push({ title: "Cucchiaio di legno", clubId: last.id, text: `${last.name} (${last.owner})` });
  const top = [...scorers.values()].sort((a, b) => b.goals - a.goals)[0];
  if (top) awards.push({ title: "Capocannoniere", clubId: top.clubId, text: `${top.name}, ${top.goals} gol (${byId.get(top.clubId)?.club.name ?? ""})` });
  const bestDef = [...rows].sort((a, b) => a.gs - b.gs)[0];
  if (bestDef) awards.push({ title: "Miglior difesa", clubId: bestDef.id, text: `${bestDef.name}, ${bestDef.gs} gol subiti` });
  const expected = [...clubs].sort((a, b) => b.club.voto - a.club.voto).map((c) => c.id);
  let best: { id: string; diff: number } | null = null;
  rows.forEach((r, i) => {
    const diff = expected.indexOf(r.id) - i;
    if (!best || diff > best.diff) best = { id: r.id, diff };
  });
  if (best) {
    const b = byId.get((best as { id: string }).id)!;
    awards.push({ title: "Allenatore dell'anno", clubId: b.id, text: `${b.club.name}: ${(best as { diff: number }).diff >= 0 ? "+" : ""}${(best as { diff: number }).diff} posizioni rispetto al pronostico` });
  }
  if (champ) {
    const c = byId.get(champ.id);
    if (c && ["C", "D", "E"].includes(c.club.classe)) awards.push({ title: "Miracolo sportivo", clubId: c.id, text: `${c.club.name} campione con una squadra di classe ${c.club.classe}` });
  }
  return awards;
}
