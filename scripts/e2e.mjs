// Test end-to-end contro `wrangler dev` (http://localhost:8787)
const B = process.argv[2] ?? "http://localhost:8787";
const call = async (path, body, method) => {
  const r = await fetch(`${B}/api/${path}`, { method: method ?? (body ? "POST" : "GET"), headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error}`);
  return j;
};
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };

const { adminToken, playerToken } = await call("leagues", { name: "Lega Test", adminName: "Giacomo" });
const tokens = { Giacomo: playerToken };
for (const n of ["Luca", "Marco"]) tokens[n] = (await call(`admin/${adminToken}/players`, { name: n })).token;

let combos = 0;
for (const [name, t] of Object.entries(tokens)) {
  let me = await call(`me/${t}`);
  assert(me.mine.status === "creating", "creating");
  let spins = 0;
  for (;;) {
    const r = await call(`me/${t}/spin`, {});
    spins++; if (r.combo) combos++;
    if (r.status === "identity") break;
  }
  await call(`me/${t}/identity`, { name: `FC ${name}`, colors: ["#ff0000", "#ffffff"], crest: "scudo", fuoriclasseName: `Stella ${name}` });
  me = await call(`me/${t}`);
  assert(me.mine.status === "ready", "ready");
  console.log(`${name}: ${spins} spin, voto ${me.mine.club.voto} (${me.mine.club.classe}), ${me.mine.club.city}`);
}
console.log("combo totali:", combos);

let bad = null;
try { await call(`me/${tokens.Luca}/spin`, {}); } catch (e) { bad = e.message; }
assert(bad, "spin bloccato dopo la creazione");

await call(`admin/${adminToken}/start`, { teams: 8, firstDay: "domani" });
let adm = await call(`admin/${adminToken}`);
assert(adm.league.status === "running" && adm.league.totalMatchdays === 14, "running 14");
assert(adm.clubs.length === 8, "8 club");

// scelte
await call(`me/${tokens.Giacomo}/choices`, { modulo: "4-3-3", atteggiamento: "offensivo", turnover: "nessuno", discorso: "motivare" });

for (let md = 1; md <= 14; md++) {
  await call(`admin/${adminToken}/play-now`, {});
  const me = await call(`me/${tokens.Giacomo}`);
  if (me.league.marketOpen) {
    const st = me.mine.state;
    try { await call(`me/${tokens.Giacomo}/market`, { op: "sell", rep: "pan" }); console.log("mercato: cessione ok, budget", (await call(`me/${tokens.Giacomo}`)).mine.state.budget); } catch (e) { console.log("mercato:", e.message); }
    const other = me.clubs.find((c) => c.id !== me.mine.id && c.fuoriclasse);
    if (other) {
      try { const r = await call(`me/${tokens.Giacomo}/offers`, { to: other.id, money: Math.min(st.budget, 200) }); console.log("offerta:", JSON.stringify(r)); } catch (e) { console.log("offerta:", e.message); }
    }
  }
  if (me.mine.state.pendingDecision) { await call(`me/${tokens.Giacomo}/decision`, { sell: false }); console.log("decisione presa"); }
}
const fin = await call(`me/${tokens.Marco}`);
assert(fin.league.status === "finished", "finita");
console.log("Classifica finale:");
for (const [i, r] of fin.table.entries()) console.log(`${i + 1}. ${r.name.padEnd(22)} ${r.pt} pt  ${r.gf}-${r.gs}  (${r.owner})`);
console.log("Premi:", fin.league.history[0].awards.map((a) => `${a.title}: ${a.text}`).join(" | "));
const m = fin.matches.find((x) => x.played);
const md = await call(`me/${tokens.Marco}/match/${m.id}`);
assert(md.data.highlights.length >= 1 || md.hg + md.ag === 0, "highlights");
console.log("Notizie:", fin.news.length, "· prima:", fin.news.find((n) => n.kind === "cronaca")?.title);
let gol = 0; for (const x of fin.matches) gol += x.hg + x.ag;
console.log("Media gol:", (gol / fin.matches.length).toFixed(2));

await call(`admin/${adminToken}/new-season`, {});
const s2 = await call(`me/${tokens.Luca}`);
assert(s2.league.season === 2 && s2.mine.status === "creating", "stagione 2");
console.log("Stagione 2 aperta. OK");
console.log("ADMIN", adminToken, "PLAYER", playerToken);
