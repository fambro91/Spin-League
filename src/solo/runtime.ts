// Modalità carriera offline: il backend del gioco gira nel browser.
// Stesso codice del server (worker/index.ts) su un database SQLite locale (sql.js),
// salvato in IndexedDB su questo dispositivo.
import initSqlJs, { type Database, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { handleApi } from "../../worker/api";
import type { Env } from "../../worker/db";

const IDB = "spin-solo", STORE = "kv", KEY = "db";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(): Promise<Uint8Array | null> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res((q.result as Uint8Array) ?? null);
      q.onerror = () => res(null);
    });
  } catch { return null; }
}
async function idbPut(v: Uint8Array | null) {
  try {
    const db = await idb();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      if (v) tx.objectStore(STORE).put(v, KEY); else tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res();
    });
  } catch { /* storage non disponibile: la partita resta in memoria */ }
}

/* ---------- adattatore D1 → sql.js (solo i metodi usati dal gioco) ---------- */

const norm = (v: unknown): SqlValue => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : (v as SqlValue));

class Stmt {
  constructor(private db: Database, private sql: string, private params: SqlValue[] = []) {}
  bind(...args: unknown[]) { return new Stmt(this.db, this.sql, args.map(norm)); }
  private rows(): any[] {
    const st = this.db.prepare(this.sql);
    try {
      st.bind(this.params);
      const out: any[] = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally { st.free(); }
  }
  async run() { this.db.run(this.sql, this.params); return { success: true, meta: { changes: this.db.getRowsModified() }, results: [] }; }
  async all<T = any>() { return { success: true, meta: {}, results: this.rows() as T[] }; }
  async first<T = any>(col?: string): Promise<T | null> {
    const r = this.rows()[0];
    if (!r) return null;
    return (col ? r[col] : r) as T;
  }
  exec() { const r = this.rows(); return { results: r, meta: { changes: this.db.getRowsModified() } }; }
}

class D1Shim {
  constructor(public db: Database) {}
  prepare(sql: string) { return new Stmt(this.db, sql); }
  async batch(stmts: Stmt[]) {
    this.db.run("BEGIN");
    try {
      const out = stmts.map((s) => s.exec());
      this.db.run("COMMIT");
      return out;
    } catch (e) { this.db.run("ROLLBACK"); throw e; }
  }
}

let env: Env | null = null;
let shim: D1Shim | null = null;
let booting: Promise<void> | null = null;

async function boot() {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet();
  shim = new D1Shim(saved ? new SQL.Database(saved) : new SQL.Database());
  env = { DB: shim as unknown as D1Database, ASSETS: undefined as unknown as Fetcher };
}

let saving = Promise.resolve();
function persist() {
  if (!shim) return;
  const bytes = shim.db.export();
  saving = saving.then(() => idbPut(bytes));
}

/** Stessa interfaccia di api(): risponde il "server" locale. */
export async function soloApi<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  booting ??= boot();
  await booting;
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const url = new URL(`https://solo.local/api/${path}`);
  const req = new Request(url, { method, headers: opts.body ? { "content-type": "application/json" } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let res: Response;
  try { res = await handleApi(req, env!, url); }
  catch (e: any) { res = new Response(JSON.stringify({ error: e?.message ?? "Errore" }), { status: e?.status ?? 500 }); }
  if (method !== "GET" || path.startsWith("me/")) persist(); // anche le GET possono scrivere (es. dilemmi del giorno)
  let data: any = null;
  try { data = await res.json(); } catch { /* vuoto */ }
  if (!res.ok) throw new Error(data?.error ?? `Errore ${res.status}`);
  return data as T;
}

/** Cancella la carriera salvata su questo dispositivo. */
export async function wipeSolo() {
  await saving;
  await idbPut(null);
}
