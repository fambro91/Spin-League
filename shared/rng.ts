// Generatore pseudo-casuale deterministico (sfc32) inizializzato da una stringa.
// Stesso seme = stessa sequenza: serve per partite e replay riproducibili.

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export type Rng = {
  next: () => number; // [0,1)
  int: (min: number, max: number) => number; // inclusivo
  pick: <T>(arr: readonly T[]) => T;
  weighted: <T extends { weight: number }>(arr: readonly T[]) => number; // ritorna indice
  chance: (p: number) => boolean;
  poisson: (lambda: number) => number;
};

export function makeRng(seed: string): Rng {
  const s = xmur3(seed);
  let a = s(), b = s(), c = s(), d = s();
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return rngFrom(next);
}

/** Rng basato su crypto (server) — non riproducibile, per gli spin. */
export function cryptoRng(): Rng {
  const next = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  };
  return rngFrom(next);
}

function rngFrom(next: () => number): Rng {
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (arr) => {
      const total = arr.reduce((s, x) => s + x.weight, 0);
      let r = next() * total;
      for (let i = 0; i < arr.length; i++) {
        r -= arr[i].weight;
        if (r < 0) return i;
      }
      return arr.length - 1;
    },
    chance: (p) => next() < p,
    poisson: (lambda) => {
      if (lambda <= 0) return 0;
      const L = Math.exp(-lambda);
      let k = 0, p = 1;
      do { k++; p *= next(); } while (p > L);
      return k - 1;
    },
  };
  return rng;
}

export function randomToken(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
