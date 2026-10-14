// Partita in diretta (carriera): la partita si ferma nei momenti chiave e il giocatore decide.
// Deterministica: si risimula sempre dall'inizio con le decisioni già prese, quindi il passato non cambia.
import type { Choices, MatchEvent, MatchResult, Modulo, RosterPlayer } from "./types";
import { MODULI } from "./types";
import { makeRng, type Rng } from "./rng";
import { expectedGoals, finishMatch, pickSchema, pickScorer, strengths, type TeamCtx } from "./engine";
import { has } from "./traits";
import type { Wheel } from "./wheels";

export type Side = "home" | "away";

/** Ruota degli imprevisti in partita. data = codice effetto. */
export const MATCH_WHEEL: Wheel = {
  id: "imprevisto", title: "Imprevisto in campo", subtitle: "Cosa succede adesso?", question: "Cosa succede adesso in campo?", emoji: "⚡", palette: "rainbow",
  segments: [
    { label: "Il fuoriclasse si accende", weight: 13, data: "fuoriclasse", icon: "⭐" },
    { label: "Tifosi scatenati", weight: 13, data: "tifosi", icon: "📣" },
    { label: "Diluvio", weight: 11, data: "diluvio", icon: "🌧️" },
    { label: "Infortunio", weight: 16, data: "infortunio", icon: "🩹" },
    { label: "Rosso all'avversario", weight: 8, data: "rosso_opp", icon: "🟥" },
    { label: "Rosso per noi", weight: 8, data: "rosso_mio", icon: "🟥" },
    { label: "VAR: rigore per noi", weight: 8, data: "var_pro", icon: "📺" },
    { label: "VAR: rigore contro", weight: 8, data: "var_contro", icon: "📺" },
    { label: "Invasione di campo", weight: 18, data: "nulla", icon: "🏃" },
  ],
};

export const WHEEL_TEXT: Record<string, string> = {
  fuoriclasse: "La tua stella prende in mano la partita: attacco più pericoloso.",
  tifosi: "Lo stadio ribolle: la squadra spinge di più.",
  diluvio: "Si gioca sotto un diluvio: segnare diventa difficile per tutti.",
  infortunio: "Si fa male un titolare: la squadra soffre.",
  rosso_opp: "Espulso un avversario: si gioca in superiorità numerica.",
  rosso_mio: "Espulso un tuo giocatore: si soffre in dieci.",
  var_pro: "Il VAR richiama l'arbitro: rigore per te!",
  var_contro: "Il VAR richiama l'arbitro: rigore per gli avversari…",
  nulla: "Un tifoso invade il campo: due minuti di pausa e si riparte.",
};

export type HalfChoice = "attacco" | "compatti" | "strigliata" | `modulo:${Modulo}`;
export type EndChoice = "vincere" | "pareggio";
export type PenDir = "sx" | "centro" | "dx";

export type Decision =
  | { kind: "intervallo"; choice: HalfChoice }
  | { kind: "finale"; choice: EndChoice }
  | { kind: "rigore"; shooter: string; dir: PenDir }
  | { kind: "ruota" };

export type Pending =
  | { kind: "intervallo"; minute: 45; score: [number, number] }
  | { kind: "finale"; minute: 75; score: [number, number] }
  | { kind: "rigore"; minute: number; score: [number, number]; shooters: { name: string; ruolo: string; pct: number; tag?: string }[]; source: "azione" | "var" }
  | { kind: "ruota"; minute: number; score: [number, number]; index: number };

/** Un momento già vissuto (decisione presa e il suo esito), per il racconto. */
export type Moment = { minute: number; kind: Decision["kind"]; title: string; text: string; good?: boolean };

export type LiveOut = {
  events: MatchEvent[]; // eventi visibili fino al momento attuale
  moments: Moment[];
  pending: Pending | null;
  minute: number; // minuto in cui la partita è ferma (90 se finita)
  score: [number, number];
  result: MatchResult | null; // presente a partita finita
};

type Mods = { atk: number; opp: number; red: boolean; oppRed: boolean };
const HALF_FX: Record<string, Partial<Mods>> = { attacco: { atk: 1.3, opp: 1.35 }, compatti: { atk: 0.72, opp: 0.78 }, strigliata: {} };
const END_FX: Record<EndChoice, Partial<Mods>> = { vincere: { atk: 1.45, opp: 1.5 }, pareggio: { atk: 0.6, opp: 0.66 } };

/** Probabilità di segnare un rigore per tipo di tiratore. */
function penPct(club: TeamCtx["club"], p: RosterPlayer): number {
  const fc = club.fuoriclasse?.name === p.name;
  if (fc && has(club, "marchio_rigori")) return 0.9;
  if (fc) return 0.84;
  return p.ruolo === "ATT" ? 0.78 : p.ruolo === "CEN" ? 0.74 : 0.68;
}

function shootersFor(t: TeamCtx): { name: string; ruolo: string; pct: number; tag?: string }[] {
  const r = t.club.roster;
  const out: { name: string; ruolo: string; pct: number; tag?: string }[] = [];
  const fc = t.club.fuoriclasse ? r.find((p) => p.name === t.club.fuoriclasse!.name) : undefined;
  if (fc) out.push({ name: fc.name, ruolo: fc.ruolo, pct: penPct(t.club, fc), tag: has(t.club, "marchio_rigori") ? "Rigorista" : "Fuoriclasse" });
  for (const p of r.filter((x) => x.ruolo === "ATT" && x.name !== fc?.name).slice(0, 2)) out.push({ name: p.name, ruolo: p.ruolo, pct: penPct(t.club, p) });
  const cen = r.find((x) => x.ruolo === "CEN" && x.name !== fc?.name);
  if (out.length < 3 && cen) out.push({ name: cen.name, ruolo: cen.ruolo, pct: penPct(t.club, cen) });
  return out.slice(0, 3);
}

/** Esito di un rigore: il portiere sceglie un lato a caso. */
export function penaltyOutcome(rng: Rng, pct: number, dir: PenDir): { goal: boolean; keeper: PenDir } {
  const keeper = (["sx", "centro", "dx"] as const)[rng.weighted([{ weight: 4 }, { weight: 2 }, { weight: 4 }])];
  // stesso lato del portiere: molto più difficile; centrale: o gol facile o parata facile
  let p = pct;
  if (keeper === dir) p = dir === "centro" ? 0.15 : pct * 0.6;
  else p = Math.min(0.97, pct + 0.1);
  return { goal: rng.chance(p), keeper };
}

export function simulateLive(home: TeamCtx, away: TeamCtx, matchday: number, seed: string, user: Side, decisions: Decision[]): LiveOut {
  const ctx: Record<Side, TeamCtx> = { home: { ...home, choices: { ...home.choices } }, away: { ...away, choices: { ...away.choices } } };
  const opp: Side = user === "home" ? "away" : "home";
  const mods: Mods = { atk: 1, opp: 1, red: false, oppRed: false };
  let moraleBoost = 0;
  const events: MatchEvent[] = [];
  const moments: Moment[] = [];
  const goals = { home: 0, away: 0 };
  let di = 0, wheels = 0, penIdx = 0;
  const score = (): [number, number] => [goals.home, goals.away];
  const out = (minute: number, pending: Pending): LiveOut => ({ events: sorted(events).filter((e) => e.minute <= minute), moments, pending, minute, score: scoreAt(events, minute), result: null });

  const roster = (s: Side) => ctx[s].club.roster;
  const playerFor = (s: Side, ruoli: string[], r: Rng) => r.pick(roster(s).filter((p) => ruoli.includes(p.ruolo)));

  // forza di partenza (ricalcolata se cambia modulo o morale)
  const xgNow = (): [number, number] => {
    const t = { ...ctx[user], state: { ...ctx[user].state, morale: Math.min(100, ctx[user].state.morale + moraleBoost) } };
    const h = user === "home" ? t : ctx.home, a = user === "away" ? t : ctx.away;
    return expectedGoals(h, a, matchday);
  };
  let xg = xgNow();

  const penalty = (minute: number, source: "azione" | "var"): LiveOut | null => {
    const shooters = shootersFor(ctx[user]);
    const d = decisions[di];
    if (!d || d.kind !== "rigore") return out(minute, { kind: "rigore", minute, score: scoreAt(events, minute), shooters, source });
    di++;
    const sh = shooters.find((s) => s.name === d.shooter) ?? shooters[0];
    const res = penaltyOutcome(makeRng(`${seed}:pen:${penIdx++}`), sh.pct, d.dir);
    const p = roster(user).find((x) => x.name === sh.name);
    if (res.goal) { goals[user]++; events.push({ minute, team: user, type: "gol", player: sh.name, role: p?.ruolo, schema: "rigore" }); }
    else events.push({ minute, team: user, type: "parata", player: sh.name, role: p?.ruolo, schema: "rigore" });
    const dirTxt = { sx: "a sinistra", centro: "centrale", dx: "a destra" };
    moments.push({ minute, kind: "rigore", title: res.goal ? "Rigore trasformato!" : "Rigore parato!", good: res.goal,
      text: `${sh.name} tira ${dirTxt[d.dir]}, il portiere va ${res.keeper === "centro" ? "a restare in mezzo" : dirTxt[res.keeper]}: ${res.goal ? "gol!" : "parato."}` });
    return null;
  };

  for (let b = 0; b < 6; b++) {
    const start = b * 15;
    // intervallo
    if (b === 3) {
      const d = decisions[di];
      if (!d || d.kind !== "intervallo") return out(45, { kind: "intervallo", minute: 45, score: score() });
      di++;
      const c = d.choice;
      if (c.startsWith("modulo:")) {
        const mod = c.slice(7) as Modulo;
        if (MODULI.includes(mod)) ctx[user].choices = { ...ctx[user].choices, modulo: mod };
        moments.push({ minute: 45, kind: "intervallo", title: "Cambio modulo", text: `Si riparte con il ${mod}.` });
      } else {
        Object.assign(mods, { atk: mods.atk * (HALF_FX[c]?.atk ?? 1), opp: mods.opp * (HALF_FX[c]?.opp ?? 1) });
        if (c === "strigliata") {
          moraleBoost += 8;
          // nervi tesi: a volte qualcuno esagera
          const sr = makeRng(`${seed}:strigliata`);
          if (sr.chance(0.15) && !mods.red) { mods.red = true; events.push({ minute: 45 + sr.int(3, 25), team: user, type: "rosso", player: playerFor(user, ["DIF", "CEN"], sr).name }); }
        }
        moments.push({ minute: 45, kind: "intervallo", title: c === "attacco" ? "Tutti all'attacco" : c === "compatti" ? "Squadra compatta" : "Strigliata negli spogliatoi",
          text: c === "attacco" ? "Più uomini in avanti: più occasioni, ma si rischia dietro." : c === "compatti" ? "Linee strette: meno rischi, meno occasioni." : "Il mister alza la voce: morale alle stelle, nervi tesi." });
      }
      xg = xgNow();
    }
    // ultimi 15 minuti, se la partita è ancora aperta
    if (b === 5 && Math.abs(goals.home - goals.away) <= 1) {
      const d = decisions[di];
      if (!d || d.kind !== "finale") return out(75, { kind: "finale", minute: 75, score: score() });
      di++;
      const fx = END_FX[d.choice];
      mods.atk *= fx.atk ?? 1; mods.opp *= fx.opp ?? 1;
      moments.push({ minute: 75, kind: "finale", title: d.choice === "vincere" ? "Andiamo a vincerla" : "Portiamola a casa", text: d.choice === "vincere" ? "Tutti avanti per il gol decisivo." : "Si abbassa il baricentro e si gestisce." });
    }
    // ruota degli imprevisti (al massimo 2 a partita)
    if (b >= 1 && b <= 4 && wheels < 2) {
      const wr = makeRng(`${seed}:ruota:${b}`);
      if (wr.chance(0.42)) {
        wheels++;
        const index = wr.weighted(MATCH_WHEEL.segments);
        const minute = start + wr.int(2, 12);
        const d = decisions[di];
        if (!d || d.kind !== "ruota") return out(minute, { kind: "ruota", minute, score: scoreAt(events, minute), index });
        di++;
        const code = MATCH_WHEEL.segments[index].data as string;
        let good: boolean | undefined;
        switch (code) {
          case "fuoriclasse": mods.atk *= ctx[user].club.fuoriclasse ? 1.25 : 1.12; good = true; break;
          case "tifosi": mods.atk *= ctx[user].home ? 1.25 : 1.12; good = true; break;
          case "diluvio": mods.atk *= 0.75; mods.opp *= 0.75; break;
          case "infortunio": mods.atk *= 0.82; mods.opp *= 1.1; good = false; break;
          case "rosso_opp": if (!mods.oppRed) { mods.oppRed = true; events.push({ minute, team: opp, type: "rosso", player: playerFor(opp, ["DIF", "CEN"], wr).name }); } good = true; break;
          case "rosso_mio": if (!mods.red) { mods.red = true; events.push({ minute, team: user, type: "rosso", player: playerFor(user, ["DIF", "CEN"], wr).name }); } good = false; break;
          case "var_pro": { moments.push({ minute, kind: "ruota", title: MATCH_WHEEL.segments[index].label, text: WHEEL_TEXT[code], good: true }); const p = penalty(minute, "var"); if (p) return p; break; }
          case "var_contro": {
            const sh = playerFor(opp, ["ATT"], wr);
            const scored = wr.chance(0.78);
            if (scored) { goals[opp]++; events.push({ minute, team: opp, type: "gol", player: sh.name, role: sh.ruolo, schema: "rigore" }); }
            else events.push({ minute, team: opp, type: "parata", player: sh.name, role: sh.ruolo, schema: "rigore" });
            good = !scored;
            break;
          }
        }
        if (code !== "var_pro") moments.push({ minute, kind: "ruota", title: MATCH_WHEEL.segments[index].label, text: WHEEL_TEXT[code] + (code === "var_contro" ? (good ? " Il tuo portiere lo para!" : " Gol.") : ""), good });
      }
    }

    // gioco del blocco: dipende solo da seme, blocco e modificatori attuali
    const key = `${ctx[user].choices.modulo}|${mods.atk.toFixed(3)}|${mods.opp.toFixed(3)}|${mods.red}|${mods.oppRed}|${moraleBoost}`;
    const rng = makeRng(`${seed}:L${b}:${key}`);
    const blockPens: number[] = [];
    for (const side of ["home", "away"] as const) {
      const t = ctx[side];
      const r = strengths(t, matchday).r;
      const isUser = side === user;
      let lambda = (side === "home" ? xg[0] : xg[1]) / 6;
      lambda *= isUser ? mods.atk : mods.opp;
      if (isUser ? mods.red : mods.oppRed) lambda *= 0.7;
      if (isUser ? mods.oppRed : mods.red) lambda *= 1.3;
      const n = Math.min(rng.poisson(lambda), 7 - goals[side]);
      for (let g = 0; g < n; g++) {
        let scorer = pickScorer(rng, t.club.roster, t.club.fuoriclasse?.name, t.club);
        const minute = start + rng.int(1, 15);
        const schema = pickSchema(rng, t, r, scorer, true);
        if (isUser && schema === "rigore") { blockPens.push(minute); continue; } // il rigore lo tiri tu
        const fc = t.club.fuoriclasse;
        if (schema === "rigore" && fc && has(t.club, "marchio_rigori")) scorer = t.club.roster.find((p) => p.name === fc.name) ?? scorer;
        goals[side]++;
        events.push({ minute, team: side, type: "gol", player: scorer.name, role: scorer.ruolo, schema });
      }
      const misses = rng.poisson(lambda * 1.5);
      for (let m = 0; m < misses; m++) {
        const shooter = pickScorer(rng, t.club.roster, t.club.fuoriclasse?.name, t.club);
        const kind = rng.weighted([{ weight: 5 }, { weight: 1 }, { weight: 4 }]);
        events.push({ minute: start + rng.int(1, 15), team: side, type: (["parata", "palo", "fuori"] as const)[kind], player: shooter.name, role: shooter.ruolo, schema: pickSchema(rng, t, r, shooter, false) });
      }
    }
    for (const minute of blockPens.sort((x, y) => x - y)) { const p = penalty(minute, "azione"); if (p) return p; }
  }

  const res = finishMatch(seed + ":live", sorted(events), ctx.home, ctx.away, strengths(ctx.home, matchday).r, strengths(ctx.away, matchday).r, xg, [goals.home, goals.away], makeRng(seed + ":stats"));
  return { events: res.events, moments, pending: null, minute: 90, score: [res.homeGoals, res.awayGoals], result: res };
}

const sorted = (ev: MatchEvent[]) => [...ev].sort((a, b) => a.minute - b.minute);
function scoreAt(ev: MatchEvent[], minute: number): [number, number] {
  let h = 0, a = 0;
  for (const e of ev) if (e.type === "gol" && e.minute <= minute) { if (e.team === "home") h++; else a++; }
  return [h, a];
}

export const choicesKey = (c: Choices) => `${c.modulo}|${c.atteggiamento}`;
