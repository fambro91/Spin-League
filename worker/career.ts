// Carriera "dinastia" (modalità da solo): due divisioni, stagioni che si susseguono, partita in diretta.
import type { Env, LeagueRow, ClubRow } from "./db";
import { nowIso, romeNow } from "./db";
import { addNews, bundle, getLeague, id, loadClubs, loadMatches, playMatchday, publicClub } from "./game";
import type { ClubBundle } from "../shared/league";
import { assignRivals, bergerSchedule, choicesFor, isDerby, penaltyOf, standings } from "../shared/league";
import { cryptoRng, makeRng, randomToken } from "../shared/rng";
import { newCreation, doSpin } from "../shared/wheels";
import { computeClub, cpuIdentity, initialState, uniqueClubName } from "../shared/club";
import { simulateLive, type Decision } from "../shared/live";
import type { MatchResult } from "../shared/types";
import {
  ageClub, applyEndWheel, DIV_LABEL, END_WHEELS, expectedPosition, newCareerData, objectiveFrom, objectiveMet, objectiveWheel, PROMO, resetForSeason,
  type CareerData, type Division, type ObjectiveId, type SeasonSummary,
} from "../shared/career";

type CareerRow = { league_id: string; shadow_id: string; division: Division; data: string };

export async function getCareer(env: Env, leagueId: string) {
  const r = await env.DB.prepare("SELECT * FROM careers WHERE league_id = ?").bind(leagueId).first<CareerRow>();
  return r ? { row: r, data: JSON.parse(r.data) as CareerData } : null;
}
async function saveCareer(env: Env, leagueId: string, division: Division, data: CareerData) {
  await env.DB.prepare("UPDATE careers SET division = ?, data = ? WHERE league_id = ?").bind(division, JSON.stringify(data), leagueId).run();
}

function cpuClub(rng: ReturnType<typeof cryptoRng>) {
  const cs = newCreation();
  while (cs.queue.length) doSpin(cs, rng);
  const cid = id();
  const club = computeClub(cs.draft, cpuIdentity(cid, cs.draft.city ?? "Lucca"), cid);
  return { id: cid, club, state: initialState(club), isCpu: true, creation: JSON.stringify(cs) };
}

const insertClub = (env: Env, leagueId: string, season: number, b: { id: string; club: any; state: any; creation?: string }, playerId: string | null = null) =>
  env.DB.prepare("INSERT INTO clubs (id, league_id, season, player_id, is_cpu, status, creation, club, state, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(b.id, leagueId, season, playerId, playerId ? 0 : 1, "ready", b.creation ?? null, JSON.stringify(b.club), JSON.stringify(b.state), nowIso());

/** Prima stagione: crea la Serie A (solo bot) e riempie la Serie B intorno al club del giocatore. */
export async function careerSetup(env: Env, l: LeagueRow, teams: number) {
  if (await getCareer(env, l.id)) throw new Error("La carriera è già impostata.");
  const rows = await loadClubs(env, l);
  const mine = rows.find((r) => !r.is_cpu);
  if (!mine || mine.status !== "ready") throw new Error("Prima crea il tuo club.");
  const n = Math.max(6, Math.min(12, teams - (teams % 2)));
  const rng = cryptoRng();
  // 2n−1 bot: i più forti in A, gli altri in B con te
  const bots = Array.from({ length: 2 * n - 1 }, () => cpuClub(rng)).sort((a, b) => b.club.voto - a.club.voto);
  // nomi tutti diversi tra le due divisioni
  const used = new Set<string>(rows.filter((r) => r.club).map((r) => JSON.parse(r.club!).name));
  for (const b of bots) b.club.name = uniqueClubName(b.club.name, b.club.city, used);
  const aBots = bots.slice(0, n), bBots = bots.slice(n);
  const shadowId = id();
  const stmts: D1PreparedStatement[] = [];
  stmts.push(env.DB.prepare("INSERT INTO leagues (id, name, admin_hash, seed, season, status, matchday_played, total_matchdays, market_open, history, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(shadowId, "Serie A", "shadow:" + randomToken(16), randomToken(16), l.season, "setup", 0, 0, 0, "[]", nowIso()));
  for (const b of aBots) stmts.push(insertClub(env, shadowId, l.season, b));
  for (const b of bBots) stmts.push(insertClub(env, l.id, l.season, b));
  const data = newCareerData(n);
  stmts.push(env.DB.prepare("INSERT INTO careers (league_id, shadow_id, division, data) VALUES (?,?,?,?)").bind(l.id, shadowId, "B", JSON.stringify(data)));
  await env.DB.batch(stmts);
}

/** Club del giocatore e della sua divisione (lega della carriera). */
async function myBundles(env: Env, l: LeagueRow) {
  const rows = await loadClubs(env, l);
  const ready = rows.filter((r) => r.status === "ready").map(bundle);
  const me = ready.find((b) => !b.isCpu) ?? null;
  return { rows, ready, me };
}

/** Gira la prossima ruota di pre o fine stagione. */
export async function careerWheel(env: Env, l: LeagueRow) {
  const car = await getCareer(env, l.id);
  if (!car) throw new Error("Carriera non trovata.");
  if (l.status !== "setup") throw new Error("Le ruote si girano prima della stagione.");
  const wheelId = car.data.wheels[0];
  if (!wheelId) throw new Error("Nessuna ruota da girare.");
  const { ready, me } = await myBundles(env, l);
  if (!me) throw new Error("Prima crea il tuo club.");
  const rng = cryptoRng();
  let wheel = END_WHEELS[wheelId];
  if (wheelId === "obiettivo") wheel = objectiveWheel(car.row.division, car.data.teams, expectedPosition(me.id, ready.map((b) => ({ id: b.id, voto: b.club.voto }))), me.club);
  if (wheelId === "rinnovo" && !me.club.fuoriclasse) { car.data.wheels.shift(); await saveCareer(env, l.id, car.row.division, car.data); return careerWheel(env, l); }
  const index = rng.weighted(wheel.segments);
  const seg = wheel.segments[index];
  let note: string;
  if (wheelId === "obiettivo") {
    car.data.objective = objectiveFrom(car.row.division, car.data.teams, seg.data as ObjectiveId, me.club, me.state.budget);
    note = car.data.objective.bilancio ? "Il presidente vuole anche il bilancio in attivo." : "Il presidente conta su di te.";
  } else {
    note = applyEndWheel(wheelId, seg.data, me.club, me.state, rng);
  }
  car.data.wheels.shift();
  car.data.spins.push({ wheel: wheelId, label: seg.label, note });
  me.state.budget = Math.round(me.state.budget * 10) / 10;
  await env.DB.batch([
    env.DB.prepare("UPDATE clubs SET club = ?, state = ? WHERE id = ?").bind(JSON.stringify(me.club), JSON.stringify(me.state), me.id),
    env.DB.prepare("UPDATE careers SET data = ? WHERE league_id = ?").bind(JSON.stringify(car.data), l.id),
  ]);
  return { wheel, index, label: seg.label, note, next: car.data.wheels[0] ?? null };
}

async function schedule(env: Env, l: LeagueRow, ids: string[], marketOpen: boolean, stmts: D1PreparedStatement[]) {
  const rng = cryptoRng();
  const all = [...ids];
  for (let i = all.length - 1; i > 0; i--) { const j = rng.int(0, i); [all[i], all[j]] = [all[j], all[i]]; }
  const sched = bergerSchedule(all.length);
  sched.forEach((round, r) => {
    for (const [a, b] of round) stmts.push(env.DB.prepare("INSERT INTO matches (id, league_id, season, matchday, home_id, away_id, played) VALUES (?,?,?,?,?,?,0)").bind(id(), l.id, l.season, r + 1, all[a], all[b]));
  });
  stmts.push(env.DB.prepare("UPDATE leagues SET status = 'running', start_date = ?, total_matchdays = ?, matchday_played = 0, market_open = ? WHERE id = ?").bind(romeNow().date, sched.length, marketOpen ? 1 : 0, l.id));
  return sched.length;
}

/** Fischio d'inizio della stagione: calendario per entrambe le divisioni. */
export async function careerKickoff(env: Env, l: LeagueRow) {
  const car = await getCareer(env, l.id);
  if (!car) throw new Error("Carriera non trovata.");
  if (l.status !== "setup") throw new Error("La stagione è già iniziata.");
  if (car.data.wheels.length) throw new Error("Prima gira le ruote della società.");
  const shadow = (await getLeague(env, car.row.shadow_id))!;
  const { rows, ready, me } = await myBundles(env, l);
  if (!me || rows.some((r) => r.status !== "ready")) throw new Error("Prima completa il tuo club.");
  const stmts: D1PreparedStatement[] = [];
  let mineIds = ready.map((b) => b.id);
  // dopo un esonero la tua divisione ha un club in più: esce il bot più debole
  if (mineIds.length > car.data.teams) {
    const weakest = ready.filter((b) => b.isCpu).sort((a, b) => a.club.voto - b.club.voto)[0];
    stmts.push(env.DB.prepare("UPDATE clubs SET season = -1 WHERE id = ?").bind(weakest.id));
    mineIds = mineIds.filter((x) => x !== weakest.id);
  }
  const shadowRows = await loadClubs(env, shadow);
  const shadowIds = shadowRows.map((r) => r.id);
  // nessun bot con lo stesso nome del tuo club (o di un altro bot)
  const used = new Set<string>([me.club.name]);
  for (const b of [...ready.filter((x) => x.isCpu), ...shadowRows.map(bundle)]) {
    const nm = uniqueClubName(b.club.name, b.club.city, used);
    if (nm !== b.club.name) { b.club.name = nm; stmts.push(env.DB.prepare("UPDATE clubs SET club = ? WHERE id = ?").bind(JSON.stringify(b.club), b.id)); }
  }
  if (l.season === 1) {
    // rivalità storiche tra tutti i club delle due divisioni
    const allB = [...ready.filter((b) => mineIds.includes(b.id)), ...shadowRows.map(bundle)];
    assignRivals(allB, cryptoRng());
    for (const b of allB) stmts.push(env.DB.prepare("UPDATE clubs SET state = ? WHERE id = ?").bind(JSON.stringify(b.state), b.id));
  }
  const total = await schedule(env, l, mineIds, l.season > 1, stmts);
  await schedule(env, shadow, shadowIds, false, stmts);
  await env.DB.batch(stmts);
  await addNews(env, l, null, "info", `${DIV_LABEL[car.row.division]}: si parte!`, `${mineIds.length} squadre, ${total} giornate. Obiettivo: ${car.data.objective?.label ?? "—"}.${l.season > 1 ? " Il mercato estivo resta aperto fino alla prima giornata." : ""}`);
}

/** Squadre dei due campionati e la classifica dell'altra divisione. */
export async function careerView(env: Env, l: LeagueRow) {
  const car = await getCareer(env, l.id);
  if (!car) return null;
  const shadow = (await getLeague(env, car.row.shadow_id))!;
  const sRows = (await loadClubs(env, shadow)).map(bundle);
  const sMatches = await loadMatches(env, shadow);
  const played = sMatches.filter((m) => m.played).map((m) => ({ matchday: m.matchday, homeId: m.home_id, awayId: m.away_id, homeGoals: m.home_goals!, awayGoals: m.away_goals! }));
  const otherTable = standings(sRows.map((b) => ({ id: b.id, name: b.club.name, colors: b.club.colors, owner: "CPU", pen: penaltyOf(b.club) })), played, shadow.seed);
  let wheel: any = null;
  const next = car.data.wheels[0];
  if (next && next !== "obiettivo") wheel = END_WHEELS[next];
  if (next === "obiettivo") {
    const { ready, me } = await myBundles(env, l);
    if (me) wheel = objectiveWheel(car.row.division, car.data.teams, expectedPosition(me.id, ready.map((b) => ({ id: b.id, voto: b.club.voto }))), me.club);
  }
  return {
    division: car.row.division, divisionLabel: DIV_LABEL[car.row.division], otherLabel: DIV_LABEL[car.row.division === "A" ? "B" : "A"],
    otherTable, otherClubs: sRows.map(publicClub), teams: car.data.teams, promo: PROMO,
    objective: car.data.objective, fiducia: car.data.fiducia, fails: car.data.fails, palmares: car.data.palmares,
    wheels: car.data.wheels, nextWheel: next ?? null, wheelDef: wheel, summary: car.data.summary, spins: car.data.spins,
  };
}

/* ---------- partita in diretta ---------- */

async function liveContext(env: Env, l: LeagueRow, c: ClubRow) {
  if (l.status !== "running") throw new Error("Il campionato non è in corso.");
  const md = l.matchday_played + 1;
  const { ready } = await myBundles(env, l);
  const clubs = new Map(ready.map((b) => [b.id, b]));
  const mt = (await loadMatches(env, l)).find((m) => m.matchday === md && (m.home_id === c.id || m.away_id === c.id));
  if (!mt) throw new Error("Nessuna partita per te in questa giornata.");
  const H = clubs.get(mt.home_id)!, A = clubs.get(mt.away_id)!;
  const derby = isDerby(H, A);
  const hc = choicesFor(H.club, H.state, H.isCpu, md), ac = choicesFor(A.club, A.state, A.isCpu, md);
  const user = mt.home_id === c.id ? "home" as const : "away" as const;
  const me = user === "home" ? H : A;
  return { md, mt, H, A, me, run: (dec: Decision[]) => simulateLive({ club: H.club, state: H.state, choices: hc, home: true, derby }, { club: A.club, state: A.state, choices: ac, home: false, derby }, md, `${l.seed}:${mt.id}`, user, dec), user, derby };
}

export async function liveStep(env: Env, l: LeagueRow, c: ClubRow, decision?: Decision) {
  const ctx = await liveContext(env, l, c);
  const st = ctx.me.state;
  if (!st.live || st.live.md !== ctx.md) st.live = { md: ctx.md, decisions: [] };
  if (decision) {
    const before = ctx.run(st.live.decisions);
    if (!before.pending) throw new Error("La partita è già finita.");
    if (before.pending.kind !== decision.kind) throw new Error("Decisione non attesa in questo momento.");
    st.live.decisions.push(decision);
  }
  const out = ctx.run(st.live.decisions);
  await env.DB.prepare("UPDATE clubs SET state = ? WHERE id = ?").bind(JSON.stringify(st), c.id).run();
  return { md: ctx.md, matchId: ctx.mt.id, homeId: ctx.H.id, awayId: ctx.A.id, user: ctx.user, derby: ctx.derby, ...out, result: out.result ? { homeGoals: out.result.homeGoals, awayGoals: out.result.awayGoals } : null };
}

/** Gioca la giornata in entrambe le divisioni (la tua partita usa il risultato della diretta, se c'è). */
export async function careerPlay(env: Env, l: LeagueRow) {
  const car = await getCareer(env, l.id);
  if (!car) throw new Error("Carriera non trovata.");
  const overrides = new Map<string, MatchResult>();
  const { me } = await myBundles(env, l);
  const md = l.matchday_played + 1;
  if (me && me.state.live?.md === md) {
    const rows = await loadClubs(env, l);
    const c = rows.find((r) => r.id === me.id)!;
    const ctx = await liveContext(env, l, c);
    const out = ctx.run(me.state.live.decisions);
    if (out.result) overrides.set(ctx.mt.id, out.result);
  }
  const r = await playMatchday(env, l, overrides);
  if (!r) throw new Error("Nessuna giornata da giocare.");
  const shadow = await getLeague(env, car.row.shadow_id);
  if (shadow && shadow.status === "running" && shadow.matchday_played < r.matchday) await playMatchday(env, shadow);
  return r;
}

/* ---------- fine stagione ---------- */

export async function careerEndSeason(env: Env, l: LeagueRow) {
  const car = await getCareer(env, l.id);
  if (!car) throw new Error("Carriera non trovata.");
  if (l.status !== "finished") throw new Error("La stagione non è ancora finita.");
  const shadow = (await getLeague(env, car.row.shadow_id))!;
  const div = car.row.division, otherDiv: Division = div === "A" ? "B" : "A";
  const n = car.data.teams;
  const rng = cryptoRng();

  const table = async (lg: LeagueRow) => {
    const bs = (await loadClubs(env, lg)).filter((r) => r.status === "ready").map(bundle);
    const ms = (await loadMatches(env, lg)).filter((m) => m.played).map((m) => ({ matchday: m.matchday, homeId: m.home_id, awayId: m.away_id, homeGoals: m.home_goals!, awayGoals: m.away_goals! }));
    return { bs, rows: standings(bs.map((b) => ({ id: b.id, name: b.club.name, colors: b.club.colors, owner: b.owner, pen: penaltyOf(b.club) })), ms, lg.seed) };
  };
  const mine = await table(l), other = await table(shadow);
  const A = div === "A" ? mine : other, B = div === "B" ? mine : other;
  const promotedIds = B.rows.slice(0, PROMO).map((r) => r.id), relegatedIds = A.rows.slice(-PROMO).map((r) => r.id);
  const me = mine.bs.find((b) => !b.isCpu)!;
  const pos = mine.rows.findIndex((r) => r.id === me.id) + 1;
  const ok = objectiveMet(car.data.objective, pos, me.state.budget);
  const champ = pos === 1;
  const you = promotedIds.includes(me.id) ? "promosso" as const : relegatedIds.includes(me.id) ? "retrocesso" as const : div === "A" && champ ? "campione" as const : null;

  // fiducia della società
  const before = car.data.fiducia;
  car.data.fiducia = Math.max(0, Math.min(100, before + (ok ? 25 : -35) + (champ ? 10 : 0)));
  car.data.fails = ok ? 0 : car.data.fails + 1;
  const esonero = car.data.fiducia <= 0 || car.data.fails >= 2;
  const outcome = esonero ? "Esonerato" : you === "campione" ? "Campione d'Italia" : you === "promosso" ? (champ ? "Campione di B, promosso" : "Promosso in A") : you === "retrocesso" ? "Retrocesso in B" : champ ? "Campione" : ok ? "Obiettivo centrato" : "Obiettivo mancato";
  car.data.palmares.push({ season: l.season, division: div, club: me.club.name, pos, n, outcome, objective: car.data.objective?.label ?? "—", ok });

  // premi in denaro
  if (you === "promosso") me.state.budget += 30;
  if (you === "campione") me.state.budget += 40;
  if (champ && div === "B") me.state.budget += 10;

  // invecchiamento e ripartenza di tutti i club
  const notes: string[] = [];
  const all = [...A.bs, ...B.bs];
  for (const b of all) {
    const ns = ageClub(b.club, b.state, rng, b.isCpu);
    if (b.id === me.id) notes.push(...ns);
    resetForSeason(b.state, b.club);
  }
  // nuove divisioni
  const newA = A.bs.filter((b) => !relegatedIds.includes(b.id)).concat(B.bs.filter((b) => promotedIds.includes(b.id)));
  const newB = B.bs.filter((b) => !promotedIds.includes(b.id)).concat(A.bs.filter((b) => relegatedIds.includes(b.id)));
  let myDiv: Division = newA.some((b) => b.id === me.id) ? "A" : "B";

  const season = l.season + 1;
  const stmts: D1PreparedStatement[] = [];
  if (esonero) {
    // il tuo vecchio club diventa un bot; tu riparti dalla B con un club nuovo
    me.isCpu = true;
    stmts.push(env.DB.prepare("UPDATE clubs SET is_cpu = 1, player_id = NULL WHERE id = ?").bind(me.id));
    myDiv = "B";
  }
  const toMine = myDiv === "A" ? newA : newB, toShadow = myDiv === "A" ? newB : newA;
  for (const b of toMine) stmts.push(env.DB.prepare("UPDATE clubs SET league_id = ?, season = ?, club = ?, state = ? WHERE id = ?").bind(l.id, season, JSON.stringify(b.club), JSON.stringify(b.state), b.id));
  for (const b of toShadow) stmts.push(env.DB.prepare("UPDATE clubs SET league_id = ?, season = ?, club = ?, state = ? WHERE id = ?").bind(shadow.id, season, JSON.stringify(b.club), JSON.stringify(b.state), b.id));
  // le leghe ripartono: la storia della stagione indica la divisione
  const hist = JSON.parse(l.history || "[]");
  if (hist.length) hist[hist.length - 1].division = DIV_LABEL[div];
  stmts.push(env.DB.prepare("UPDATE leagues SET season = ?, status = 'setup', start_date = NULL, matchday_played = 0, total_matchdays = 0, market_open = 0, history = ? WHERE id = ?").bind(season, JSON.stringify(hist), l.id));
  stmts.push(env.DB.prepare("UPDATE leagues SET season = ?, status = 'setup', start_date = NULL, matchday_played = 0, total_matchdays = 0, market_open = 0, name = ? WHERE id = ?").bind(season, DIV_LABEL[myDiv === "A" ? "B" : "A"], shadow.id));

  const summary: SeasonSummary = {
    season: l.season, division: div, pos, n, club: me.club.name, objective: car.data.objective, ok,
    fiducia: car.data.fiducia, fiduciaDelta: car.data.fiducia - before, you,
    promoted: B.rows.slice(0, PROMO).map((r) => r.name), relegated: A.rows.slice(-PROMO).map((r) => r.name), notes, esonero,
  };
  car.data.summary = summary;
  car.data.objective = null;
  car.data.spins = [];
  if (esonero) { car.data.fiducia = 60; car.data.fails = 0; car.data.wheels = ["obiettivo"]; }
  else car.data.wheels = ["giovanili", ...(me.club.fuoriclasse ? ["rinnovo"] : []), "sponsor", "obiettivo"];
  stmts.push(env.DB.prepare("UPDATE careers SET division = ?, data = ? WHERE league_id = ?").bind(myDiv, JSON.stringify(car.data), l.id));
  await env.DB.batch(stmts);
  void otherDiv; void makeRng;
  return summary;
}

export type { ClubBundle };
