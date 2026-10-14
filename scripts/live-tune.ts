// Verifica del bilanciamento della partita in diretta: confronta con la simulazione classica.
import { makeRng } from "../shared/rng";
import { newCreation, doSpin } from "../shared/wheels";
import { computeClub, cpuIdentity, initialState } from "../shared/club";
import { simulateMatch } from "../shared/engine";
import { simulateLive, type Decision } from "../shared/live";
import { cpuChoices } from "../shared/league";

const N = Number(process.argv[2] ?? 4000);
const strategies: Record<string, (p: any, rng: any) => Decision> = {
  prudente: (p) => p.kind === "intervallo" ? { kind: "intervallo", choice: "compatti" } : p.kind === "finale" ? { kind: "finale", choice: "pareggio" } : p.kind === "rigore" ? { kind: "rigore", shooter: p.shooters[0].name, dir: "sx" } : { kind: "ruota" },
  aggressivo: (p) => p.kind === "intervallo" ? { kind: "intervallo", choice: "attacco" } : p.kind === "finale" ? { kind: "finale", choice: "vincere" } : p.kind === "rigore" ? { kind: "rigore", shooter: p.shooters[0].name, dir: "dx" } : { kind: "ruota" },
  intelligente: (p) => {
    if (p.kind === "intervallo") { const [h, a] = p.score; return { kind: "intervallo", choice: h < a ? "attacco" : h > a ? "compatti" : "strigliata" }; }
    if (p.kind === "finale") { const [h, a] = p.score; return { kind: "finale", choice: h > a ? "pareggio" : "vincere" }; }
    if (p.kind === "rigore") return { kind: "rigore", shooter: p.shooters[0].name, dir: "centro" };
    return { kind: "ruota" };
  },
  casuale: (p, r) => p.kind === "intervallo" ? { kind: "intervallo", choice: r.pick(["attacco", "compatti", "strigliata"]) } : p.kind === "finale" ? { kind: "finale", choice: r.pick(["vincere", "pareggio"]) } : p.kind === "rigore" ? { kind: "rigore", shooter: r.pick(p.shooters).name, dir: r.pick(["sx", "centro", "dx"]) } : { kind: "ruota" },
};
const mk = (seed: string) => { const r = makeRng(seed); const cs = newCreation(); while (cs.queue.length) doSpin(cs, r); const c = computeClub(cs.draft, cpuIdentity(seed, cs.draft.city ?? "X"), seed); return { club: c, state: initialState(c) }; };
const base = { w: 0, d: 0, l: 0, gf: 0, ga: 0 };
const res: Record<string, typeof base> = { classica: { ...base } };
for (const k of Object.keys(strategies)) res[k] = { ...base };
let pauses = 0, pens = 0, wheels = 0;
for (let i = 0; i < N; i++) {
  const H = mk("h" + i), A = mk("a" + i);
  const hc = { ...H, choices: cpuChoices(H.club, H.state), home: true }, ac = { ...A, choices: cpuChoices(A.club, A.state), home: false };
  const add = (k: string, gf: number, ga: number) => { const x = res[k]; x.gf += gf; x.ga += ga; if (gf > ga) x.w++; else if (gf === ga) x.d++; else x.l++; };
  const c = simulateMatch(hc, ac, 1, "m" + i); add("classica", c.homeGoals, c.awayGoals);
  for (const [k, strat] of Object.entries(strategies)) {
    const r = makeRng("dec" + i + k); const dec: Decision[] = [];
    for (let g = 0; g < 20; g++) {
      const o = simulateLive(hc, ac, 1, "m" + i, "home", dec);
      if (!o.pending) { add(k, o.score[0], o.score[1]); break; }
      if (k === "casuale") { pauses++; if (o.pending.kind === "rigore") pens++; if (o.pending.kind === "ruota") wheels++; }
      dec.push(strat(o.pending, r));
    }
  }
}
for (const [k, x] of Object.entries(res)) console.log(k.padEnd(13), `V ${(100 * x.w / N).toFixed(1)}%  N ${(100 * x.d / N).toFixed(1)}%  P ${(100 * x.l / N).toFixed(1)}%  gol fatti ${(x.gf / N).toFixed(2)} subiti ${(x.ga / N).toFixed(2)}`);
console.log(`pause a partita ${(pauses / N).toFixed(2)} · rigori ${(pens / N).toFixed(2)} · ruote ${(wheels / N).toFixed(2)}`);
