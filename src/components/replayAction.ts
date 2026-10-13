// Costruzione di un'azione degli highlights: catena di passaggi tra giocatori veri,
// in coordinate "attacco verso destra" (x 0 → porta propria, 1 → porta avversaria; y 0 → lato lontano, 1 → lato vicino).
import type { MatchEvent, RosterPlayer } from "../../shared/types";
import type { Rng } from "../../shared/rng";

export type P = [number, number];
export type Role = "POR" | "DIF" | "CEN" | "ATT";
export type Slot = { role: Role; base: P; name?: string };
export type Seg = { t0: number; t1: number; a: P; b: P; c?: P; h: number; zEnd?: number; kind: "hold" | "pass" | "carry" | "shot" | "after"; owner: number | null };
export type Anchor = { t0: number; t1: number; p0: P; p1: P; jump?: boolean };
export type Action = {
  atk: Slot[]; def: Slot[];
  segs: Seg[]; anchors: Map<number, Anchor[]>;
  passes: { t0: number; t1: number; a: P; b: P }[];
  tShot: number; tHit: number; tEnd: number;
  finisher: number; assister: number | null;
  shotY: number; gkTarget: number; gkDelay: number; gkReach: number;
  shiftA: (t: number) => number; shiftD: (t: number) => number;
  special: "corner" | "rigore" | "punizione" | null;
  defHold: { j: number; until: number; p: P } | null;
  caption: string; gkName?: string;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function lines(mod: string): number[] {
  const l = mod.split("-").map(Number).filter((n) => n > 0);
  return l.length >= 2 ? l : [4, 4, 2];
}

/** Disposizione della squadra che attacca (verso destra). */
function atkShape(mod: string): Slot[] {
  const L = lines(mod), m = L.length - 2;
  const out: Slot[] = [{ role: "POR", base: [0.06, 0.5] }];
  L.forEach((n, li) => {
    const role: Role = li === 0 ? "DIF" : li === L.length - 1 ? "ATT" : "CEN";
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? 0.5 : 0.12 + ((i + 0.5) / n) * 0.76;
      const outer = i === 0 || i === n - 1;
      let x = 0.64;
      if (role === "DIF") x = n >= 4 && outer ? (n === 5 ? 0.58 : 0.52) : 0.42;
      else if (role === "CEN") x = m === 1 ? 0.63 : 0.57 + ((li - 1) / Math.max(1, m - 1)) * 0.13;
      else x = n >= 3 && outer ? 0.79 : 0.83;
      out.push({ role, base: [x, y] });
    }
  });
  return out;
}

/** Disposizione della squadra che difende (porta a destra, blocco compatto). */
function defShape(mod: string): Slot[] {
  const L = lines(mod), m = L.length - 2;
  const out: Slot[] = [{ role: "POR", base: [0.972, 0.5] }];
  L.forEach((n, li) => {
    const role: Role = li === 0 ? "DIF" : li === L.length - 1 ? "ATT" : "CEN";
    for (let i = 0; i < n; i++) {
      let x: number, y: number;
      if (role === "DIF") { x = 0.875; y = 0.24 + ((i + 0.5) / n) * 0.52; }
      else if (role === "CEN") { x = m === 1 ? 0.76 : 0.785 - ((li - 1) / Math.max(1, m - 1)) * 0.07; y = 0.22 + ((i + 0.5) / n) * 0.56; }
      else { x = 0.63; y = n === 1 ? 0.5 : 0.36 + ((i + 0.5) / n) * 0.28; }
      out.push({ role, base: [x, y] });
    }
  });
  return out;
}

function nameSlots(slots: Slot[], roster: RosterPlayer[] | undefined, rng: Rng, fixed: Map<number, string>) {
  const used = new Set(fixed.values());
  slots.forEach((s, i) => {
    if (fixed.has(i)) { s.name = fixed.get(i); return; }
    if (!roster) return;
    const pool = roster.filter((p) => p.ruolo === s.role && !used.has(p.name));
    if (!pool.length) return;
    const p = pool[Math.floor(rng.next() * pool.length)];
    s.name = p.name; used.add(p.name);
  });
}

const CAPTION: Record<string, string> = {
  cross: "Cross dalla fascia", fraseggio: "Azione manovrata", tiro_fuori: "Tiro dalla distanza", contropiede: "Contropiede",
  recupero: "Pressing alto", piazzato: "Calcio d'angolo", rigore: "Calcio di rigore", punizione: "Punizione",
};

export function buildAction(e: MatchEvent, mods: [string, string], rosters: [RosterPlayer[] | undefined, RosterPlayer[] | undefined], rng: Rng): Action {
  const home = e.team === "home";
  const atk = atkShape(home ? mods[0] : mods[1]);
  const def = defShape(home ? mods[1] : mods[0]);
  const rA = home ? rosters[0] : rosters[1], rD = home ? rosters[1] : rosters[0];
  const flip = rng.chance(0.5);
  const Y = (y: number) => (flip ? 1 - y : y); // specchia il lato dell'azione
  const J = (s = 0.05) => (rng.next() - 0.5) * s;
  const roleOf = (n?: string): Role | undefined => (n ? rA?.find((p) => p.name === n)?.ruolo : undefined);
  const schema0 = e.schema ?? "fraseggio";
  const isGoal = e.type === "gol";
  const fRole: Role = e.role ?? roleOf(e.player) ?? (schema0 === "piazzato" ? "DIF" : schema0 === "tiro_fuori" ? "CEN" : "ATT");
  // assist: per i gol solo se registrato; per le occasioni sbagliate c'è sempre un ultimo passaggio
  const hasAssist = schema0 === "rigore" ? false : isGoal ? !!e.assist : schema0 !== "piazzato" || rng.chance(0.7);
  const aRole: Role = e.assistRole ?? roleOf(e.assist) ?? (rng.chance(0.5) ? "CEN" : rng.chance(0.6) ? "ATT" : "DIF");
  const schema = schema0 === "piazzato" && !hasAssist ? "punizione" : schema0;

  const idxOf = (role: Role, excl: number[], prefer?: (s: Slot) => number) => {
    let c = atk.map((s, i) => i).filter((i) => i > 0 && atk[i].role === role && !excl.includes(i));
    if (!c.length) c = atk.map((s, i) => i).filter((i) => i > 0 && !excl.includes(i));
    if (prefer) c.sort((a, b) => prefer(atk[b]) - prefer(atk[a]));
    return prefer ? c[0] : c[Math.floor(rng.next() * c.length)];
  };
  const wideSide = (s: Slot) => -Math.abs(s.base[1] - Y(0.1)); // più vicino alla fascia scelta
  const F = idxOf(fRole, [], fRole === "ATT" ? (s) => -Math.abs(s.base[1] - 0.5) + rng.next() * 0.3 : undefined);
  const A = hasAssist ? idxOf(aRole, [F], schema === "cross" ? wideSide : undefined) : null;
  const fixed = new Map<number, string>();
  if (e.player) fixed.set(F, e.player);
  if (A != null && isGoal && e.assist) fixed.set(A, e.assist);
  nameSlots(atk, rA, rng, fixed);
  nameSlots(def, rD, rng, new Map());

  const segs: Seg[] = [], passes: Action["passes"] = [];
  const anchors = new Map<number, Anchor[]>();
  const anc = (i: number, a: Anchor) => { if (!anchors.has(i)) anchors.set(i, []); anchors.get(i)!.push(a); };
  let t = 0, cur: P = [0.5, 0.5], holder = F;
  const start = (i: number, p: P, d: number) => { holder = i; cur = p; anc(i, { t0: 0, t1: d, p0: p, p1: p }); segs.push({ t0: 0, t1: d, a: p, b: p, h: 0, kind: "hold", owner: i }); t = d; };
  const pass = (to: number, q: P, h = 0) => {
    const d = 0.17 + dist(cur, q) * (h ? 1.25 : 1.0) + (h ? 0.2 : 0);
    segs.push({ t0: t, t1: t + d, a: cur, b: q, h, kind: "pass", owner: null });
    passes.push({ t0: t, t1: t + d, a: cur, b: q });
    t += d; cur = q; holder = to;
  };
  const control = (d = 0.22, jump = false) => {
    const q: P = [cur[0] + (jump ? 0 : 0.012), cur[1]];
    anc(holder, { t0: t, t1: t + d, p0: cur, p1: q, jump });
    segs.push({ t0: t, t1: t + d, a: cur, b: q, h: 0, kind: "hold", owner: holder });
    t += d; cur = q;
  };
  const carry = (q: P) => {
    const d = 0.3 + dist(cur, q) * 2.6;
    anc(holder, { t0: t, t1: t + d, p0: cur, p1: q });
    segs.push({ t0: t, t1: t + d, a: cur, b: q, h: 0, kind: "carry", owner: holder });
    t += d; cur = q;
  };
  const pick = (role: Role, excl: number[]) => idxOf(role, excl);

  let special: Action["special"] = null, defHold: Action["defHold"] = null;
  let shiftA = (_: number) => 0, shiftD = (_: number) => 0;
  let header = false, longShot = false, curl = false;

  switch (schema) {
    case "cross": {
      if (A != null) {
        const M = pick("CEN", [F, A]), X = pick(rng.chance(0.5) ? "CEN" : "DIF", [F, A, M]);
        start(X, [0.53, Y(0.55 + J())], 0.3);
        pass(M, [0.65, Y(0.36 + J())]); control();
        pass(A, [0.79, Y(0.1 + J(0.03))]); control(0.18);
        carry([0.905, Y(0.07)]);
        pass(F, [0.9 + J(0.02), Y(rng.chance(0.5) ? 0.44 : 0.56)], 0.075); control(0.06, true);
        header = true;
      } else {
        const M = pick("CEN", [F]);
        start(M, [0.6, Y(0.4)], 0.3);
        pass(F, [0.79, Y(0.12)]); control(0.18);
        carry([0.885, Y(0.31)]);
      }
      break;
    }
    case "contropiede": {
      const D = pick("DIF", [F, A ?? -1]);
      const T = 3.2;
      shiftA = (x) => -0.2 * (1 - ease(clamp01(x / T)));
      shiftD = (x) => -0.34 * (1 - ease(clamp01(x / (T * 0.95))));
      start(D, [0.3, Y(0.55)], 0.35);
      const R = A ?? F;
      pass(R, [0.6, Y(0.24 + J())], 0.1); control(0.2);
      carry([0.75, Y(0.3 + J())]);
      if (A != null) { pass(F, [0.855, Y(0.52 + J())]); control(0.12); }
      else carry([0.86, Y(0.43)]);
      break;
    }
    case "tiro_fuori": {
      const D = pick("DIF", [F, A ?? -1]), M = pick("CEN", [F, A ?? -1, D]);
      start(D, [0.48, Y(0.45)], 0.3);
      pass(M, [0.61, Y(0.3 + J())]); control();
      if (A != null) { pass(A, [0.7, Y(0.62 + J())]); control(0.18); pass(F, [0.745, Y(0.48 + J())]); control(0.24); }
      else { pass(F, [0.68, Y(0.42)]); control(0.18); carry([0.755, Y(0.5)]); }
      longShot = true;
      break;
    }
    case "recupero": {
      const j = def.findIndex((s, i) => i > 0 && s.role === "DIF");
      const p0: P = [0.8, Y(0.3 + J())];
      defHold = { j, until: 0.65, p: [p0[0] + 0.014, p0[1]] };
      const R = A ?? F;
      holder = R; cur = p0; t = 0.65;
      segs.push({ t0: 0, t1: 0.65, a: p0, b: p0, h: 0, kind: "hold", owner: null });
      control(0.15);
      if (A != null) { carry([0.83, Y(0.36)]); pass(F, [0.875, Y(0.5 + J())]); control(0.1); }
      else carry([0.87, Y(0.44)]);
      break;
    }
    case "piazzato": {
      special = "corner";
      const flag: P = [0.995, Y(0.012)];
      start(A!, flag, 0.75);
      pass(F, [0.915 + J(0.02), Y(rng.chance(0.4) ? 0.44 : 0.53)], 0.085); control(0.06, true);
      header = true;
      break;
    }
    case "punizione": {
      special = "punizione";
      start(F, [0.765, Y(0.38 + J(0.08))], 0.9);
      curl = true;
      break;
    }
    case "rigore": {
      special = "rigore";
      cur = [0.895, 0.5]; holder = F;
      anc(F, { t0: 0, t1: 0.9, p0: [0.84, 0.47], p1: [0.888, 0.497] });
      segs.push({ t0: 0, t1: 0.9, a: cur, b: cur, h: 0, kind: "hold", owner: null });
      t = 0.9;
      break;
    }
    default: { // fraseggio
      const D = pick("DIF", [F, A ?? -1]), M = pick("CEN", [F, A ?? -1, D]), X = pick(rng.chance(0.5) ? "ATT" : "CEN", [F, A ?? -1, D, M]);
      start(D, [0.47, Y(0.5 + J())], 0.3);
      pass(M, [0.6, Y(0.34 + J())]); control();
      pass(X, [0.71, Y(0.6 + J())]); control(0.18);
      if (A != null) { pass(A, [0.8, Y(0.4 + J())]); control(0.16); pass(F, [0.87, Y(0.52 + J(0.08))]); control(0.12); }
      else { pass(F, [0.79, Y(0.44)]); control(0.16); carry([0.875, Y(0.5)]); }
    }
  }

  // tiro ed esito
  const corner = rng.chance(0.5) ? -1 : 1;
  let gy = 0.5 + corner * (isGoal ? 0.022 + rng.next() * 0.024 : 0.01 + rng.next() * 0.03);
  const tShot = t;
  const shotD = (p: P) => (header ? 0.34 : 0.22) + dist(cur, p) * (longShot || curl ? 0.9 : 0.6);
  const shot = (p: P, h = 0, zEnd?: number, c?: P) => { const d = shotD(p); segs.push({ t0: t, t1: t + d, a: cur, b: p, c, h, zEnd, kind: "shot", owner: holder }); t += d; cur = p; };
  const after = (p: P, d: number, h = 0) => { segs.push({ t0: t, t1: t + d, a: cur, b: p, h, kind: "after", owner: null }); t += d; cur = p; };
  const ctrl = curl ? ([lerp(cur[0], 1, 0.5), cur[1] + (0.5 - cur[1]) * 0.2 - corner * 0.06] as P) : undefined;
  const loft = curl ? 0.045 : header ? 0.01 : longShot ? 0.02 : 0;
  let gkTarget = gy, gkDelay = 0.05, gkReach = 1;
  if (e.type === "gol") {
    shot([1.012, gy], loft, undefined, ctrl);
    after([1.024, gy + (gy - 0.5) * 0.1], 0.35);
    gkReach = 0.55; gkDelay = 0.12;
  } else if (e.type === "parata") {
    gy = 0.5 + corner * (0.015 + rng.next() * 0.025);
    gkTarget = gy;
    shot([0.968, gy], loft, undefined, ctrl);
    after([1.012, gy < 0.5 ? 0.37 : 0.63], 0.5, 0.03);
  } else if (e.type === "palo") {
    const py = gy < 0.5 ? 0.448 : 0.552;
    gkTarget = py; gkReach = 0.7;
    shot([1.0, py], loft, undefined, ctrl);
    after([0.9, py < 0.5 ? 0.33 : 0.67], 0.55, 0.02);
  } else { // fuori
    gkReach = 0.4;
    const over = rng.chance(0.4);
    gkTarget = gy;
    shot(over ? [1.03, gy] : [1.035, gy < 0.5 ? 0.415 : 0.585], loft, over ? 0.07 : undefined, ctrl);
  }
  const tHit = segs[segs.length - 1].kind === "after" ? segs[segs.length - 1].t0 : t;
  const label = CAPTION[schema] ?? "Azione";
  return {
    atk, def, segs, anchors, passes, tShot, tHit, tEnd: t, finisher: F, assister: A,
    shotY: gy, gkTarget, gkDelay, gkReach, shiftA, shiftD, special, defHold,
    caption: label, gkName: rD?.find((p) => p.ruolo === "POR")?.name,
  };
}

/* ---------- posizioni nel tempo ---------- */

export function ballAt(a: Action, t: number): { p: P; z: number; seg: Seg | null } {
  const s = a.segs.find((x) => t >= x.t0 && t <= x.t1) ?? (t < a.segs[0].t0 ? a.segs[0] : null);
  if (!s) { const l = a.segs[a.segs.length - 1]; return { p: l.b, z: l.zEnd ?? 0, seg: null }; }
  const u = s.t1 > s.t0 ? clamp01((t - s.t0) / (s.t1 - s.t0)) : 1;
  const k = s.kind === "pass" ? 1 - Math.pow(1 - u, 1.5) : s.kind === "after" ? 1 - Math.pow(1 - u, 2) : u;
  let p: P;
  if (s.c) { const q = 1 - k; p = [q * q * s.a[0] + 2 * q * k * s.c[0] + k * k * s.b[0], q * q * s.a[1] + 2 * q * k * s.c[1] + k * k * s.b[1]]; }
  else p = [lerp(s.a[0], s.b[0], k), lerp(s.a[1], s.b[1], k)];
  const z = s.h * 4 * u * (1 - u) + (s.zEnd ?? 0) * u;
  return { p, z, seg: s };
}

const OFF: P = [-0.012, 0.004];
export function atkBase(a: Action, i: number, t: number): P {
  const s = a.atk[i];
  if (i === 0) return s.base;
  const b = ballAt(a, Math.max(0, t - 0.2)).p;
  if (a.special === "corner" || a.special === "rigore" || a.special === "punizione") return setPiece(a, "atk", i);
  const x = Math.min(0.9, s.base[0] + a.shiftA(t) + (b[0] - 0.7) * 0.28);
  return [x, lerp(s.base[1], b[1], 0.14)];
}

export function atkPos(a: Action, i: number, t: number): { p: P; jump: number } {
  const an = a.anchors.get(i);
  if (!an) return { p: atkBase(a, i, t), jump: 0 };
  for (const x of an) if (t >= x.t0 && t <= x.t1) {
    const u = x.t1 > x.t0 ? (t - x.t0) / (x.t1 - x.t0) : 1;
    return { p: [lerp(x.p0[0], x.p1[0], u) + OFF[0], lerp(x.p0[1], x.p1[1], u) + OFF[1]], jump: x.jump ? 1 : 0 };
  }
  const next = an.find((x) => x.t0 > t);
  const prev = [...an].reverse().find((x) => x.t1 < t);
  const from = (tt: number): P => {
    if (!prev) return atkBase(a, i, tt);
    // chi ha tirato resta nella zona del tiro (e accompagna l'azione)
    if (i === a.finisher) return [prev.p1[0] + OFF[0] + Math.min(0.025, (tt - prev.t1) * 0.03), prev.p1[1] + OFF[1]];
    const k = ease(clamp01((tt - prev.t1) / 0.9));
    const b = atkBase(a, i, tt);
    return [lerp(prev.p1[0] + OFF[0], b[0], k), lerp(prev.p1[1] + OFF[1], b[1], k)];
  };
  if (next) {
    const run = Math.max(0.45, Math.min(1.7, dist(atkBase(a, i, next.t0), next.p0) * 2.3));
    if (next.t0 - t < run) {
      const f = from(t), k = ease(1 - (next.t0 - t) / run);
      // salto di testa: stacco poco prima di colpire
      const jump = next.jump ? clamp01(1 - (next.t0 - t) / 0.25) : 0;
      return { p: [lerp(f[0], next.p0[0] + OFF[0], k), lerp(f[1], next.p0[1] + OFF[1], k)], jump };
    }
  }
  const p = from(t);
  const jump = prev?.jump ? clamp01(1 - (t - prev.t1) / 0.3) : 0;
  return { p, jump };
}

function setPiece(a: Action, side: "atk" | "def", i: number): P {
  // posizioni fisse e deterministiche per angoli, rigori e punizioni
  const n = side === "atk" ? a.atk.length : a.def.length;
  const k = i / n;
  if (a.special === "rigore") {
    const x = side === "atk" ? 0.82 : 0.835;
    if (i === 0) return side === "atk" ? [0.06, 0.5] : [0.992, 0.5];
    if (side === "atk" && i % 3 === 0) return [0.6, 0.2 + k * 0.6];
    return [x + ((i * 7) % 3) * 0.006, 0.22 + k * 0.56 + (side === "def" ? 0.03 : 0)];
  }
  if (a.special === "corner") {
    if (i === 0) return side === "atk" ? [0.06, 0.5] : [0.975, 0.5];
    if (side === "atk") return i % 4 === 0 ? [0.55, 0.3 + k * 0.4] : i % 4 === 1 ? [0.8, 0.3 + k * 0.4] : [0.885 + ((i * 3) % 4) * 0.012, 0.36 + k * 0.3];
    return i % 5 === 0 ? [0.8, 0.35 + k * 0.3] : [0.9 + ((i * 5) % 4) * 0.014, 0.37 + k * 0.28];
  }
  // punizione: barriera tra palla e porta
  if (i === 0) return side === "atk" ? [0.06, 0.5] : [0.972, 0.5];
  const fb = a.segs[0].a;
  if (side === "def" && i <= 4) {
    const dx = 1 - fb[0], dy = 0.5 - fb[1], L = Math.hypot(dx, dy);
    const c: P = [fb[0] + (dx / L) * 0.07, fb[1] + (dy / L) * 0.07];
    return [c[0] - (dy / L) * (i - 2.5) * 0.016, c[1] + (dx / L) * (i - 2.5) * 0.016 * 1.3];
  }
  if (side === "atk") return i % 3 === 0 ? [0.6, 0.25 + k * 0.5] : [0.87 + ((i * 3) % 3) * 0.015, 0.33 + k * 0.34];
  return [0.9 + ((i * 3) % 3) * 0.015, 0.34 + k * 0.32];
}

export function defPos(a: Action, j: number, t: number, finisherAt: (t: number) => P): { p: P; dive: number; diveY: number } {
  const s = a.def[j];
  const bl = ballAt(a, Math.max(0, t - 0.3)).p;
  if (j === 0) {
    const gx = a.special === "rigore" ? 0.99 : 0.972;
    const follow = (tt: number) => Math.max(0.44, Math.min(0.56, lerp(0.5, ballAt(a, Math.max(0, tt - 0.25)).p[1], 0.5)));
    const y0 = follow(Math.min(t, a.tShot));
    if (t <= a.tShot + a.gkDelay) return { p: [gx, y0], dive: 0, diveY: 0 };
    const u = ease(clamp01((t - a.tShot - a.gkDelay) / 0.3));
    const ty = lerp(y0, a.gkTarget, a.gkReach);
    return { p: [gx - 0.006 * u, lerp(y0, ty, u)], dive: u * (a.gkReach > 0.45 ? 1 : 0.4), diveY: ty < y0 ? -1 : 1 };
  }
  if (a.defHold && j === a.defHold.j && t < a.defHold.until + 0.5) {
    const k = clamp01((t - a.defHold.until) / 0.5);
    return { p: [a.defHold.p[0] + k * 0.03, a.defHold.p[1] - k * 0.02], dive: 0, diveY: 0 };
  }
  let base: P;
  if (a.special) base = setPiece(a, "def", j);
  else base = [Math.min(0.935, s.base[0] + a.shiftD(t) + (bl[0] - 0.75) * 0.3), lerp(s.base[1], bl[1], 0.3)];
  if (a.special === "punizione" && j <= 4) return { p: base, dive: 0, diveY: 0 };
  // pressione sul portatore (il più vicino) e marcatura del finalizzatore
  const press: P = [bl[0] + 0.03, bl[1] + (base[1] - bl[1]) * 0.25];
  const wP = a.special === "rigore" ? 0 : Math.exp(-(dist(base, bl) ** 2) / (2 * 0.075 ** 2)) * 0.85;
  const fp = finisherAt(Math.max(0, t - 0.2));
  const ramp = clamp01(1 - (a.tShot - t) / 1.4);
  const mark: P = [fp[0] + 0.028, fp[1] + (base[1] > fp[1] ? 0.018 : -0.018)];
  const wM = a.special === "rigore" ? 0 : Math.exp(-(dist(base, fp) ** 2) / (2 * 0.09 ** 2)) * 0.8 * ramp;
  const w = wP + wM;
  if (w < 1e-3) return { p: base, dive: 0, diveY: 0 };
  const tgt: P = [(press[0] * wP + mark[0] * wM) / w, (press[1] * wP + mark[1] * wM) / w];
  const k = Math.min(0.9, w);
  return { p: [lerp(base[0], tgt[0], k), lerp(base[1], tgt[1], k)], dive: 0, diveY: 0 };
}
