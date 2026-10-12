// Taratura: simula molte stagioni con squadre generate dalle ruote e strategia CPU.
import { makeRng } from "../shared/rng";
import { newCreation, doSpin } from "../shared/wheels";
import { computeClub, cpuIdentity, initialState } from "../shared/club";
import { simulateMatch } from "../shared/engine";
import { afterMatch, bergerSchedule, cpuChoices, dailyEvent, standings, type ClubBundle } from "../shared/league";

const SEASONS = Number(process.argv[2] ?? 10000);
const N = Number(process.argv[3] ?? 8);
let topWins = 0, goals = 0, matches = 0, homeW = 0, draws = 0, top3 = 0;
const classCount: Record<string, number> = {};
const votoTitles: number[] = [];

for (let s = 0; s < SEASONS; s++) {
  const rng = makeRng("season" + s);
  const clubs: ClubBundle[] = [];
  for (let i = 0; i < N; i++) {
    const cs = newCreation();
    while (cs.queue.length) doSpin(cs, rng);
    const id = cpuIdentity(`s${s}c${i}`, cs.draft.city ?? "X");
    const club = computeClub(cs.draft, id, `s${s}c${i}`);
    classCount[club.classe] = (classCount[club.classe] ?? 0) + 1;
    clubs.push({ id: `c${i}`, club, state: initialState(club), isCpu: true });
  }
  const sched = bergerSchedule(N);
  const played: { matchday: number; homeId: string; awayId: string; homeGoals: number; awayGoals: number }[] = [];
  sched.forEach((round, r) => {
    const md = r + 1;
    for (const [hi, ai] of round) {
      const H = clubs[hi], A = clubs[ai];
      const hc = cpuChoices(H.club, H.state), ac = cpuChoices(A.club, A.state);
      const res = simulateMatch({ club: H.club, state: H.state, choices: hc, home: true }, { club: A.club, state: A.state, choices: ac, home: false }, md, `${s}:${md}:${hi}`);
      const derby = !!H.club.region && H.club.region === A.club.region;
      afterMatch(H.club, H.state, hc, res.homeGoals, res.awayGoals, true, derby, md);
      afterMatch(A.club, A.state, ac, res.awayGoals, res.homeGoals, false, derby, md);
      played.push({ matchday: md, homeId: H.id, awayId: A.id, homeGoals: res.homeGoals, awayGoals: res.awayGoals });
      goals += res.homeGoals + res.awayGoals; matches++;
      if (res.homeGoals > res.awayGoals) homeW++; else if (res.homeGoals === res.awayGoals) draws++;
    }
    dailyEvent(rng, clubs, md); dailyEvent(rng, clubs, md);
  });
  const rows = standings(clubs.map((c) => ({ id: c.id, name: c.club.name, colors: c.club.colors, owner: "" })), played, "s" + s);
  const best = [...clubs].sort((a, b) => b.club.voto - a.club.voto)[0];
  if (rows[0].id === best.id) topWins++;
  if (rows.slice(0, 3).some((r) => r.id === best.id)) top3++;
  votoTitles.push(clubs.find((c) => c.id === rows[0].id)!.club.voto);
}
const pct = (x: number, t: number) => ((100 * x) / t).toFixed(1) + "%";
const totalClubs = SEASONS * N;
console.log(`Stagioni: ${SEASONS}, squadre: ${N}`);
console.log(`Squadra col voto più alto vince: ${pct(topWins, SEASONS)}  (podio: ${pct(top3, SEASONS)})`);
console.log(`Media gol: ${(goals / matches).toFixed(2)}  · vittorie casa: ${pct(homeW, matches)} · pareggi: ${pct(draws, matches)}`);
console.log("Classi:", Object.entries(classCount).sort().map(([k, v]) => `${k} ${pct(v, totalClubs)}`).join("  "));
console.log(`Voto medio dei campioni: ${(votoTitles.reduce((a, b) => a + b, 0) / SEASONS).toFixed(1)}`);
