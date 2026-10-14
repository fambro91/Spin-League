// Simula molte carriere giocatore per controllare realismo e bilanciamento.
import { makeRng } from "../shared/rng";
import { CLUB_BY_ID, LEAGUES } from "../shared/pro/data";
import { acceptOffer, careerTotals, chooseMoment, clouAction, finishClou, finishCreation, goToOffers, newPro, playSegment, spinPro } from "../shared/pro/career";

const N = Number(process.argv[2] ?? 300);
const verbose = process.argv[3] === "v";
const agg = { retireAge: 0, peak: 0, goals: 0, ballon: 0, cl: 0, league: 0, clubs: 0, bigClub: 0, seasons: 0 };
const peakBuckets: Record<string, number> = {};
const byRole: Record<string, { n: number; ballon: number; avg: number; awards: number; peak: number }> = {};
for (let i = 0; i < N; i++) {
  const rng = makeRng("pro" + i);
  const s = newPro();
  while (s.phase === "creation") spinPro(s, rng);
  finishCreation(s, "Test " + i, 9);
  let guard = 0;
  while (s.phase !== "retired" && guard++ < 2000) {
    if (s.phase === "summer") { while (s.wheels.length) spinPro(s, rng); s.phase = "season"; continue; }
    if (s.phase === "season") { playSegment(s, rng); continue; }
    if (s.phase === "moment") { chooseMoment(s, rng.int(0, s.moment!.options.length - 1), rng); continue; }
    if (s.phase === "clou") { while (s.clou!.step < s.clou!.actions.length) { const a = s.clou!.actions[s.clou!.step]; clouAction(s, [...a.choices].sort((x, y) => y.pct - x.pct)[0].id, rng); } finishClou(s, rng); continue; }
    if (s.phase === "end") { goToOffers(s, rng); continue; }
    if (s.phase === "offers") {
      // il giocatore sceglie il club più forte tra quelli che gli promettono almeno la rotazione
      const ok = s.offers.map((o, k) => ({ o, k })).filter((x) => x.o.status === "titolare" || x.o.status === "rotazione");
      const pick = (ok.length ? ok : s.offers.map((o, k) => ({ o, k }))).sort((a, b) => s.strengths[b.o.clubId] - s.strengths[a.o.clubId])[0];
      acceptOffer(s, pick.k); continue;
    }
  }
  const t = careerTotals(s);
  const br = (byRole[s.p.role] ??= { n: 0, ballon: 0, avg: 0, awards: 0, peak: 0 });
  br.n++; br.ballon += s.trophies.ballon; br.avg += t.avg; br.awards += (s.trophies.roleAward ?? 0) + s.trophies.topScorer; br.peak += t.peak;
  agg.retireAge += s.p.age; agg.peak += t.peak; agg.goals += t.goals; agg.ballon += s.trophies.ballon; agg.cl += s.trophies.cl; agg.league += s.trophies.league; agg.clubs += t.clubs.length; agg.seasons += s.history.length;
  if (s.history.some((h) => (CLUB_BY_ID.get(h.clubId)!.strength >= 84))) agg.bigClub++;
  const b = t.peak >= 88 ? "88+" : t.peak >= 82 ? "82-87" : t.peak >= 76 ? "76-81" : t.peak >= 70 ? "70-75" : "<70";
  peakBuckets[b] = (peakBuckets[b] ?? 0) + 1;
  if (verbose && i < 4) {
    console.log(`\n${s.p.name} ${s.p.role}/${s.p.sub} pot ${s.p.pot} · ritiro a ${s.p.age} · ${t.verdict} (${t.legend})`);
    for (const h of s.history) console.log(`  ${h.year} ${h.age}a ${CLUB_BY_ID.get(h.clubId)!.name.padEnd(20)} ${LEAGUES[h.league].name.padEnd(16)} ovr ${h.ovr} ${h.status.padEnd(9)} pres ${String(h.stats.apps).padStart(2)} gol ${String(h.stats.goals).padStart(2)} ass ${String(h.stats.assists).padStart(2)} voto ${h.avg} pos ${h.pos}/${h.n} ${h.trophies.join(", ")}`);
  }
}
const m = (x: number) => (x / N).toFixed(2);
console.log(`\nCarriere: ${N} · ritiro medio ${m(agg.retireAge)} anni · stagioni ${m(agg.seasons)} · picco medio ${m(agg.peak)} · gol ${m(agg.goals)} · club ${m(agg.clubs)}`);
console.log(`Palloni d'Oro ${m(agg.ballon)} · Champions ${m(agg.cl)} · campionati ${m(agg.league)} · ha giocato in una big: ${(100 * agg.bigClub / N).toFixed(0)}%`);
console.log("Picchi:", Object.entries(peakBuckets).map(([k, v]) => `${k}: ${(100 * v / N).toFixed(0)}%`).join("  "));
for (const [r, b] of Object.entries(byRole)) console.log(`${r}: ${b.n} carriere · voto medio ${(b.avg / b.n).toFixed(2)} · picco ${(b.peak / b.n).toFixed(1)} · premi di ruolo ${(b.awards / b.n).toFixed(2)} · Palloni d'Oro ${(b.ballon / b.n).toFixed(2)}`);
