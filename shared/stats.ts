import type { MatchEvent, MatchStats } from "./types";

export type StatMatch = { homeId: string; awayId: string; hg: number; ag: number; events: MatchEvent[]; stats?: MatchStats };
export type PlayerStat = { name: string; clubId: string; goals: number; assists: number };
export type TeamStat = {
  clubId: string; g: number; gf: number; gs: number; cleanSheets: number;
  shots: number; onTarget: number; possession: number; // medie
  bigWin: { gf: number; ga: number; oppId: string } | null;
};
export type LeagueStats = {
  scorers: PlayerStat[]; assists: PlayerStat[]; teams: TeamStat[]; withAssists: boolean;
};

export function leagueStats(matches: StatMatch[]): LeagueStats {
  const players = new Map<string, PlayerStat>();
  const teams = new Map<string, TeamStat & { _sh: number; _ot: number; _po: number; _n: number }>();
  const pl = (clubId: string, name: string) => {
    const k = clubId + "|" + name;
    let p = players.get(k);
    if (!p) { p = { name, clubId, goals: 0, assists: 0 }; players.set(k, p); }
    return p;
  };
  const tm = (clubId: string) => {
    let t = teams.get(clubId);
    if (!t) { t = { clubId, g: 0, gf: 0, gs: 0, cleanSheets: 0, shots: 0, onTarget: 0, possession: 0, bigWin: null, _sh: 0, _ot: 0, _po: 0, _n: 0 }; teams.set(clubId, t); }
    return t;
  };
  let withAssists = false;
  for (const m of matches) {
    const ids = [m.homeId, m.awayId];
    const goals = [m.hg, m.ag];
    ids.forEach((id, i) => {
      const t = tm(id);
      t.g++; t.gf += goals[i]; t.gs += goals[1 - i];
      if (goals[1 - i] === 0) t.cleanSheets++;
      const margin = goals[i] - goals[1 - i];
      if (margin > 0 && (!t.bigWin || margin > t.bigWin.gf - t.bigWin.ga || (margin === t.bigWin.gf - t.bigWin.ga && goals[i] > t.bigWin.gf)))
        t.bigWin = { gf: goals[i], ga: goals[1 - i], oppId: ids[1 - i] };
      if (m.stats) { t._sh += m.stats.shots[i]; t._ot += m.stats.onTarget[i]; t._po += m.stats.possession[i]; t._n++; }
    });
    for (const e of m.events) {
      if (e.type !== "gol") continue;
      const cid = e.team === "home" ? m.homeId : m.awayId;
      if (e.player) pl(cid, e.player).goals++;
      if (e.assist) { pl(cid, e.assist).assists++; withAssists = true; }
    }
  }
  const all = [...players.values()];
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    scorers: all.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name)).slice(0, 10),
    assists: all.filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 10),
    teams: [...teams.values()].map(({ _sh, _ot, _po, _n, ...t }) => ({ ...t, shots: _n ? r1(_sh / _n) : 0, onTarget: _n ? r1(_ot / _n) : 0, possession: _n ? Math.round(_po / _n) : 0 })),
    withAssists,
  };
}
