// Test delle funzioni di gestione: dilemmi, allenamento, investimenti, conferenza, pronostici, sfide
const B = process.argv[2] ?? "http://localhost:8787";
const call = async (path, body, method) => {
  const r = await fetch(`${B}/api/${path}`, { method: method ?? (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error(`${path}: ${j.error}`); return j;
};
const assert = (c, m) => { if (!c) throw new Error("ASSERT " + m); };
const { adminToken, playerToken: A } = await call("leagues", { name: "Agenda", adminName: "Giacomo" });
const Bt = (await call(`admin/${adminToken}/players`, { name: "Luca" })).token;
const fin = async (t, n) => { for (;;) { const r = await call(`me/${t}/spin`, {}); if (r.status === "identity") break; } await call(`me/${t}/identity`, { name: n, colors: ["#ff0000", "#000000"], crest: "scudo", fuoriclasseName: "Stella" }); };
await fin(A, "FC Giacomo"); await fin(Bt, "FC Luca");
await call(`admin/${adminToken}/start`, { teams: 4, firstDay: "domani" });
let a = await call(`me/${A}`), b = await call(`me/${Bt}`);
// trova una giornata in cui A e B si affrontano: gioca giornate finché capita
let guard = 0;
while (a.agenda && !a.agenda.oppHuman && guard++ < 6) { await call(`admin/${adminToken}/play-now`, {}); a = await call(`me/${A}`); }
b = await call(`me/${Bt}`);
console.log("giornata", a.agenda.md, "avversario umano:", a.agenda.oppHuman);
const cards = a.mine.state.dilemmas.cards; assert(cards.length === 2, "2 dilemmi");
const r1 = await call(`me/${A}/dilemma`, { id: cards[0].id, option: 1 }); console.log("dilemma:", cards[0].id, "→", r1.result);
let dup = null; try { await call(`me/${A}/dilemma`, { id: cards[0].id, option: 0 }); } catch (e) { dup = e.message; } assert(dup, "dilemma non ripetibile");
await call(`me/${A}/training`, { focus: "tecnica", rep: "att" });
const budget0 = (await call(`me/${A}`)).mine.state.budget;
try { const r = await call(`me/${A}/invest`, { id: "curva" }); console.log("invest:", r.msg); } catch (e) { console.log("invest:", e.message, "(budget", budget0, ")"); }
await call(`me/${A}/press`, { tone: "provocatoria", text: "Vi rimandiamo a casa!" });
a = await call(`me/${A}`);
const others = a.matches.filter((m) => m.matchday === a.agenda.md && m.homeId !== a.mine.id && m.awayId !== a.mine.id);
await call(`me/${A}/predictions`, { picks: Object.fromEntries(others.map((m) => [m.id, "1"])), exact: { matchId: others[0].id, h: 1, a: 0 } });
const bud = a.mine.state.budget, stake = Math.min(20, Math.floor(bud / 5) * 5);
if (stake >= 5) {
  await call(`me/${A}/challenge`, { stake });
  b = await call(`me/${Bt}`);
  assert(b.agenda.challenge && b.agenda.challenge.status === "proposta", "sfida ricevuta");
  const bb = b.mine.state.budget;
  if (bb >= stake) await call(`me/${Bt}/challenge/${b.agenda.challenge.id}`, { accept: true });
}
const before = (await call(`me/${A}`)).mine.state;
await call(`admin/${adminToken}/play-now`, {});
a = await call(`me/${A}`);
const st = a.mine.state;
console.log("pronostici punti:", st.predPoints, "· budget prima/dopo:", before.budget, "→", st.budget, "· morale", before.morale, "→", st.morale);
const news = a.news.slice(0, 6).map((n) => `${n.kind}: ${n.title}`);
console.log("news:", news.join(" | "));
console.log("nuovi dilemmi per giornata", a.agenda?.md, a.mine.state.dilemmas?.cards.map((c) => c.id).join(", "));
console.log("OK");
