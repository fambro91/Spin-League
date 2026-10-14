import { ensureSchema, nowIso, romeNow, sha256, type Env, type LeagueRow, type PlayerRow, type ClubRow, type MatchRow } from "./db";
import {
  addNews, bundle, cronTick, ensurePlayerClub, formatDate, getLeague, id, loadClubs, loadMatches, matchdayDate, newSeason,
  playMatchday, publicClub, spin, startLeague, statMatches,
} from "./game";
import { leagueStats } from "../shared/stats";
import { randomToken } from "../shared/rng";
import { computeClub, initialState, clamp } from "../shared/club";
import { marketDiscount, marketOp, penaltyOf, sellFuoriclasse, standings } from "../shared/league";
import { applyDilemma, buyInvestment, dealDilemmas, TRAININGS } from "../shared/manager";
import { cryptoRng } from "../shared/rng";
import { ATTEGGIAMENTI, MODULI, REPARTI, type ClubState, type CreationState, type Identity, type Reparto, type Training } from "../shared/types";
import { esc, tgCall, tgSecret, tgSend } from "./telegram";
import { careerEndSeason, careerKickoff, careerPlay, careerSetup, careerView, careerWheel, liveStep } from "./career";

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function body<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}
const cleanName = (s: unknown, max = 40) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function adminLeague(env: Env, token: string) {
  const l = await env.DB.prepare("SELECT * FROM leagues WHERE admin_hash = ?").bind(await sha256(token)).first<LeagueRow>();
  if (!l) throw new HttpError(404, "Link amministratore non valido.");
  return l;
}
async function playerCtx(env: Env, token: string) {
  const p = await env.DB.prepare("SELECT * FROM players WHERE token_hash = ?").bind(await sha256(token)).first<PlayerRow>();
  if (!p) throw new HttpError(404, "Link personale non valido. Chiedi all'organizzatore un nuovo link.");
  const l = (await getLeague(env, p.league_id))!;
  return { p, l };
}

async function createPlayer(env: Env, l: LeagueRow, name: string) {
  const token = randomToken(16);
  const pid = id();
  await env.DB.prepare("INSERT INTO players (id, league_id, name, token_hash, created_at) VALUES (?,?,?,?,?)").bind(pid, l.id, name, await sha256(token), nowIso()).run();
  return { id: pid, token };
}

async function leagueView(env: Env, l: LeagueRow, myClubId: string | null) {
  const rows = await loadClubs(env, l);
  const ready = rows.filter((r) => r.status === "ready");
  const bundles = ready.map(bundle);
  const matches = await loadMatches(env, l);
  const played = matches.filter((m) => m.played).map((m) => ({ matchday: m.matchday, homeId: m.home_id, awayId: m.away_id, homeGoals: m.home_goals!, awayGoals: m.away_goals! }));
  const table = l.status === "setup" ? [] : standings(bundles.map((b) => ({ id: b.id, name: b.club.name, colors: b.club.colors, owner: b.owner, pen: penaltyOf(b.club) })), played, l.seed);
  const { results: news } = await env.DB.prepare("SELECT id, matchday, kind, title, body, created_at FROM news WHERE league_id = ? AND season = ? ORDER BY id DESC LIMIT 40").bind(l.id, l.season).all();
  const next = l.matchday_played + 1;
  return {
    league: {
      id: l.id, name: l.name, season: l.season, status: l.status, startDate: l.start_date, matchdayPlayed: l.matchday_played,
      totalMatchdays: l.total_matchdays, marketOpen: !!l.market_open, nextMatchday: l.status === "running" ? next : null,
      nextMatchDate: l.status === "running" ? matchdayDate(l, next) : null, telegram: !!l.tg_chat,
      history: JSON.parse(l.history || "[]"),
    },
    participants: rows.map((r) => ({ id: r.id, owner: r.owner, playerId: r.player_id, status: r.status, isCpu: !!r.is_cpu, confirmed: r.state ? JSON.parse(r.state).confirmedFor === next : false })),
    clubs: bundles.map(publicClub),
    table,
    matches: matches.map((m) => ({ id: m.id, matchday: m.matchday, homeId: m.home_id, awayId: m.away_id, played: !!m.played, hg: m.home_goals, ag: m.away_goals })),
    news,
    myClubId,
    stats: l.status === "setup" ? null : leagueStats(statMatches(matches)),
  };
}

export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  await ensureSchema(env.DB);
  const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const m = req.method;

  // POST /api/leagues
  if (parts[0] === "leagues" && parts.length === 1 && m === "POST") {
    const b = await body<{ name?: string; adminName?: string; secret?: string }>(req);
    if (env.CREATE_SECRET && b.secret !== env.CREATE_SECRET) throw new HttpError(403, "Codice di creazione errato.");
    const name = cleanName(b.name) || "Spin League";
    const adminName = cleanName(b.adminName, 24);
    if (!adminName) throw new HttpError(400, "Scrivi il tuo nome.");
    const adminToken = randomToken(16);
    const l: LeagueRow = { id: id(), name, admin_hash: await sha256(adminToken), seed: randomToken(16), season: 1, status: "setup", start_date: null, matchday_played: 0, total_matchdays: 0, market_open: 0, tg_chat: null, tg_code: null, history: "[]", reminder_date: null, created_at: nowIso() };
    await env.DB.prepare("INSERT INTO leagues (id, name, admin_hash, seed, season, status, matchday_played, total_matchdays, market_open, history, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(l.id, l.name, l.admin_hash, l.seed, 1, "setup", 0, 0, 0, "[]", l.created_at).run();
    const p = await createPlayer(env, l, adminName);
    return json({ adminToken, playerToken: p.token });
  }

  // Telegram webhook
  if (parts[0] === "telegram" && m === "POST") {
    const secret = await tgSecret(env);
    if (!secret || parts[1] !== secret) throw new HttpError(404, "Not found");
    const upd = await body<any>(req);
    const msg = upd.message ?? upd.channel_post;
    const text: string = msg?.text ?? "";
    if (/^\/(start|help|aiuto)\b/i.test(text) && msg?.chat?.id) {
      await tgSend(env, String(msg.chat.id), "Ciao! Sono il bot di Spin League ⚽\nPer collegare questa chat a un campionato scrivi <b>/collega CODICE</b>. Il codice lo trovi nella pagina dell'organizzatore, sotto «Gruppo Telegram».");
      return json({ ok: true });
    }
    const match = text.match(/^\/collega(?:@\w+)?\s+([A-Z0-9]{6})/i);
    if (match && msg?.chat?.id) {
      const l = await env.DB.prepare("SELECT * FROM leagues WHERE tg_code = ?").bind(match[1].toUpperCase()).first<LeagueRow>();
      if (l) {
        await env.DB.prepare("UPDATE leagues SET tg_chat = ?, tg_code = NULL WHERE id = ?").bind(String(msg.chat.id), l.id).run();
        await tgSend(env, String(msg.chat.id), `✅ Gruppo collegato a <b>${esc(l.name)}</b>. Qui arriveranno cronache, risultati e promemoria.`);
      } else {
        await tgSend(env, String(msg.chat.id), "Codice non valido o già usato. Generane uno nuovo dalla pagina dell'organizzatore.");
      }
    }
    return json({ ok: true });
  }

  // ---------- ADMIN ----------
  if (parts[0] === "admin" && parts[1]) {
    const l = await adminLeague(env, parts[1]);
    const action = parts[2];
    if (!action && m === "GET") {
      const { results: players } = await env.DB.prepare("SELECT id, name, created_at FROM players WHERE league_id = ? ORDER BY created_at").bind(l.id).all<{ id: string; name: string }>();
      const view = await leagueView(env, l, null);
      const tgReady = !!env.TELEGRAM_BOT_TOKEN;
      let botName: string | null = null;
      if (tgReady) { const me = await tgCall(env, "getMe", {}); botName = me?.result?.username ?? null; }
      return json({ ...view, players, telegramToken: tgReady, botName, tgCode: l.tg_code, now: romeNow() });
    }
    if (action === "players" && m === "POST" && !parts[3]) {
      if (l.status !== "setup") throw new HttpError(400, "Si possono aggiungere giocatori solo prima dell'inizio della stagione.");
      const b = await body<{ name?: string }>(req);
      const name = cleanName(b.name, 24);
      if (!name) throw new HttpError(400, "Scrivi il nome del giocatore.");
      const p = await createPlayer(env, l, name);
      return json(p);
    }
    if (action === "players" && parts[3] && parts[4] === "link" && m === "POST") {
      const token = randomToken(16);
      const r = await env.DB.prepare("UPDATE players SET token_hash = ? WHERE id = ? AND league_id = ?").bind(await sha256(token), parts[3], l.id).run();
      if (!r.meta.changes) throw new HttpError(404, "Giocatore non trovato.");
      return json({ token });
    }
    if (action === "players" && parts[3] && m === "DELETE") {
      if (l.status !== "setup") throw new HttpError(400, "Non si può rimuovere un giocatore a campionato in corso.");
      await env.DB.batch([
        env.DB.prepare("DELETE FROM clubs WHERE player_id = ? AND league_id = ? AND season = ?").bind(parts[3], l.id, l.season),
        env.DB.prepare("DELETE FROM players WHERE id = ? AND league_id = ?").bind(parts[3], l.id),
      ]);
      return json({ ok: true });
    }
    if (action === "start" && m === "POST") {
      const b = await body<{ teams?: number; firstDay?: "oggi" | "domani" }>(req);
      try { await startLeague(env, l, Number(b.teams) || 0, b.firstDay === "oggi" ? "oggi" : "domani"); }
      catch (e: any) { throw new HttpError(400, e.message); }
      return json({ ok: true });
    }
    // carriera (modalità da solo)
    if (action?.startsWith("career-") && m === "POST") {
      const b = await body<{ teams?: number }>(req);
      try {
        if (action === "career-setup") { await careerSetup(env, l, Number(b.teams) || 8); return json({ ok: true }); }
        if (action === "career-wheel") return json(await careerWheel(env, l));
        if (action === "career-kickoff") { await careerKickoff(env, l); return json({ ok: true }); }
        if (action === "career-play") return json(await careerPlay(env, l));
        if (action === "career-end") return json(await careerEndSeason(env, l));
      } catch (e: any) { if (e instanceof HttpError) throw e; throw new HttpError(400, e.message); }
    }
    if (action === "play-now" && m === "POST") {
      const r = await playMatchday(env, l);
      if (!r) throw new HttpError(400, "Nessuna giornata da giocare.");
      return json(r);
    }
    if (action === "new-season" && m === "POST") {
      try { await newSeason(env, l); } catch (e: any) { throw new HttpError(400, e.message); }
      return json({ ok: true });
    }
    if (action === "rename" && m === "POST") {
      const b = await body<{ name?: string }>(req);
      const name = cleanName(b.name);
      if (name) await env.DB.prepare("UPDATE leagues SET name = ? WHERE id = ?").bind(name, l.id).run();
      return json({ ok: true });
    }
    if (action === "telegram" && m === "POST") {
      const secret = await tgSecret(env);
      if (!secret) throw new HttpError(400, "Manca il secret TELEGRAM_BOT_TOKEN su Cloudflare.");
      const hook = await tgCall(env, "setWebhook", { url: `${url.origin}/api/telegram/${secret}`, allowed_updates: ["message", "channel_post"] });
      if (!hook.ok) throw new HttpError(400, `Telegram ha rifiutato il webhook: ${hook.description}`);
      const code = randomToken(6).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6).padEnd(6, "X");
      await env.DB.prepare("UPDATE leagues SET tg_code = ? WHERE id = ?").bind(code, l.id).run();
      return json({ code });
    }
    if (action === "telegram-test" && m === "POST") {
      if (!l.tg_chat) throw new HttpError(400, "Nessun gruppo collegato.");
      await tgSend(env, l.tg_chat, `👋 Prova di <b>${esc(l.name)}</b>: il bot funziona.`);
      return json({ ok: true });
    }
    throw new HttpError(404, "Azione sconosciuta.");
  }

  // ---------- GIOCATORE ----------
  if (parts[0] === "me" && parts[1]) {
    const { p, l } = await playerCtx(env, parts[1]);
    const action = parts[2];
    let c = await ensurePlayerClub(env, l, p);

    if (!action && m === "GET") {
      const view = await leagueView(env, l, c?.id ?? null);
      let mine: any = null;
      if (c) {
        const creation: CreationState | null = c.creation ? JSON.parse(c.creation) : null;
        mine = {
          id: c.id, status: c.status,
          creation: creation && c.status !== "ready" ? { done: creation.done, next: creation.queue[0] ?? null, remaining: creation.queue.length, streak: creation.streak, luckyCount: creation.luckyCount, draft: creation.draft } : null,
          spins: creation?.done ?? [],
          club: c.club ? JSON.parse(c.club) : null,
          state: c.state ? JSON.parse(c.state) : null,
        };
      }
      const { results: offers } = c ? await env.DB.prepare("SELECT * FROM offers WHERE league_id = ? AND season = ? AND (from_club = ? OR to_club = ?) ORDER BY created_at DESC").bind(l.id, l.season, c.id, c.id).all() : { results: [] };
      // Agenda del giorno
      let agenda: any = null;
      if (c && c.status === "ready" && l.status === "running") {
        const md = l.matchday_played + 1;
        const cl = JSON.parse(c.club!), st: ClubState = JSON.parse(c.state!);
        if (st.dilemmas?.md !== md) {
          st.dilemmas = { md, cards: dealDilemmas(`${l.seed}:${c.id}`, cl, st, md) };
          await env.DB.prepare("UPDATE clubs SET state = ? WHERE id = ?").bind(JSON.stringify(st), c.id).run();
          if (mine) mine.state = st;
        }
        const myMatch = (view.matches as any[]).find((x) => x.matchday === md && (x.homeId === c!.id || x.awayId === c!.id));
        const oppId = myMatch ? (myMatch.homeId === c.id ? myMatch.awayId : myMatch.homeId) : null;
        const oppHuman = oppId ? !(view.participants as any[]).find((x) => x.id === oppId)?.isCpu : false;
        const { results: chs } = await env.DB.prepare("SELECT * FROM challenges WHERE league_id = ? AND season = ? AND matchday = ? AND (from_club = ? OR to_club = ?)").bind(l.id, l.season, md, c.id, c.id).all();
        agenda = { md, oppId, oppHuman, challenge: chs[0] ?? null };
      }
      let myScorers: { name: string; goals: number; assists: number }[] = [];
      if (c && c.status === "ready" && l.matchday_played > 0) {
        const { results: mm } = await env.DB.prepare("SELECT home_id, away_id, data FROM matches WHERE league_id = ? AND season = ? AND played = 1 AND (home_id = ? OR away_id = ?)").bind(l.id, l.season, c.id, c.id).all<{ home_id: string; away_id: string; data: string }>();
        const tally = new Map<string, { name: string; goals: number; assists: number }>();
        const get = (n: string) => { let t = tally.get(n); if (!t) { t = { name: n, goals: 0, assists: 0 }; tally.set(n, t); } return t; };
        for (const x of mm) {
          const side = x.home_id === c.id ? "home" : "away";
          for (const e of JSON.parse(x.data).events ?? []) if (e.type === "gol" && e.team === side) { get(e.player).goals++; if (e.assist) get(e.assist).assists++; }
        }
        myScorers = [...tally.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists);
      }
      const career = await careerView(env, l);
      return json({ ...view, player: { id: p.id, name: p.name }, mine, offers, myScorers, agenda, career, now: romeNow() });
    }
    if (!c) throw new HttpError(400, "La stagione è già iniziata senza il tuo club: aspetta la prossima.");

    if (action === "spin" && m === "POST") {
      try { return json(await spin(env, l, c, p.name)); } catch (e: any) { throw new HttpError(400, e.message); }
    }
    if (action === "identity" && m === "POST") {
      if (c.status !== "identity") throw new HttpError(400, "Prima gira tutte le ruote.");
      const b = await body<Partial<Identity>>(req);
      const name = cleanName(b.name, 28);
      if (name.length < 2) throw new HttpError(400, "Dai un nome al club.");
      const hex = /^#[0-9a-fA-F]{6}$/;
      const colors: [string, string] = [hex.test(b.colors?.[0] ?? "") ? b.colors![0] : "#1d4ed8", hex.test(b.colors?.[1] ?? "") ? b.colors![1] : "#ffffff"];
      const crest = (["scudo", "cerchio", "rombo", "stella"] as const).includes(b.crest as any) ? b.crest! : "scudo";
      const st: CreationState = JSON.parse(c.creation!);
      const club = computeClub(st.draft, { name, colors, crest, fuoriclasseName: cleanName(b.fuoriclasseName, 28) }, c.id);
      await env.DB.prepare("UPDATE clubs SET club = ?, state = ?, status = 'ready' WHERE id = ? AND status = 'identity'").bind(JSON.stringify(club), JSON.stringify(initialState(club)), c.id).run();
      await addNews(env, l, null, "club", "Nuovo club", `${p.name} ha fondato ${club.name} (${club.city}): voto ${club.voto}, classe ${club.classe}.`);
      await tgSend(env, l.tg_chat, `🆕 <b>${esc(club.name)}</b> di ${esc(p.name)} è pronto: ${esc(club.city)}, ${esc(club.blasone)}, voto <b>${club.voto}</b> (classe ${club.classe}).`);
      return json({ ok: true });
    }

    if (c.status !== "ready") throw new HttpError(400, "Prima completa il tuo club.");
    const club = JSON.parse(c.club!);
    const state: ClubState = JSON.parse(c.state!);
    const save = () => { state.budget = Math.round(state.budget * 10) / 10; return env.DB.prepare("UPDATE clubs SET club = ?, state = ? WHERE id = ?").bind(JSON.stringify(club), JSON.stringify(state), c!.id).run(); };

    if (action === "live") {
      const b = m === "POST" ? await body<{ decision?: any }>(req) : {};
      try { return json(await liveStep(env, l, c, (b as any).decision)); }
      catch (e: any) { throw new HttpError(400, e.message); }
    }
    if (action === "choices" && m === "POST") {
      if (l.status !== "running") throw new HttpError(400, "Il campionato non è in corso.");
      const b = await body<any>(req);
      if (!MODULI.includes(b.modulo)) throw new HttpError(400, "Modulo non valido.");
      if (!ATTEGGIAMENTI.some((a) => a.id === b.atteggiamento)) throw new HttpError(400, "Atteggiamento non valido.");
      if (!["nessuno", "parziale", "massiccio"].includes(b.turnover)) throw new HttpError(400, "Turnover non valido.");
      if (!["nessuno", "motivare", "calmare"].includes(b.discorso)) throw new HttpError(400, "Discorso non valido.");
      state.choices = { modulo: b.modulo, atteggiamento: b.atteggiamento, turnover: b.turnover, discorso: b.discorso };
      state.confirmedFor = l.matchday_played + 1;
      await save();
      return json({ ok: true });
    }
    if (action === "market" && m === "POST") {
      if (!l.market_open) throw new HttpError(400, "Il mercato è chiuso.");
      const b = await body<{ op?: "buy" | "sell"; rep?: Reparto }>(req);
      if (!b.rep || !REPARTI.includes(b.rep) || (b.op !== "buy" && b.op !== "sell")) throw new HttpError(400, "Operazione non valida.");
      const err = marketOp(state, b.op, b.rep, marketDiscount(JSON.parse(c.club!)));
      if (err) throw new HttpError(400, err);
      await save();
      return json({ ok: true });
    }
    const nextMd = l.matchday_played + 1;
    const running = () => { if (l.status !== "running") throw new HttpError(400, "Il campionato non è in corso."); };

    if (action === "dilemma" && m === "POST") {
      running();
      const b = await body<{ id?: string; option?: number }>(req);
      const pick = state.dilemmas?.md === nextMd ? state.dilemmas.cards.find((x) => x.id === b.id) : null;
      if (!pick) throw new HttpError(400, "Decisione non disponibile.");
      if (pick.choice !== null) throw new HttpError(400, "Hai già deciso.");
      let result: string;
      try { result = applyDilemma(club, state, pick, Number(b.option), nextMd, cryptoRng()); } catch (e: any) { throw new HttpError(400, e.message); }
      await save();
      return json({ ok: true, result });
    }
    if (action === "training" && m === "POST") {
      const b = await body<{ focus?: Training; rep?: Reparto }>(req);
      if (!TRAININGS.some((t) => t.id === b.focus)) throw new HttpError(400, "Allenamento non valido.");
      if (b.focus !== state.training) state.tecnicaCount = 0;
      state.training = b.focus;
      if (b.rep && (["por", "dif", "cen", "att", "pan", "all"] as Reparto[]).includes(b.rep)) state.tecnicaRep = b.rep;
      await save();
      return json({ ok: true });
    }
    if (action === "invest" && m === "POST") {
      const b = await body<{ id?: string }>(req);
      let msg: string;
      try { msg = buyInvestment(club, state, String(b.id)); } catch (e: any) { throw new HttpError(400, e.message); }
      await save();
      await addNews(env, l, null, "club", "Investimento", `${club.name}: ${msg}`);
      return json({ ok: true, msg });
    }
    if (action === "press" && m === "POST") {
      running();
      const b = await body<{ tone?: string; text?: string }>(req);
      if (!["umile", "provocatoria", "silenzio"].includes(String(b.tone))) throw new HttpError(400, "Tono non valido.");
      if (state.press?.md === nextMd) throw new HttpError(400, "Hai già parlato in conferenza stampa per questa giornata.");
      const text = cleanName(b.text, 120);
      if (b.tone === "provocatoria" && text.length < 3) throw new HttpError(400, "Scrivi la tua frase.");
      state.press = { md: nextMd, tone: b.tone as any, text };
      await save();
      if (b.tone !== "silenzio") {
        const verb = b.tone === "provocatoria" ? "🎤🔥" : "🎤";
        await tgSend(env, l.tg_chat, `${verb} <b>Conferenza stampa</b> · ${esc(p.name)} (${esc(club.name)}):\n«${esc(text || "Rispetto per tutti, pensiamo a lavorare.")}»`);
        await addNews(env, l, null, "stampa", `Conferenza stampa: ${club.name}`, `${p.name}: «${text || "Rispetto per tutti, pensiamo a lavorare."}»`);
      }
      return json({ ok: true });
    }
    if (action === "predictions" && m === "POST") {
      running();
      const b = await body<{ picks?: Record<string, string>; exact?: { matchId: string; h: number; a: number } }>(req);
      const { results: ms } = await env.DB.prepare("SELECT id, home_id, away_id FROM matches WHERE league_id = ? AND season = ? AND matchday = ?").bind(l.id, l.season, nextMd).all<{ id: string; home_id: string; away_id: string }>();
      const valid = new Set(ms.filter((x) => x.home_id !== c!.id && x.away_id !== c!.id).map((x) => x.id));
      const picks: Record<string, "1" | "X" | "2"> = {};
      for (const [k, v] of Object.entries(b.picks ?? {})) if (valid.has(k) && ["1", "X", "2"].includes(v)) picks[k] = v as any;
      let exact = undefined as any;
      if (b.exact && valid.has(b.exact.matchId)) {
        const h = Math.max(0, Math.min(9, Math.round(Number(b.exact.h)))), a = Math.max(0, Math.min(9, Math.round(Number(b.exact.a))));
        exact = { matchId: b.exact.matchId, h, a };
      }
      state.predictions = { md: nextMd, picks, exact };
      await save();
      return json({ ok: true });
    }
    if (action === "challenge" && m === "POST" && !parts[3]) {
      running();
      const b = await body<{ stake?: number }>(req);
      const stake = Math.round(Number(b.stake));
      if (!(stake >= 5 && stake <= 50)) throw new HttpError(400, "La posta va da 5 a 50 M€.");
      if (state.budget < stake) throw new HttpError(400, `Hai solo ${state.budget} M€.`);
      const mt = await env.DB.prepare("SELECT * FROM matches WHERE league_id = ? AND season = ? AND matchday = ? AND (home_id = ? OR away_id = ?)").bind(l.id, l.season, nextMd, c.id, c.id).first<MatchRow>();
      if (!mt) throw new HttpError(400, "Nessuna partita in programma.");
      const oppId = mt.home_id === c.id ? mt.away_id : mt.home_id;
      const opp = await env.DB.prepare("SELECT c.*, p.name AS owner FROM clubs c LEFT JOIN players p ON p.id = c.player_id WHERE c.id = ?").bind(oppId).first<any>();
      if (!opp || opp.is_cpu) throw new HttpError(400, "Si può sfidare solo un amico.");
      const ex = await env.DB.prepare("SELECT id FROM challenges WHERE league_id = ? AND season = ? AND matchday = ? AND (from_club IN (?, ?) AND to_club IN (?, ?)) AND status IN ('proposta','accettata')").bind(l.id, l.season, nextMd, c.id, oppId, c.id, oppId).first();
      if (ex) throw new HttpError(400, "C'è già una sfida per questa partita.");
      await env.DB.prepare("INSERT INTO challenges (id, league_id, season, matchday, from_club, to_club, stake, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id(), l.id, l.season, nextMd, c.id, oppId, stake, "proposta", nowIso()).run();
      const oppName = JSON.parse(opp.club).name;
      await tgSend(env, l.tg_chat, `⚔️ <b>Sfida!</b> ${esc(p.name)} (${esc(club.name)}) sfida ${esc(opp.owner)} (${esc(oppName)}) con una posta di <b>${stake} M€</b>. Accetterà?`);
      return json({ ok: true });
    }
    if (action === "challenge" && parts[3] && m === "POST") {
      running();
      const b = await body<{ accept?: boolean }>(req);
      const ch = await env.DB.prepare("SELECT * FROM challenges WHERE id = ? AND league_id = ? AND status = 'proposta'").bind(parts[3], l.id).first<any>();
      if (!ch) throw new HttpError(404, "Sfida non trovata.");
      if (ch.from_club === c.id && !b.accept) { await env.DB.prepare("UPDATE challenges SET status = 'ritirata' WHERE id = ?").bind(ch.id).run(); return json({ ok: true }); }
      if (ch.to_club !== c.id) throw new HttpError(403, "Non è una sfida per te.");
      if (!b.accept) {
        await env.DB.prepare("UPDATE challenges SET status = 'rifiutata' WHERE id = ?").bind(ch.id).run();
        await tgSend(env, l.tg_chat, `🐔 ${esc(p.name)} rifiuta la sfida da ${ch.stake} M€.`);
        return json({ ok: true });
      }
      const from = await env.DB.prepare("SELECT * FROM clubs WHERE id = ?").bind(ch.from_club).first<ClubRow>();
      const fs: ClubState = JSON.parse(from!.state!);
      if (state.budget < ch.stake) throw new HttpError(400, `Ti servono ${ch.stake} M€.`);
      if (fs.budget < ch.stake) throw new HttpError(400, "Lo sfidante non ha più abbastanza budget.");
      state.budget = Math.round((state.budget - ch.stake) * 10) / 10; fs.budget = Math.round((fs.budget - ch.stake) * 10) / 10;
      await env.DB.batch([
        env.DB.prepare("UPDATE clubs SET state = ? WHERE id = ?").bind(JSON.stringify(state), c.id),
        env.DB.prepare("UPDATE clubs SET state = ? WHERE id = ?").bind(JSON.stringify(fs), from!.id),
        env.DB.prepare("UPDATE challenges SET status = 'accettata' WHERE id = ?").bind(ch.id),
      ]);
      await tgSend(env, l.tg_chat, `🤝 ${esc(p.name)} accetta la sfida: <b>${ch.stake} M€</b> a testa sul piatto. Si decide alle 21:00!`);
      return json({ ok: true });
    }
    if (action === "decision" && m === "POST") {
      if (state.pendingDecision !== "fuoriclasse") throw new HttpError(400, "Nessuna decisione in sospeso.");
      const b = await body<{ sell?: boolean }>(req);
      const fname = club.fuoriclasse?.name;
      if (b.sell) { sellFuoriclasse(club, state); await addNews(env, l, null, "mercato", "Cessione", `${club.name} vende ${fname} per 60 M€.`); }
      else { state.morale = clamp(state.morale - 10, 0, 100); state.pendingDecision = null; await addNews(env, l, null, "mercato", "Resta", `${club.name} trattiene ${fname}. Spogliatoio nervoso.`); }
      await save();
      return json({ ok: true });
    }
    if (action === "offers" && m === "POST" && !parts[3]) {
      if (!l.market_open) throw new HttpError(400, "Il mercato è chiuso.");
      const b = await body<{ to?: string; money?: number }>(req);
      const target = await env.DB.prepare("SELECT * FROM clubs WHERE id = ? AND league_id = ? AND season = ?").bind(b.to ?? "", l.id, l.season).first<ClubRow>();
      if (!target || target.id === c.id) throw new HttpError(400, "Club non valido.");
      if (!JSON.parse(target.club!).fuoriclasse) throw new HttpError(400, "Quel club non ha un fuoriclasse.");
      const money = Math.round(Number(b.money));
      if (!(money > 0) || money > state.budget) throw new HttpError(400, `Offerta non valida: hai ${state.budget} M€.`);
      await env.DB.prepare("INSERT INTO offers (id, league_id, season, from_club, to_club, money, status, created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id(), l.id, l.season, c.id, target.id, money, "aperta", nowIso()).run();
      if (target.is_cpu) {
        // la CPU accetta se l'offerta supera 60 + 15 per livello
        const tclub = JSON.parse(target.club!);
        if (money >= 60 + 15 * tclub.fuoriclasse.level) return json(await acceptOffer(env, l, c.id, target.id, money));
        await env.DB.prepare("UPDATE offers SET status = 'rifiutata' WHERE from_club = ? AND to_club = ? AND status = 'aperta'").bind(c.id, target.id).run();
        return json({ ok: true, cpu: "rifiutata" });
      }
      return json({ ok: true });
    }
    if (action === "offers" && parts[3] && m === "POST") {
      const b = await body<{ accept?: boolean }>(req);
      const o = await env.DB.prepare("SELECT * FROM offers WHERE id = ? AND league_id = ? AND status = 'aperta'").bind(parts[3], l.id).first<any>();
      if (!o) throw new HttpError(404, "Offerta non trovata.");
      if (o.from_club === c.id && !b.accept) { await env.DB.prepare("UPDATE offers SET status = 'ritirata' WHERE id = ?").bind(o.id).run(); return json({ ok: true }); }
      if (o.to_club !== c.id) throw new HttpError(403, "Non è un'offerta per te.");
      if (!l.market_open) throw new HttpError(400, "Il mercato è chiuso.");
      if (!b.accept) { await env.DB.prepare("UPDATE offers SET status = 'rifiutata' WHERE id = ?").bind(o.id).run(); return json({ ok: true }); }
      return json(await acceptOffer(env, l, o.from_club, o.to_club, o.money, o.id));
    }
    if (action === "day" && parts[3] && m === "GET") {
      const md = Number(parts[3]);
      if (!(md >= 1 && md <= l.matchday_played)) throw new HttpError(404, "Giornata non ancora giocata.");
      const { results: ms } = await env.DB.prepare("SELECT * FROM matches WHERE league_id = ? AND season = ? AND matchday = ? AND played = 1").bind(l.id, l.season, md).all<MatchRow>();
      const day = await env.DB.prepare("SELECT data FROM days WHERE league_id = ? AND season = ? AND matchday = ?").bind(l.id, l.season, md).first<{ data: string }>();
      const prev = md > 1 ? await env.DB.prepare("SELECT data FROM days WHERE league_id = ? AND season = ? AND matchday = ?").bind(l.id, l.season, md - 1).first<{ data: string }>() : null;
      const chron = await env.DB.prepare("SELECT title, body FROM news WHERE league_id = ? AND season = ? AND matchday = ? AND kind = 'cronaca' ORDER BY id DESC LIMIT 1").bind(l.id, l.season, md).first<{ title: string; body: string }>();
      return json({
        matchday: md,
        date: matchdayDate(l, md),
        matches: ms.map((x) => ({ id: x.id, homeId: x.home_id, awayId: x.away_id, hg: x.home_goals, ag: x.away_goals, data: JSON.parse(x.data!) })),
        day: day ? JSON.parse(day.data) : null,
        prevTable: prev ? JSON.parse(prev.data).table : null,
        chronicle: chron,
      });
    }
    if (action === "match" && parts[3] && m === "GET") {
      const mt = await env.DB.prepare("SELECT * FROM matches WHERE id = ? AND league_id = ?").bind(parts[3], l.id).first<MatchRow>();
      if (!mt || !mt.played) throw new HttpError(404, "Partita non ancora giocata.");
      return json({ id: mt.id, matchday: mt.matchday, homeId: mt.home_id, awayId: mt.away_id, hg: mt.home_goals, ag: mt.away_goals, data: JSON.parse(mt.data!) });
    }
    throw new HttpError(404, "Azione sconosciuta.");
  }

  throw new HttpError(404, "Endpoint sconosciuto.");
}

async function acceptOffer(env: Env, l: LeagueRow, buyerId: string, sellerId: string, money: number, offerId?: string) {
  const [b, s] = await Promise.all([
    env.DB.prepare("SELECT * FROM clubs WHERE id = ?").bind(buyerId).first<ClubRow>(),
    env.DB.prepare("SELECT * FROM clubs WHERE id = ?").bind(sellerId).first<ClubRow>(),
  ]);
  const bc = JSON.parse(b!.club!), bs: ClubState = JSON.parse(b!.state!);
  const sc = JSON.parse(s!.club!), ss: ClubState = JSON.parse(s!.state!);
  const f = sc.fuoriclasse;
  if (!f) throw new HttpError(400, "Il fuoriclasse non c'è più.");
  if (bs.budget < money) throw new HttpError(400, "Il compratore non ha più abbastanza budget.");
  bs.budget -= money; ss.budget += money;
  ss.ratings[f.ruolo as Reparto] = clamp(ss.ratings[f.ruolo as Reparto] - f.bonus, 40, 99);
  sc.fuoriclasse = null;
  // il compratore perde l'eventuale fuoriclasse precedente nello stesso ruolo? No: si somma al reparto.
  bs.ratings[f.ruolo as Reparto] = clamp(bs.ratings[f.ruolo as Reparto] + f.bonus, 40, 99);
  if (!bc.fuoriclasse) bc.fuoriclasse = f;
  const map: Record<string, string> = { por: "POR", dif: "DIF", cen: "CEN", att: "ATT" };
  const idx = bc.roster.findIndex((p: any) => p.ruolo === map[f.ruolo] && p.name !== bc.fuoriclasse?.name);
  if (idx >= 0) bc.roster[idx] = { name: f.name, ruolo: map[f.ruolo] };
  const sidx = sc.roster.findIndex((p: any) => p.name === f.name);
  if (sidx >= 0) sc.roster[sidx] = { name: "Giovane della Primavera", ruolo: sc.roster[sidx].ruolo };
  const stmts = [
    env.DB.prepare("UPDATE clubs SET club = ?, state = ? WHERE id = ?").bind(JSON.stringify(bc), JSON.stringify(bs), buyerId),
    env.DB.prepare("UPDATE clubs SET club = ?, state = ? WHERE id = ?").bind(JSON.stringify(sc), JSON.stringify(ss), sellerId),
    env.DB.prepare("UPDATE offers SET status = 'rifiutata' WHERE to_club = ? AND status = 'aperta'").bind(sellerId),
  ];
  if (offerId) stmts.push(env.DB.prepare("UPDATE offers SET status = 'accettata' WHERE id = ?").bind(offerId));
  else stmts.push(env.DB.prepare("UPDATE offers SET status = 'accettata' WHERE from_club = ? AND to_club = ? AND status IN ('aperta','rifiutata') AND money = ?").bind(buyerId, sellerId, money));
  await env.DB.batch(stmts);
  await addNews(env, l, null, "mercato", "Colpo di mercato", `${f.name} passa da ${sc.name} a ${bc.name} per ${money} M€.`);
  await tgSend(env, l.tg_chat, `💸 <b>Colpo di mercato!</b> ${esc(f.name)} passa da ${esc(sc.name)} a ${esc(bc.name)} per ${money} M€.`);
  return { ok: true, accepted: true };
}

