import type { Env, LeagueRow, ClubRow, MatchRow, PlayerRow } from "./db";
import { addDays, nowIso, romeNow } from "./db";
import type { Club, ClubState, CreationState, MatchResult, Reparto } from "../shared/types";
import { REPARTI } from "../shared/types";
import { makeRng, cryptoRng, randomToken } from "../shared/rng";
import { newCreation, doSpin } from "../shared/wheels";
import { computeClub, cpuIdentity, initialState } from "../shared/club";
import { simulateMatch } from "../shared/engine";
import { afterMatch, bergerSchedule, choicesFor, dailyEvent, marketOp, seasonAwards, standings, type ClubBundle } from "../shared/league";
import { aiChronicle, journalFor, type DaySummary } from "./chronicle";
import { esc, tgSend } from "./telegram";

export const id = () => randomToken(9);

export async function getLeague(env: Env, leagueId: string) {
  return env.DB.prepare("SELECT * FROM leagues WHERE id = ?").bind(leagueId).first<LeagueRow>();
}

export async function loadClubs(env: Env, l: LeagueRow): Promise<(ClubRow & { owner: string })[]> {
  const { results } = await env.DB.prepare(
    "SELECT c.*, COALESCE(p.name, 'CPU') AS owner FROM clubs c LEFT JOIN players p ON p.id = c.player_id WHERE c.league_id = ? AND c.season = ? ORDER BY c.created_at",
  ).bind(l.id, l.season).all<ClubRow & { owner: string }>();
  return results;
}

export async function loadMatches(env: Env, l: LeagueRow) {
  const { results } = await env.DB.prepare("SELECT * FROM matches WHERE league_id = ? AND season = ? ORDER BY matchday, id").bind(l.id, l.season).all<MatchRow>();
  return results;
}

export function bundle(r: ClubRow & { owner?: string }): ClubBundle & { owner: string } {
  return { id: r.id, club: JSON.parse(r.club!), state: JSON.parse(r.state!), isCpu: !!r.is_cpu, owner: r.owner ?? "CPU" };
}

/** Crea (se manca) il club della stagione corrente per il giocatore. */
export async function ensurePlayerClub(env: Env, l: LeagueRow, p: PlayerRow): Promise<ClubRow | null> {
  const row = await env.DB.prepare("SELECT * FROM clubs WHERE league_id = ? AND season = ? AND player_id = ?").bind(l.id, l.season, p.id).first<ClubRow>();
  if (row) return row;
  if (l.status !== "setup") return null;
  const c: ClubRow = { id: id(), league_id: l.id, season: l.season, player_id: p.id, is_cpu: 0, status: "creating", creation: JSON.stringify(newCreation()), club: null, state: null, created_at: nowIso() };
  await env.DB.prepare("INSERT INTO clubs (id, league_id, season, player_id, is_cpu, status, creation, club, state, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(c.id, c.league_id, c.season, c.player_id, c.is_cpu, c.status, c.creation, c.club, c.state, c.created_at).run();
  return c;
}

export async function spin(env: Env, l: LeagueRow, c: ClubRow, ownerName: string) {
  if (c.status !== "creating") throw new Error("Le ruote sono già state girate tutte.");
  const st: CreationState = JSON.parse(c.creation!);
  const out = doSpin(st, cryptoRng());
  if (!out) throw new Error("Nessuna ruota da girare.");
  const status = st.queue.length === 0 ? "identity" : "creating";
  await env.DB.prepare("UPDATE clubs SET creation = ?, status = ? WHERE id = ? AND status = 'creating'").bind(JSON.stringify(st), status, c.id).run();
  if (out.combo) {
    await addNews(env, l, null, "lucky", "Lucky Streak!", `${ownerName} ha sbloccato la ruota dorata.`);
    await tgSend(env, l.tg_chat, `🎉 <b>Lucky Streak!</b> ${esc(ownerName)} ha appena sbloccato la ruota dorata.`);
  }
  return { record: out.record, combo: out.combo, next: st.queue[0] ?? null, remaining: st.queue.length, status, streak: st.streak, luckyCount: st.luckyCount };
}

export async function addNews(env: Env, l: LeagueRow, matchday: number | null, kind: string, title: string, body: string) {
  await env.DB.prepare("INSERT INTO news (league_id, season, matchday, kind, title, body, created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(l.id, l.season, matchday, kind, title, body, nowIso()).run();
}

/** Avvia il campionato: aggiunge le CPU, genera il calendario. */
export async function startLeague(env: Env, l: LeagueRow, totalTeams: number, firstDay: "oggi" | "domani") {
  if (l.status !== "setup") throw new Error("Il campionato è già partito.");
  const rows = await loadClubs(env, l);
  const humans = rows.filter((r) => !r.is_cpu);
  const notReady = humans.filter((r) => r.status !== "ready");
  if (notReady.length) throw new Error(`Devono ancora finire la creazione: ${notReady.map((r) => r.owner).join(", ")}.`);
  if (humans.length < 1) throw new Error("Serve almeno un club creato.");
  let n = Math.max(totalTeams, humans.length, 4);
  if (n % 2) n++;
  if (n > 16) throw new Error("Massimo 16 squadre.");
  const stmts: D1PreparedStatement[] = [];
  const all: { id: string }[] = humans.map((h) => ({ id: h.id }));
  const rng = cryptoRng();
  for (let i = humans.length; i < n; i++) {
    const cs = newCreation();
    while (cs.queue.length) doSpin(cs, rng);
    const cid = id();
    const club = computeClub(cs.draft, cpuIdentity(cid, cs.draft.city ?? "Lucca"), cid);
    stmts.push(env.DB.prepare("INSERT INTO clubs (id, league_id, season, player_id, is_cpu, status, creation, club, state, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(cid, l.id, l.season, null, 1, "ready", JSON.stringify(cs), JSON.stringify(club), JSON.stringify(initialState(club)), nowIso()));
    all.push({ id: cid });
  }
  // ordine casuale nel calendario
  for (let i = all.length - 1; i > 0; i--) { const j = rng.int(0, i); [all[i], all[j]] = [all[j], all[i]]; }
  const sched = bergerSchedule(n);
  sched.forEach((round, r) => {
    for (const [a, b] of round) {
      stmts.push(env.DB.prepare("INSERT INTO matches (id, league_id, season, matchday, home_id, away_id, played) VALUES (?,?,?,?,?,?,0)")
        .bind(id(), l.id, l.season, r + 1, all[a].id, all[b].id));
    }
  });
  const now = romeNow();
  const start = firstDay === "oggi" && now.hour < 21 ? now.date : addDays(now.date, 1);
  stmts.push(env.DB.prepare("UPDATE leagues SET status = 'running', start_date = ?, total_matchdays = ?, matchday_played = 0, market_open = 0 WHERE id = ?")
    .bind(start, sched.length, l.id));
  await env.DB.batch(stmts);
  const msg = `⚽ <b>${esc(l.name)}: si parte!</b>\n${n} squadre, ${sched.length} giornate. Prima giornata il ${formatDate(start)} alle 21:00.`;
  await addNews(env, l, null, "info", "Si parte!", `${n} squadre, ${sched.length} giornate. Prima giornata il ${formatDate(start)} alle 21:00.`);
  await tgSend(env, l.tg_chat, msg);
}

export function formatDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  return `${day} ${mesi[m - 1]}`;
}

export function matchdayDate(l: LeagueRow, md: number) {
  return l.start_date ? addDays(l.start_date, md - 1) : null;
}

/** Gioca la prossima giornata. */
export async function playMatchday(env: Env, l: LeagueRow): Promise<{ matchday: number } | null> {
  if (l.status !== "running") return null;
  const md = l.matchday_played + 1;
  if (md > l.total_matchdays) return null;

  // Prenota la giornata (evita doppie esecuzioni)
  const claim = await env.DB.prepare("UPDATE leagues SET matchday_played = ? WHERE id = ? AND matchday_played = ?").bind(md, l.id, md - 1).run();
  if (!claim.meta.changes) return null;
  try {
    return await playClaimed(env, l, md);
  } catch (e) {
    await env.DB.prepare("UPDATE leagues SET matchday_played = ? WHERE id = ? AND matchday_played = ?").bind(md - 1, l.id, md).run();
    throw e;
  }
}

async function playClaimed(env: Env, l: LeagueRow, md: number): Promise<{ matchday: number }> {
  const rows = await loadClubs(env, l);
  const clubs = new Map(rows.map((r) => [r.id, bundle(r)]));
  const allMatches = await loadMatches(env, l);
  const today = allMatches.filter((m) => m.matchday === md);

  // Decisioni in sospeso: chi non decide tiene il fuoriclasse
  for (const b of clubs.values()) {
    if (b.state.pendingDecision === "fuoriclasse") { b.state.morale = Math.max(0, b.state.morale - 10); b.state.pendingDecision = null; }
  }

  const stmts: D1PreparedStatement[] = [];
  const summaries: DaySummary["matches"] = [];
  for (const m of today) {
    const H = clubs.get(m.home_id)!, A = clubs.get(m.away_id)!;
    const hc = choicesFor(H.club, H.state, H.isCpu, md), ac = choicesFor(A.club, A.state, A.isCpu, md);
    const res: MatchResult = simulateMatch({ club: H.club, state: H.state, choices: hc, home: true }, { club: A.club, state: A.state, choices: ac, home: false }, md, `${l.seed}:${m.id}`);
    const derby = !!H.club.region && H.club.region === A.club.region;
    afterMatch(H.club, H.state, hc, res.homeGoals, res.awayGoals, true, derby, md);
    afterMatch(A.club, A.state, ac, res.awayGoals, res.homeGoals, false, derby, md);
    const data = { ...res, choices: [hc, ac], derby };
    stmts.push(env.DB.prepare("UPDATE matches SET played = 1, home_goals = ?, away_goals = ?, data = ? WHERE id = ?").bind(res.homeGoals, res.awayGoals, JSON.stringify(data), m.id));
    m.played = 1; m.home_goals = res.homeGoals; m.away_goals = res.awayGoals;
    const nameOf = (side: "home" | "away") => (side === "home" ? H.club.name : A.club.name);
    const tact = (c: typeof hc, cl: typeof H.club) => `allenatore ${cl.coachName ?? cl.coachLabel}: ${c.modulo}, ${c.atteggiamento}${c.turnover !== "nessuno" ? `, turnover ${c.turnover}` : ""}`;
    summaries.push({
      home: H.club.name, away: A.club.name, hg: res.homeGoals, ag: res.awayGoals, derby,
      scorers: res.events.filter((e) => e.type === "gol").map((e) => ({ team: nameOf(e.team), player: e.player!, minute: e.minute })),
      reds: res.events.filter((e) => e.type === "rosso").map((e) => ({ team: nameOf(e.team), player: e.player!, minute: e.minute })),
      tactics: [tact(hc, H.club), tact(ac, A.club)],
    });
  }

  // Eventi del giorno
  const evRng = makeRng(`${l.seed}:events:${l.season}:${md}`);
  const list = [...clubs.values()];
  const dayEvents = md < l.total_matchdays ? [dailyEvent(evRng, list, md), dailyEvent(evRng, list, md)] : [];
  const events = dayEvents.map((e) => e.text);

  // Mercato del giro di boa
  const half = l.total_matchdays / 2;
  let marketOpen = l.market_open;
  if (md === half) {
    marketOpen = 1;
    for (const b of list) {
      b.state.marketOps = 0; b.state.marketDelta = {};
      if (b.isCpu) {
        const low = (["por", "dif", "cen", "att"] as Reparto[]).sort((x, y) => b.state.ratings[x] - b.state.ratings[y])[0];
        marketOp(b.state, "buy", low);
      }
    }
    events.push("Si apre il mercato del giro di boa: un giorno per rinforzarsi.");
  } else if (md === half + 1) {
    marketOpen = 0;
    stmts.push(env.DB.prepare("UPDATE offers SET status = 'scaduta' WHERE league_id = ? AND season = ? AND status = 'aperta'").bind(l.id, l.season));
  }

  for (const b of list) stmts.push(env.DB.prepare("UPDATE clubs SET club = ?, state = ? WHERE id = ?").bind(JSON.stringify(b.club), JSON.stringify(b.state), b.id));

  const played = allMatches.filter((m) => m.played).map((m) => ({ matchday: m.matchday, homeId: m.home_id, awayId: m.away_id, homeGoals: m.home_goals!, awayGoals: m.away_goals! }));
  const rowsS = standings(rows.map((r) => ({ id: r.id, name: clubs.get(r.id)!.club.name, colors: clubs.get(r.id)!.club.colors, owner: r.owner })), played, l.seed);
  const final = md === l.total_matchdays;

  let history = JSON.parse(l.history || "[]");
  if (final) {
    const scorers = new Map<string, { name: string; clubId: string; goals: number }>();
    for (const m of allMatches) {
      if (!m.played) continue;
      const data = m.id && m.data ? JSON.parse(m.data) : null;
      const evs = data?.events ?? [];
      for (const e of evs) if (e.type === "gol") {
        const cid = e.team === "home" ? m.home_id : m.away_id;
        const k = cid + e.player;
        const cur = scorers.get(k) ?? { name: e.player, clubId: cid, goals: 0 };
        cur.goals++; scorers.set(k, cur);
      }
    }
    // i dati delle partite di oggi non sono ancora salvati in m.data: li aggiungo
    for (const s of summaries) for (const sc of s.scorers) {
      const cid = [...clubs.values()].find((b) => b.club.name === sc.team)!.id;
      const k = cid + sc.player;
      const cur = scorers.get(k) ?? { name: sc.player, clubId: cid, goals: 0 };
      cur.goals++; scorers.set(k, cur);
    }
    const awards = seasonAwards(rowsS, list, scorers);
    history.push({
      season: l.season,
      table: rowsS.map((r, i) => ({ pos: i + 1, id: r.id, name: r.name, owner: r.owner, pt: r.pt, gf: r.gf, gs: r.gs, voto: clubs.get(r.id)!.club.voto })),
      awards,
      finishedAt: nowIso(),
    });
  }

  const dayData = {
    clubOrder: list.map((b) => b.id),
    events: dayEvents.map((e) => ({ eventIndex: e.eventIndex, clubId: e.clubId, text: e.text })),
    notes: events.slice(dayEvents.length),
    table: rowsS.map((r) => ({ id: r.id, pt: r.pt, g: r.g, gf: r.gf, gs: r.gs })),
  };
  stmts.push(env.DB.prepare("INSERT OR REPLACE INTO days (league_id, season, matchday, data, created_at) VALUES (?,?,?,?,?)").bind(l.id, l.season, md, JSON.stringify(dayData), nowIso()));
  stmts.push(env.DB.prepare("UPDATE leagues SET market_open = ?, status = ?, history = ? WHERE id = ?").bind(marketOpen, final ? "finished" : "running", JSON.stringify(history), l.id));
  await env.DB.batch(stmts);

  // Cronaca e Telegram: un errore qui non deve annullare la giornata già salvata
  try {
  const day: DaySummary = {
    league: l.name, season: l.season, matchday: md, total: l.total_matchdays, journal: journalFor(l.season),
    matches: summaries, events,
    table: rowsS.map((r, i) => ({ pos: i + 1, name: r.name, pt: r.pt, owner: r.owner })),
    final,
  };
  const chron = await aiChronicle(env, day);
  await addNews(env, l, md, "cronaca", chron.title, chron.body);
  for (const e of events) await addNews(env, l, md, "evento", "Notizia", e);

  // Telegram
  const tbl = rowsS.map((r, i) => `${String(i + 1).padStart(2)}. ${r.name.slice(0, 18).padEnd(18)} ${String(r.pt).padStart(3)}`).join("\n");
  const results = summaries.map((s) => `${esc(s.home)} <b>${s.hg}-${s.ag}</b> ${esc(s.away)}`).join("\n");
  let msg = `📰 <b>${esc(day.journal)}</b> · giornata ${md}/${l.total_matchdays}\n\n<b>${esc(chron.title)}</b>\n\n${esc(chron.body)}\n\n<b>Risultati</b>\n${results}\n\n<b>Classifica</b>\n<pre>${esc(tbl)}</pre>`;
  if (final) {
    const last = history[history.length - 1];
    msg += `\n\n🏆 <b>Premi della stagione</b>\n${last.awards.map((a: any) => `${esc(a.title)}: ${esc(a.text)}`).join("\n")}`;
  }
  await tgSend(env, l.tg_chat, msg);
  } catch (e) {
    console.error("cronaca/telegram", e);
  }
  return { matchday: md };
}

export async function cronTick(env: Env, when = new Date()) {
  const now = romeNow(when);
  const { results } = await env.DB.prepare("SELECT * FROM leagues WHERE status = 'running'").all<LeagueRow>();
  for (const l of results) {
    try {
      // Promemoria alle 18
      if (now.hour >= 18 && now.hour < 21 && l.reminder_date !== now.date) {
        const next = l.matchday_played + 1;
        if (matchdayDate(l, next) === now.date) {
          const rows = await loadClubs(env, l);
          const missing = rows.filter((r) => !r.is_cpu && JSON.parse(r.state!).confirmedFor !== next).map((r) => r.owner);
          await env.DB.prepare("UPDATE leagues SET reminder_date = ? WHERE id = ?").bind(now.date, l.id).run();
          if (missing.length) await tgSend(env, l.tg_chat, `⏰ Alle 21:00 si gioca la giornata ${next}. Mancano ancora le scelte di: <b>${esc(missing.join(", "))}</b>.`);
        }
      }
      // Giornata alle 21 (con recupero se un'esecuzione è saltata)
      let cur: LeagueRow | null = l;
      for (let guard = 0; guard < 3 && cur && cur.status === "running"; guard++) {
        const date = matchdayDate(cur, cur.matchday_played + 1);
        if (!date) break;
        const due = date < now.date || (date === now.date && now.hour >= 21);
        if (!due) break;
        const r = await playMatchday(env, cur);
        if (!r) break;
        cur = await getLeague(env, l.id);
      }
    } catch (e) {
      console.error("cron league", l.id, e);
    }
  }
}

export async function newSeason(env: Env, l: LeagueRow) {
  if (l.status !== "finished") throw new Error("La stagione non è ancora finita.");
  await env.DB.prepare("UPDATE leagues SET season = season + 1, status = 'setup', start_date = NULL, matchday_played = 0, total_matchdays = 0, market_open = 0 WHERE id = ?").bind(l.id).run();
  await tgSend(env, l.tg_chat, `🔄 <b>Nuova stagione!</b> Aprite il vostro link e girate le ruote per creare il nuovo club.`);
}

export function publicClub(b: ClubBundle & { owner: string }) {
  const c: Club = b.club;
  return {
    id: b.id, owner: b.owner, isCpu: b.isCpu, name: c.name, colors: c.colors, crest: c.crest, city: c.city, blasone: c.blasone,
    ratings: b.state.ratings, voto: c.voto, classe: c.classe, coachLabel: c.coachLabel, coachName: c.coachName ?? null, preferredModule: c.preferredModule,
    stadium: c.stadium.label, fans: c.fans.label, fuoriclasse: c.fuoriclasse, sponsor: c.sponsor, form: b.state.lastResults,
    initialRatings: c.ratings,
  };
}

export { REPARTI };
