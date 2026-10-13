let solo = false;
/** In modalità carriera le chiamate vanno al gioco locale, non al server. */
export function setSolo(v: boolean) { solo = v; }
export const isSolo = () => solo;

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (solo) { const { soloApi } = await import("./solo/runtime"); return soloApi<T>(path, opts); }
  const res = await fetch(`/api/${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "content-type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* vuoto */ }
  if (!res.ok) throw new Error(data?.error ?? `Errore ${res.status}`);
  return data as T;
}

export const store = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* storage non disponibile */ } },
};

export function playerLink(token: string) { return `${location.origin}/#/p/${token}`; }
export function adminLink(token: string) { return `${location.origin}/#/admin/${token}`; }

export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function fmtDate(d: string | null) {
  if (!d) return "";
  const [, m, day] = d.split("-").map(Number);
  const mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  return `${day} ${mesi[m - 1]}`;
}
