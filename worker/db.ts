export interface Env {
  DB: D1Database;
  AI?: Ai;
  ASSETS: Fetcher;
  TELEGRAM_BOT_TOKEN?: string;
  CREATE_SECRET?: string;
  AI_MODEL?: string;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS leagues (id TEXT PRIMARY KEY, name TEXT NOT NULL, admin_hash TEXT NOT NULL, seed TEXT NOT NULL,
    season INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'setup', start_date TEXT, matchday_played INTEGER NOT NULL DEFAULT 0,
    total_matchdays INTEGER NOT NULL DEFAULT 0, market_open INTEGER NOT NULL DEFAULT 0, tg_chat TEXT, tg_code TEXT,
    history TEXT NOT NULL DEFAULT '[]', reminder_date TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, league_id TEXT NOT NULL, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS clubs (id TEXT PRIMARY KEY, league_id TEXT NOT NULL, season INTEGER NOT NULL, player_id TEXT, is_cpu INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL, creation TEXT, club TEXT, state TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, league_id TEXT NOT NULL, season INTEGER NOT NULL, matchday INTEGER NOT NULL,
    home_id TEXT NOT NULL, away_id TEXT NOT NULL, played INTEGER NOT NULL DEFAULT 0, home_goals INTEGER, away_goals INTEGER, data TEXT)`,
  `CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT, league_id TEXT NOT NULL, season INTEGER NOT NULL, matchday INTEGER,
    kind TEXT NOT NULL, title TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, league_id TEXT NOT NULL, season INTEGER NOT NULL, from_club TEXT NOT NULL,
    to_club TEXT NOT NULL, money REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS days (league_id TEXT NOT NULL, season INTEGER NOT NULL, matchday INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (league_id, season, matchday))`,
  `CREATE INDEX IF NOT EXISTS idx_clubs_league ON clubs(league_id, season)`,
  `CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id, season, matchday)`,
  `CREATE INDEX IF NOT EXISTS idx_news_league ON news(league_id, season)`,
  `CREATE INDEX IF NOT EXISTS idx_players_league ON players(league_id)`,
];

let ready = false;
export async function ensureSchema(db: D1Database) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const nowIso = () => new Date().toISOString();

export function romeNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type LeagueRow = {
  id: string; name: string; admin_hash: string; seed: string; season: number; status: "setup" | "running" | "finished";
  start_date: string | null; matchday_played: number; total_matchdays: number; market_open: number;
  tg_chat: string | null; tg_code: string | null; history: string; reminder_date: string | null; created_at: string;
};
export type PlayerRow = { id: string; league_id: string; name: string; token_hash: string; created_at: string };
export type ClubRow = {
  id: string; league_id: string; season: number; player_id: string | null; is_cpu: number; status: "creating" | "identity" | "ready";
  creation: string | null; club: string | null; state: string | null; created_at: string;
};
export type MatchRow = {
  id: string; league_id: string; season: number; matchday: number; home_id: string; away_id: string; played: number;
  home_goals: number | null; away_goals: number | null; data: string | null;
};
