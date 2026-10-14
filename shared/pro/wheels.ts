// Ruote della carriera giocatore: nascita del calciatore, fisico, ruolo, stagione.
import type { Wheel } from "../wheels";
import { NATIONS, CLUBS, LEAGUES, type LeagueCode } from "./data";

export type Role = "POR" | "DIF" | "CEN" | "ATT";
const W = (id: string, title: string, question: string, emoji: string, palette: Wheel["palette"], segs: [string, number, any, string?][], special = false): Wheel => ({
  id, title, subtitle: question, question, emoji, palette, special,
  segments: segs.map(([label, weight, data, icon]) => ({ label, weight, data, icon })),
});

export const ROLE_LABEL: Record<Role, string> = { POR: "Portiere", DIF: "Difensore", CEN: "Centrocampista", ATT: "Attaccante" };

export const SUBS: Record<Role, [string, number][]> = {
  POR: [["Classico tra i pali", 60], ["Portiere-libero", 40]],
  DIF: [["Centrale", 45], ["Terzino", 40], ["Libero", 15]],
  CEN: [["Regista", 25], ["Mezzala", 30], ["Trequartista", 25], ["Mediano", 20]],
  ATT: [["Prima punta", 35], ["Falso nove", 15], ["Ala", 35], ["Seconda punta", 15]],
};
export const SPECS: Record<Role, string[]> = {
  POR: ["Para-rigori", "Riflessi", "Uscite alte", "Rilancio"],
  DIF: ["Anticipo", "Gioco aereo", "Spinta sulla fascia", "Leadership"],
  CEN: ["Filtranti", "Tiro da fuori", "Recupero palla", "Inserimenti"],
  ATT: ["Colpo di testa", "Tiro a giro", "Velocità", "Rapace d'area"],
};

export const HEIGHTS: Record<Role, [number, number][]> = {
  POR: [[178, 6], [184, 18], [188, 30], [192, 28], [197, 18]],
  DIF: [[174, 10], [180, 22], [185, 30], [190, 26], [195, 12]],
  CEN: [[168, 14], [174, 28], [179, 32], [184, 18], [190, 8]],
  ATT: [[167, 14], [174, 26], [180, 28], [186, 20], [193, 12]],
};

export const SPEED = ["Lento", "Normale", "Veloce", "Freccia"];
export const STAMINA = ["Fragile", "Normale", "Instancabile"];
export const POWER = ["Leggero", "Normale", "Roccia"];
export const CHARACTERS = ["Professionista", "Leader", "Testa calda", "Genio e sregolatezza", "Uomo spogliatoio"];

export const TALENT: [string, number, number][] = [["Grezzo", 52, 18], ["Discreto", 56, 28], ["Buono", 60, 28], ["Ottimo", 64, 18], ["Predestinato", 68, 8]];
export const POTENTIAL: [string, number, number][] = [["Gregario", 72, 18], ["Buon giocatore", 78, 30], ["Campione", 84, 28], ["Fuoriclasse", 88, 13], ["Leggenda", 93, 5]];

const cm = (h: number) => `${(h / 100).toFixed(2).replace(".", ",")} m`;

/** Costruisce la ruota per l'id richiesto (alcune dipendono dalle scelte già fatte). */
export function proWheel(id: string, ctx: { role?: Role; nation?: string; sub?: string }): Wheel {
  const role = ctx.role ?? "ATT";
  switch (id) {
    case "nazione": return W("nazione", "Nazionalità", "Dove sei nato?", "🌍", "teal", NATIONS.map((n) => [n.name, n.id === "ita" ? 26 : n.id === "ned" ? 6 : n.id === "por" ? 7 : 10, n.id, n.flag]));
    case "ruolo": return W("ruolo", "Ruolo", "In che ruolo giochi?", "👟", "blue", [["Portiere", 10, "POR", "🧤"], ["Difensore", 28, "DIF", "🛡️"], ["Centrocampista", 30, "CEN", "🎯"], ["Attaccante", 32, "ATT", "⚡"]]);
    case "tipo": return W("tipo", `Che ${ROLE_LABEL[role].toLowerCase()} sei?`, "Il tuo modo di stare in campo", "🧩", "purple", SUBS[role].map(([l, w]) => [l, w, l]));
    case "spec": return W("spec", "Specialità", "Qual è il tuo colpo migliore?", "✨", "gold", SPECS[role].map((l) => [l, 25, l]));
    case "piede": return W("piede", "Piede", "Con che piede calci?", "🦶", "teal", [["Destro", 60, "destro"], ["Sinistro", 30, "sinistro"], ["Ambidestro", 10, "ambidestro"]]);
    case "altezza": return W("altezza", "Altezza", "Quanto sei alto?", "📏", "pitch", HEIGHTS[role].map(([h, w]) => [cm(h), w, h]));
    case "velocita": return W("velocita", "Velocità", "Quanto sei veloce?", "💨", "red", [["Lento", 18, 1], ["Normale", 40, 2], ["Veloce", 30, 3], ["Freccia", 12, 4]]);
    case "resistenza": return W("resistenza", "Resistenza", "Quanto regge il tuo fisico?", "🫀", "red", [["Fragile", 20, 1], ["Normale", 55, 2], ["Instancabile", 25, 3]]);
    case "forza": return W("forza", "Forza fisica", "Come stai nei contrasti?", "💪", "blue", [["Leggero", 25, 1], ["Normale", 50, 2], ["Roccia", 25, 3]]);
    case "carattere": return W("carattere", "Carattere", "Che tipo sei nello spogliatoio?", "🧠", "purple", CHARACTERS.map((c, i) => [c, [26, 18, 18, 14, 24][i], c]));
    case "talento": return W("talento", "Talento", "Quanto sei forte oggi, a 17 anni?", "⭐", "gold", TALENT.map(([l, v, w]) => [`${l} · ${v}`, w, v]));
    case "potenziale": return W("potenziale", "Potenziale", "Fin dove puoi arrivare?", "🚀", "gold", POTENTIAL.map(([l, v, w]) => [`${l} · ${v}`, w, v]));
    case "vivaio": {
      const nat = NATIONS.find((n) => n.id === ctx.nation) ?? NATIONS[0];
      const leagues: LeagueCode[] = [nat.league, ...((nat.league + "2") in LEAGUES ? [(nat.league + "2") as LeagueCode] : [])];
      const pool = CLUBS.filter((c) => leagues.includes(c.league));
      return W("vivaio", "Settore giovanile", `In quale vivaio cresci (${nat.name})?`, "🌱", "pitch", pool.map((c) => [c.name, c.strength >= 84 ? 4 : c.strength >= 78 ? 7 : 10, c.id]));
    }
    // ruote speciali (sbloccate da certe combinazioni)
    case "sp_torre": return W("sp_torre", "La torre", "Sei un gigante là davanti: come lo usi?", "🗼", "purple", [["Gol di testa a raffica", 40, "torre_gol"], ["Sponde per i compagni", 35, "torre_sponda"], ["Lento ma decisivo", 25, "torre_lento"]], true);
    case "sp_freccia": return W("sp_freccia", "La freccia", "Sei velocissimo: come la sfrutti?", "⚡", "purple", [["Contropiedista", 40, "freccia_contro"], ["Dribblomane", 35, "freccia_dribbling"], ["Recupero lampo", 25, "freccia_recupero"]], true);
    case "sp_fenomeno": return W("sp_fenomeno", "Il fenomeno", "Tutti parlano di te: come la vivi?", "🌟", "purple", [["Fenomeno precoce", 40, "fen_precoce"], ["Figlio d'arte", 30, "fen_figlio"], ["Sotto i riflettori", 30, "fen_riflettori"]], true);
    case "sp_tascabile": return W("sp_tascabile", "Portiere tascabile", "Non sei altissimo: come compensi?", "🧤", "purple", [["Riflessi felini", 45, "tasc_riflessi"], ["Soffre le uscite", 30, "tasc_uscite"], ["Para-tutto", 25, "tasc_paratutto"]], true);
    case "sp_muro": return W("sp_muro", "Il muro", "Grande, grosso e cattivo: che difensore sei?", "🧱", "purple", [["Insuperabile", 40, "muro_insuperabile"], ["Pericolo sui corner", 35, "muro_corner"], ["Collezionista di gialli", 25, "muro_gialli"]], true);
  }
  throw new Error("Ruota sconosciuta: " + id);
}

export const TRAIT_INFO: Record<string, { label: string; icon: string; desc: string }> = {
  torre_gol: { label: "Torre: gol di testa", icon: "🗼", desc: "Molti più gol di testa" },
  torre_sponda: { label: "Torre: sponde", icon: "🗼", desc: "Più assist per i compagni" },
  torre_lento: { label: "Torre: lento ma decisivo", icon: "🗼", desc: "Pochi gol, ma pesanti (voti più alti)" },
  freccia_contro: { label: "Contropiedista", icon: "⚡", desc: "Più gol in campo aperto" },
  freccia_dribbling: { label: "Dribblomane", icon: "⚡", desc: "Più assist e voti alti, più falli subiti" },
  freccia_recupero: { label: "Recupero lampo", icon: "⚡", desc: "Voti difensivi più alti" },
  fen_precoce: { label: "Fenomeno precoce", icon: "🌟", desc: "Cresci più in fretta da giovane" },
  fen_figlio: { label: "Figlio d'arte", icon: "🌟", desc: "I club ti notano prima" },
  fen_riflettori: { label: "Sotto i riflettori", icon: "🌟", desc: "Voti più estremi: nel bene e nel male" },
  tasc_riflessi: { label: "Riflessi felini", icon: "🧤", desc: "Valutazione +2" },
  tasc_uscite: { label: "Soffre le uscite", icon: "🧤", desc: "Valutazione −2" },
  tasc_paratutto: { label: "Para-tutto", icon: "🧤", desc: "Più rigori parati" },
  muro_insuperabile: { label: "Insuperabile", icon: "🧱", desc: "Valutazione +2" },
  muro_corner: { label: "Pericolo sui corner", icon: "🧱", desc: "Più gol di testa da difensore" },
  muro_gialli: { label: "Collezionista di gialli", icon: "🧱", desc: "Più cartellini, più grinta" },
};

/** Ruote dell'estate. */
export const SUMMER_WHEELS: Record<string, Wheel> = {
  ritiro: W("ritiro", "Ritiro estivo", "Come va la preparazione?", "🏕️", "pitch", [["Condizione perfetta", 25, 2], ["Buona preparazione", 40, 1], ["Qualche acciacco", 25, 0], ["Infortunio in ritiro", 10, -2]]),
};

export function goalWheel(role: Role, sub: string, youth = false): Wheel {
  if (youth) return W("obiettivo", "Obiettivo personale", "Cosa ti chiede il settore giovanile?", "🎯", "blue", [
    ["Esordio in prima squadra", 35, { kind: "pres", n: 1 }],
    [role === "ATT" ? "12 gol in Primavera" : role === "CEN" ? "6 gol in Primavera" : "25 presenze in Primavera", 35, role === "ATT" ? { kind: "ygol", n: 12 } : role === "CEN" ? { kind: "ygol", n: 6 } : { kind: "yapps", n: 25 }],
    ["3 presenze in prima squadra", 30, { kind: "pres", n: 3 }],
  ]);
  const segs: [string, number, any][] = role === "ATT"
    ? [["Segnare 10 gol", 35, { kind: "gol", n: 10 }], ["Segnare 15 gol", 30, { kind: "gol", n: 15 }], ["Voto medio 6,5", 20, { kind: "voto", n: 6.5 }], ["20 presenze", 15, { kind: "pres", n: 20 }]]
    : role === "CEN"
      ? [["8 assist", 30, { kind: "assist", n: 8 }], ["5 gol", 20, { kind: "gol", n: 5 }], ["Voto medio 6,5", 30, { kind: "voto", n: 6.5 }], ["20 presenze", 20, { kind: "pres", n: 20 }]]
      : role === "DIF"
        ? [["Voto medio 6,5", 35, { kind: "voto", n: 6.5 }], ["20 presenze", 35, { kind: "pres", n: 20 }], [sub === "Terzino" ? "5 assist" : "3 gol", 30, sub === "Terzino" ? { kind: "assist", n: 5 } : { kind: "gol", n: 3 }]]
        : [["8 porte inviolate", 40, { kind: "cs", n: 8 }], ["Voto medio 6,5", 35, { kind: "voto", n: 6.5 }], ["20 presenze", 25, { kind: "pres", n: 20 }]];
  return W("obiettivo", "Obiettivo personale", "Su cosa ti giudicheranno quest'anno?", "🎯", "blue", segs);
}

export const TOURNAMENT_WHEEL = (strength: number): Wheel => W("torneo", "Torneo estivo", "Come va la tua nazionale?", "🏆", "gold", [
  ["Campioni!", Math.max(2, strength - 70), "campioni"], ["Finale persa", Math.max(3, strength - 66), "finale"], ["Semifinale", 18, "semi"], ["Quarti", 22, "quarti"], ["Fuori ai gironi", Math.max(8, 90 - strength), "gironi"],
]);
