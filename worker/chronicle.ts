import type { Env } from "./db";

export type MatchSummary = {
  home: string; away: string; hg: number; ag: number; derby: boolean;
  scorers: { team: string; player: string; minute: number }[];
  reds: { team: string; player: string; minute: number }[];
  tactics: [string, string];
};
export type DaySummary = {
  league: string; season: number; matchday: number; total: number; journal: string;
  matches: MatchSummary[];
  events: string[];
  table: { pos: number; name: string; pt: number; owner: string }[];
  final: boolean;
};

const JOURNALS = ["La Gazzetta del Pallone", "Il Corriere della Ruota", "Tuttospin", "Lo Spicchio Sportivo", "Il Giornale del Lunedì"];
export const journalFor = (season: number) => JOURNALS[(season - 1) % JOURNALS.length];

function line(m: MatchSummary) {
  return `${m.home} ${m.hg}-${m.ag} ${m.away}`;
}

export function templateChronicle(d: DaySummary): { title: string; body: string } {
  const sorted = [...d.matches].sort((a, b) => Math.abs(b.hg - b.ag) + b.hg + b.ag - (Math.abs(a.hg - a.ag) + a.hg + a.ag));
  const big = sorted[0];
  const winner = big ? (big.hg > big.ag ? big.home : big.ag > big.hg ? big.away : null) : null;
  const title = d.final
    ? `${d.table[0]?.name ?? ""} campione! Si chiude la stagione ${d.season}`
    : big
      ? winner ? `${winner} fa la voce grossa: ${line(big)}` : `Pari spettacolo: ${line(big)}`
      : `Giornata ${d.matchday}`;
  const parts: string[] = [];
  for (const m of d.matches) {
    const sc = m.scorers.map((s) => `${s.player} ${s.minute}'`).join(", ");
    parts.push(`${line(m)}${m.derby ? " (derby)" : ""}${sc ? ` — ${sc}` : ""}`);
  }
  if (d.events.length) parts.push("Dalle società: " + d.events.join(" "));
  const leader = d.table[0];
  if (leader) parts.push(`In vetta c'è ${leader.name} con ${leader.pt} punti.`);
  return { title, body: parts.join("\n") };
}

export async function aiChronicle(env: Env, d: DaySummary): Promise<{ title: string; body: string; ai: boolean }> {
  const fallback = { ...templateChronicle(d), ai: false };
  if (!env.AI) return fallback;
  const facts = {
    giornale: d.journal,
    campionato: d.league,
    giornata: `${d.matchday} di ${d.total}`,
    ultima_giornata: d.final,
    partite: d.matches.map((m) => ({
      risultato: line(m), derby: m.derby,
      marcatori: m.scorers.map((s) => `${s.player} (${s.team}) ${s.minute}'`),
      espulsi: m.reds.map((s) => `${s.player} (${s.team}) ${s.minute}'`),
      tattiche: { [m.home]: m.tactics[0], [m.away]: m.tactics[1] },
    })),
    notizie_dalle_societa: d.events,
    classifica: d.table.map((r) => `${r.pos}. ${r.name} ${r.pt} pt (presidente ${r.owner})`),
  };
  const system = `Sei il caporedattore di "${d.journal}", un quotidiano sportivo italiano ironico che racconta un campionato di calcio inventato tra amici.
Scrivi la prima pagina della giornata in italiano.
Regole:
- Usa SOLO i fatti forniti: risultati, marcatori, minuti, espulsioni, classifica e notizie. Non inventare gol, punteggi o giocatori.
- Puoi inventare citazioni di allenatori o tifosi purché non cambino i fatti.
- Prima riga: un titolo da prima pagina, senza virgolette e senza la parola "Titolo".
- Poi 4-6 notizie brevi, una per paragrafo, con tono giornalistico e ironico.
- Chiudi con un paragrafo "Voci di corridoio:" con un pettegolezzo vago e innocuo.
- Massimo 250 parole. Niente markdown, niente asterischi, niente elenchi puntati.`;
  try {
    const model = env.AI_MODEL || "@cf/mistralai/mistral-small-3.1-24b-instruct";
    const run = env.AI.run(model as any, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(facts) },
      ],
      max_tokens: 700,
      temperature: 0.8,
    } as any) as Promise<any>;
    const out: any = await Promise.race([run, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 25000))]);
    const text: string = (out?.response ?? out?.result?.response ?? "").toString().replace(/\*+/g, "").trim();
    if (text.length < 80) return fallback;
    const [first, ...rest] = text.split("\n");
    return { title: first.replace(/^titolo:\s*/i, "").trim(), body: rest.join("\n").trim(), ai: true };
  } catch {
    return fallback;
  }
}
