// Test della carriera: gira l'API vera su SQLite in memoria (come nel browser).
import initSqlJs, { type Database } from "sql.js";
import { handleApi } from "../worker/api";

const SQL = await initSqlJs();
const db: Database = new SQL.Database();
const norm = (v: any) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
class Stmt {
  constructor(private sql: string, private p: any[] = []) {}
  bind(...a: any[]) { return new Stmt(this.sql, a.map(norm)); }
  rows() { const st = db.prepare(this.sql); st.bind(this.p); const o: any[] = []; while (st.step()) o.push(st.getAsObject()); st.free(); return o; }
  async run() { db.run(this.sql, this.p); return { meta: { changes: db.getRowsModified() } }; }
  async all() { return { results: this.rows() }; }
  async first(col?: string) { const r = this.rows()[0]; return r ? (col ? r[col] : r) : null; }
  exec() { return { results: this.rows(), meta: { changes: db.getRowsModified() } }; }
}
const env: any = { DB: { prepare: (s: string) => new Stmt(s), batch: async (st: Stmt[]) => { db.run("BEGIN"); try { const o = st.map((x) => x.exec()); db.run("COMMIT"); return o; } catch (e) { db.run("ROLLBACK"); throw e; } } } };
const call = async (path: string, body?: any, method?: string) => {
  const url = new URL("https://x/api/" + path);
  const res = await handleApi(new Request(url, { method: method ?? (body ? "POST" : "GET"), body: body ? JSON.stringify(body) : undefined }), env, url).catch((e: any) => new Response(JSON.stringify({ error: e.message }), { status: e.status ?? 500 }));
  const j: any = await res.json();
  if (!res.ok) throw new Error(path + ": " + j.error);
  return j;
};
const assert = (c: any, m: string) => { if (!c) throw new Error("ASSERT " + m); };

const { adminToken: A, playerToken: P } = await call("leagues", { name: "Carriera di Test", adminName: "Giacomo" });
const createClub = async () => {
  for (;;) { const r = await call(`me/${P}/spin`, {}); if (r.status === "identity") break; }
  await call(`me/${P}/identity`, { name: "Real Lucchese", colors: ["#b91c1c", "#111827"], crest: "scudo", fuoriclasseName: "Il Fenomeno" });
};
await createClub();
await call(`admin/${A}/career-setup`, { teams: 8 });
let me = await call(`me/${P}`);
assert(me.career.division === "B" && me.clubs.length === 8 && me.career.otherClubs.length === 8, "setup divisioni");
console.log("Stagione 1:", me.career.divisionLabel, "· ruote:", me.career.wheels.join(","));

const strategy = (p: any) => p.kind === "intervallo" ? { kind: "intervallo", choice: p.score[0] < p.score[1] ? "attacco" : "strigliata" }
  : p.kind === "finale" ? { kind: "finale", choice: "vincere" } : p.kind === "rigore" ? { kind: "rigore", shooter: p.shooters[0].name, dir: "centro" } : { kind: "ruota" };

for (let season = 1; season <= 4; season++) {
  // ruote di pre-stagione
  for (;;) { me = await call(`me/${P}`); if (me.mine.status !== "ready") { await createClub(); continue; } if (!me.career.wheels.length) break; const w = await call(`admin/${A}/career-wheel`, {}); console.log(`  ruota ${w.wheel.title}: ${w.label} — ${w.note}`); }
  await call(`admin/${A}/career-kickoff`, {});
  me = await call(`me/${P}`);
  console.log(`Stagione ${me.league.season} · ${me.career.divisionLabel} · obiettivo: ${me.career.objective?.label} · fiducia ${me.career.fiducia} · mercato ${me.league.marketOpen}`);
  let livePauses = 0;
  for (let md = 1; md <= me.league.totalMatchdays; md++) {
    let lv = await call(`me/${P}/live`);
    while (lv.pending) { livePauses++; lv = await call(`me/${P}/live`, { decision: strategy(lv.pending) }); }
    const r = await call(`admin/${A}/career-play`, {});
    assert(r.matchday === md, "giornata " + md);
    const view = await call(`me/${P}`);
    const myM = view.matches.find((m: any) => m.matchday === md && (m.homeId === view.mine.id || m.awayId === view.mine.id));
    assert(myM.hg === lv.result.homeGoals && myM.ag === lv.result.awayGoals, "risultato diretta = risultato salvato");
    assert(view.career.otherTable.every((x: any) => x.g === md), "altra divisione in pari");
  }
  me = await call(`me/${P}`);
  const pos = me.table.findIndex((r: any) => r.id === me.mine.id) + 1;
  console.log(`  fine: ${pos}° su ${me.table.length} · pause in diretta ${livePauses} · altra divisione: 1ª ${me.career.otherTable[0].name}`);
  const s = await call(`admin/${A}/career-end`, {});
  console.log(`  → ${s.you ?? "—"} · obiettivo ${s.ok ? "centrato" : "mancato"} · fiducia ${s.fiducia} (${s.fiduciaDelta >= 0 ? "+" : ""}${s.fiduciaDelta})${s.esonero ? " · ESONERATO" : ""} · promosse ${s.promoted.join(", ")} · retrocesse ${s.relegated.join(", ")}`);
  me = await call(`me/${P}`);
  assert(me.league.status === "setup" && me.league.season === season + 1, "nuova stagione");
}
me = await call(`me/${P}`);
console.log("Palmarès:", me.career.palmares.map((p: any) => `S${p.season} ${p.division} ${p.pos}° ${p.outcome}`).join(" | "));
console.log("OK");
