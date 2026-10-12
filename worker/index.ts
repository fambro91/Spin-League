import { ensureSchema, nowIso, romeNow, sha256, type Env, type LeagueRow, type PlayerRow, type ClubRow, type MatchRow } from "./db";
import {
  addNews, bundle, cronTick, ensurePlayerClub, formatDate, getLeague, id, loadClubs, loadMatches, matchdayDate, newSeason,
  playMatchday, publicClub, spin, startLeague,
} from "./game";
import { randomToken } from "../shared/rng";
import { computeClub, initialState, clamp } from "../shared/club";
import { marketOp, sellFuoriclasse, standings } from "../shared/league";
import { ATTEGGIAMENTI, MODULI, REPARTI, type ClubState, type CreationState, type Identity, type Reparto } from "../shared/types";
import { esc, tgCall, tgSecret, tgSend } from "./telegram";

class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

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
  const table = l.status === "setup" ? [] : standings(bundles.map((b) => ({ id: b.id, name: b.club.name, colors: b.club.colors, owner: b.owner })), played, l.seed);
  const { results: news } = await env.DB.prepare("SELECT id, matchday, kind, title, body, created_at FROM news WHERE league_id = ? AND season = ? ORDER BY id DESC LIMIT 40").bind(l.id, l.season).all();
  const next = l.matchday_played + 1;
  return {
    league: {
      id: l.id, name: l.name, season: l.season, status: l.status, startDate: l.start_date, matchdayPlayed: l.matchday_played,
      totalMatchdays: l.total_matchdays, marketOpen: !!l.market_open, nextMatchday: l.status === "running" ? next : null,
      nextMatchDate: l.status === "running" ? matchdayDate(l, next) : null, telegram: !!l.tg_chat,
      history: JSON.parse(l.history || "[]"),
    },
    participants: rows.map((r) => ({ id: r.id, owner: r.owner, status: r.status, isCpu: !!r.is_cpu })),
    clubs: bundles.map(publicClub),
    table,
    matches: matches.map((m) => ({ id: m.id, matchday: m.matchday, homeId: m.home_id, awayId: m.away_id, played: !!m.played, hg: m.home_goals, ag: m.away_goals })),
    news,
    myClubId,
  };
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
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
      return json({ ...view, player: { id: p.id, name: p.name }, mine, offers, now: romeNow() });
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
    const save = () => env.DB.prepare("UPDATE clubs SET club = ?, state = ? WHERE id = ?").bind(JSON.stringify(club), JSON.stringify(state), c!.id).run();

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
      const err = marketOp(state, b.op, b.rep);
      if (err) throw new HttpError(400, err);
      await save();
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(req, env, url);
      } catch (e: any) {
        if (e instanceof HttpError) return json({ error: e.message }, e.status);
        console.error(e);
        return json({ error: "Errore del server. Riprova tra poco." }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    await ensureSchema(env.DB);
    ctx.waitUntil(cronTick(env));
  },
};

// usati solo per evitare avvisi di import inutilizzati in alcuni bundler
void formatDate;
