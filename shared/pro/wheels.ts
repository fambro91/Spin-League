// Ruote della carriera giocatore: nascita del calciatore, fisico, ruolo, archetipi, stagione.
import type { Wheel } from "../wheels";
import { NATIONS, NATION_BY_ID, CLUBS, LEAGUES, type LeagueCode } from "./data";

export type Role = "POR" | "DIF" | "CEN" | "ATT";
type Seg = [string, number, any, string?];
const W = (id: string, title: string, question: string, emoji: string, palette: Wheel["palette"], segs: Seg[], special = false): Wheel => ({
  id, title, subtitle: question, question, emoji, palette, special,
  segments: segs.map(([label, weight, data, icon]) => ({ label, weight, data, icon })),
});

export const ROLE_LABEL: Record<Role, string> = { POR: "Portiere", DIF: "Difensore", CEN: "Centrocampista", ATT: "Attaccante" };

/* ---------- ruolo, tipo, specialità ---------- */

export const SUBS: Record<Role, [string, number][]> = {
  POR: [["Classico tra i pali", 30], ["Portiere-libero", 20], ["Portiere acrobatico", 20], ["Comandante della difesa", 15], ["Portiere moderno", 15]],
  DIF: [["Centrale", 26], ["Terzino", 20], ["Terzino offensivo", 14], ["Stopper", 12], ["Libero", 8], ["Braccetto", 10], ["Quinto di fascia", 10]],
  CEN: [["Regista", 14], ["Mezzala", 16], ["Trequartista", 14], ["Mediano", 13], ["Box to box", 14], ["Incursore", 10], ["Esterno di centrocampo", 10], ["Metodista", 9]],
  ATT: [["Prima punta", 18], ["Falso nove", 9], ["Ala", 17], ["Seconda punta", 12], ["Centravanti di manovra", 11], ["Ala invertita", 13], ["Attaccante d'area", 11], ["Punta mobile", 9]],
};
export const SPECS: Record<Role, string[]> = {
  POR: ["Para-rigori", "Riflessi", "Uscite alte", "Rilancio", "Piedi buoni", "Posizionamento", "Uno contro uno", "Comando della difesa"],
  DIF: ["Anticipo", "Gioco aereo", "Spinta sulla fascia", "Leadership", "Marcatura", "Scivolata", "Impostazione", "Cross"],
  CEN: ["Filtranti", "Tiro da fuori", "Recupero palla", "Inserimenti", "Visione di gioco", "Dribbling", "Punizioni", "Lanci lunghi"],
  ATT: ["Colpo di testa", "Tiro a giro", "Velocità", "Rapace d'area", "Dribbling", "Tiro al volo", "Rigori", "Punizioni"],
};

/* ---------- fisico ---------- */

export const HEIGHTS: Record<Role, [number, number][]> = {
  POR: [[176, 3], [180, 6], [183, 12], [186, 18], [189, 22], [192, 18], [195, 12], [198, 6], [201, 3]],
  DIF: [[170, 4], [174, 8], [178, 14], [182, 18], [185, 20], [188, 16], [191, 11], [194, 6], [197, 3]],
  CEN: [[165, 6], [168, 10], [172, 16], [175, 20], [178, 20], [181, 14], [184, 8], [188, 4], [192, 2]],
  ATT: [[165, 6], [169, 10], [173, 15], [177, 18], [180, 18], [184, 14], [188, 10], [192, 6], [196, 3]],
};
export const SPEED = ["Bradipo", "Lento", "Normale", "Veloce", "Rapido", "Fulmine"];
export const STAMINA = ["Fragile", "Delicato", "Normale", "Resistente", "Instancabile"];
export const POWER = ["Leggero", "Esile", "Normale", "Robusto", "Roccia"];
export const CHARACTERS: [string, number, string][] = [
  ["Professionista", 14, "Cresce ancora dopo i 29 anni"], ["Leader", 9, "Rapporto col mister più solido"], ["Testa calda", 10, "Più cartellini, più grinta"],
  ["Genio e sregolatezza", 8, "Voti più estremi"], ["Uomo spogliatoio", 11, "Morale sempre alto"], ["Trascinatore", 8, "Il morale sale con le vittorie"],
  ["Timido", 9, "Rende meno nei momenti caldi"], ["Ribelle", 8, "Rapporti difficili con gli allenatori"], ["Perfezionista", 11, "Cresce più in fretta"], ["Istrionico", 7, "Il pubblico lo ama"],
];
export const TALENT: [string, number, number][] = [
  ["Acerbo", 50, 8], ["Grezzo", 53, 13], ["Discreto", 56, 18], ["Interessante", 58, 18], ["Buono", 60, 17], ["Ottimo", 63, 13], ["Talento puro", 66, 8], ["Predestinato", 69, 5],
];

/* ---------- idoli, agenti, soprannomi, esultanze ---------- */

export const IDOLS: Record<Role, [string, string][]> = {
  ATT: [["Ronaldo il Fenomeno", "idol_dribbling"], ["Van Basten", "idol_volo"], ["Inzaghi", "idol_rapace"], ["Del Piero", "idol_punizioni"], ["Henry", "idol_velocita"], ["Totti", "idol_assist"], ["Batistuta", "idol_potenza"], ["Baggio", "idol_classe"]],
  CEN: [["Pirlo", "idol_assist"], ["Zidane", "idol_classe"], ["Gerrard", "idol_potenza"], ["Gattuso", "idol_grinta"], ["Xavi", "idol_assist"], ["Lampard", "idol_rapace"], ["Iniesta", "idol_dribbling"], ["Matthäus", "idol_longevo"]],
  DIF: [["Maldini", "idol_longevo"], ["Cannavaro", "idol_classe"], ["Nesta", "idol_classe"], ["Sergio Ramos", "idol_grinta"], ["Cafu", "idol_assist"], ["Baresi", "idol_longevo"], ["Beckenbauer", "idol_classe"], ["Chiellini", "idol_grinta"]],
  POR: [["Buffon", "idol_longevo"], ["Casillas", "idol_classe"], ["Neuer", "idol_assist"], ["Zoff", "idol_longevo"], ["Schmeichel", "idol_grinta"], ["Kahn", "idol_grinta"], ["Peruzzi", "idol_classe"], ["Higuita", "idol_dribbling"]],
};
export const AGENTS: [string, number, string][] = [
  ["Lo squalo", 18, "agent_squalo"], ["Amico di famiglia", 22, "agent_famiglia"], ["Il superagente", 12, "agent_super"],
  ["Agente pigro", 15, "agent_pigro"], ["Ex calciatore", 18, "agent_ex"], ["Tuo padre", 15, "agent_padre"],
];
export const NICKNAMES: Record<Role, string[]> = {
  ATT: ["Il Fenomeno", "El Niño", "Il Condor", "La Pantera", "Il Toro", "Il Pendolino", "Bomber", "Il Cobra", "Il Puma", "Magic"],
  CEN: ["Il Professore", "Il Metronomo", "Il Mago", "Il Maestro", "Ringhio", "Il Divino", "Il Principe", "Lo Sceriffo", "Il Motorino", "Il Genio"],
  DIF: ["Il Muro", "Il Capitano", "Il Kaiser", "Il Mastino", "La Roccia", "Il Pendolino", "Il Gladiatore", "Il Granatiere", "Lo Sceriffo", "Il Generale"],
  POR: ["Il Gatto", "Superman", "Saracinesca", "Il Ragno nero", "San", "La Piovra", "Il Muro", "Mani di velluto", "Il Volante", "Il Guardiano"],
};
export const CELEBRATIONS = ["Aeroplanino", "Ciuccio in bocca", "Capriola", "Bacio alla maglia", "Corsa sotto la curva", "Il violino", "Mitraglietta", "Dito sulla bocca", "Cuore con le mani", "In ginocchio sull'erba", "Maglia tolta (giallo!)", "Balletto con i compagni"];

/* ---------- effetti dei tratti ---------- */

export type TraitFx = { g?: number; a?: number; r?: number; ovr?: number; inj?: number; card?: number; grow?: number; age?: number; offers?: number; eff?: number; salary?: number; rel?: number; morale?: number; volatile?: number };
export const TRAIT_INFO: Record<string, { label: string; icon: string; desc: string; fx: TraitFx }> = {
  // archetipi sbloccati
  torre_gol: { label: "Torre: gol di testa", icon: "🗼", desc: "Molti più gol di testa", fx: { g: 0.06 } },
  torre_sponda: { label: "Torre: sponde", icon: "🗼", desc: "Più assist per i compagni", fx: { a: 0.06 } },
  torre_lento: { label: "Torre: lento ma decisivo", icon: "🗼", desc: "Pochi gol, ma pesanti", fx: { r: 0.2 } },
  freccia_contro: { label: "Contropiedista", icon: "⚡", desc: "Più gol in campo aperto", fx: { g: 0.04 } },
  freccia_dribbling: { label: "Dribblomane", icon: "⚡", desc: "Più assist, più falli subiti", fx: { a: 0.05, r: 0.1 } },
  freccia_recupero: { label: "Recupero lampo", icon: "⚡", desc: "Voti difensivi più alti", fx: { r: 0.2 } },
  fen_precoce: { label: "Fenomeno precoce", icon: "🌟", desc: "Cresci più in fretta da giovane", fx: { grow: 1.5 } },
  fen_figlio: { label: "Figlio d'arte", icon: "🌟", desc: "I club ti notano prima", fx: { eff: 2 } },
  fen_riflettori: { label: "Sotto i riflettori", icon: "🌟", desc: "Voti più estremi", fx: { volatile: 0.35 } },
  tasc_riflessi: { label: "Riflessi felini", icon: "🧤", desc: "Valutazione +2", fx: { ovr: 2 } },
  tasc_uscite: { label: "Soffre le uscite", icon: "🧤", desc: "Valutazione −2, ma cresci di più", fx: { ovr: -2, grow: 0.8 } },
  tasc_paratutto: { label: "Para-tutto", icon: "🧤", desc: "Più rigori parati", fx: { r: 0.15 } },
  muro_insuperabile: { label: "Insuperabile", icon: "🧱", desc: "Valutazione +2", fx: { ovr: 2 } },
  muro_corner: { label: "Pericolo sui corner", icon: "🧱", desc: "Più gol di testa", fx: { g: 0.05 } },
  muro_gialli: { label: "Collezionista di gialli", icon: "🧱", desc: "Più cartellini, più grinta", fx: { card: 1.8, r: 0.1 } },
  mago_tunnel: { label: "Tunnel e sombreri", icon: "🎩", desc: "Più assist e applausi", fx: { a: 0.05, r: 0.1 } },
  mago_doppio: { label: "Doppio passo letale", icon: "🎩", desc: "Più gol in dribbling", fx: { g: 0.05 } },
  mago_show: { label: "Showman", icon: "🎩", desc: "Voti estremi, il pubblico ti adora", fx: { volatile: 0.3, morale: 5 } },
  gatto_felino: { label: "Gatto", icon: "🐈", desc: "Valutazione +2", fx: { ovr: 2 } },
  gatto_volo: { label: "Volo plastico", icon: "🐈", desc: "Voti più alti", fx: { r: 0.2 } },
  gatto_rigori: { label: "Para-rigori nato", icon: "🐈", desc: "I rigori sono la tua specialità", fx: { r: 0.1 } },
  bull_recupera: { label: "Recupera tutto", icon: "🦬", desc: "Voti più alti", fx: { r: 0.2 } },
  bull_inserimenti: { label: "Inserimenti devastanti", icon: "🦬", desc: "Più gol da centrocampo", fx: { g: 0.05 } },
  bull_cartellini: { label: "Cartellino facile", icon: "🦬", desc: "Grinta e gialli", fx: { card: 1.8, r: 0.1 } },
  cecchino_punizioni: { label: "Specialista punizioni", icon: "🎯", desc: "Gol su calcio piazzato", fx: { g: 0.04 } },
  cecchino_rigori: { label: "Rigorista infallibile", icon: "🎯", desc: "Tiri tu i rigori", fx: { g: 0.04 } },
  cecchino_bomba: { label: "Bomba da fuori", icon: "🎯", desc: "Gol da lontano", fx: { g: 0.03, r: 0.1 } },
  dieci_fantasista: { label: "Fantasista puro", icon: "🔟", desc: "Più assist, voti più alti", fx: { a: 0.05, r: 0.15 } },
  dieci_incostante: { label: "Genio incostante", icon: "🔟", desc: "Voti estremi", fx: { volatile: 0.4, g: 0.02 } },
  dieci_leader: { label: "Leader tecnico", icon: "🔟", desc: "Rapporto col mister solido", fx: { rel: 10, a: 0.03 } },
  cap_nato: { label: "Capitano nato", icon: "©️", desc: "Rapporto col mister e morale più alti", fx: { rel: 10, morale: 5 } },
  cap_voce: { label: "Voce dello spogliatoio", icon: "©️", desc: "Morale sempre alto", fx: { morale: 10 } },
  cap_bandiera: { label: "Bandiera", icon: "©️", desc: "Pochi trasferimenti, tanto affetto", fx: { offers: -1, rel: 15 } },
  scuola_1: { label: "Scuola", icon: "🏫", desc: "", fx: {} }, scuola_2: { label: "Scuola", icon: "🏫", desc: "", fx: {} }, scuola_3: { label: "Scuola", icon: "🏫", desc: "", fx: {} },
  gigante_testa: { label: "Gigante: imbattibile di testa", icon: "🦒", desc: "Più gol di testa", fx: { g: 0.05 } },
  gigante_piedi: { label: "Gigante: impacciato coi piedi", icon: "🦒", desc: "Valutazione −1, ma cresci di più", fx: { ovr: -1, grow: 0.8 } },
  gigante_torre: { label: "Gigante: torre in area", icon: "🦒", desc: "Più assist di sponda", fx: { a: 0.04 } },
  folletto_baricentro: { label: "Baricentro basso", icon: "🧚", desc: "Dribbling e assist", fx: { a: 0.05 } },
  folletto_inafferrabile: { label: "Inafferrabile", icon: "🧚", desc: "Più gol, meno infortuni", fx: { g: 0.03, inj: 0.8 } },
  folletto_contrasti: { label: "Soffre i contrasti", icon: "🧚", desc: "Valutazione −1, ma voti alti quando gioca", fx: { ovr: -1, r: 0.2 } },
  ambi_oro: { label: "Due piedi d'oro", icon: "🦶", desc: "Valutazione +1", fx: { ovr: 1 } },
  ambi_imprevedibile: { label: "Imprevedibile", icon: "🦶", desc: "Più gol", fx: { g: 0.03 } },
  ambi_cross: { label: "Cross da entrambi i lati", icon: "🦶", desc: "Più assist", fx: { a: 0.05 } },
  cristallo_fragile: { label: "Talento di cristallo", icon: "💎", desc: "Valutazione +2, ma più infortuni", fx: { ovr: 2, inj: 1.8 } },
  cristallo_ossessione: { label: "Ossessione per la preparazione", icon: "💎", desc: "Infortuni sotto controllo", fx: { inj: 0.7 } },
  cristallo_dolore: { label: "Gioca col dolore", icon: "💎", desc: "Rapporto col mister più alto", fx: { rel: 10, inj: 1.2 } },
  // idoli
  idol_dribbling: { label: "Idolo: il dribbling", icon: "🖼️", desc: "Più assist", fx: { a: 0.02 } },
  idol_volo: { label: "Idolo: il gol al volo", icon: "🖼️", desc: "Più gol", fx: { g: 0.02 } },
  idol_rapace: { label: "Idolo: il rapace d'area", icon: "🖼️", desc: "Più gol", fx: { g: 0.02 } },
  idol_punizioni: { label: "Idolo: le punizioni", icon: "🖼️", desc: "Più gol da fermo", fx: { g: 0.015, r: 0.05 } },
  idol_velocita: { label: "Idolo: la velocità", icon: "🖼️", desc: "Più gol in contropiede", fx: { g: 0.015, a: 0.01 } },
  idol_assist: { label: "Idolo: l'ultimo passaggio", icon: "🖼️", desc: "Più assist", fx: { a: 0.025 } },
  idol_potenza: { label: "Idolo: la potenza", icon: "🖼️", desc: "Più gol da fuori", fx: { g: 0.02 } },
  idol_classe: { label: "Idolo: la classe", icon: "🖼️", desc: "Voti più alti", fx: { r: 0.1 } },
  idol_grinta: { label: "Idolo: la grinta", icon: "🖼️", desc: "Voti più alti, più gialli", fx: { r: 0.08, card: 1.3 } },
  idol_longevo: { label: "Idolo: la longevità", icon: "🖼️", desc: "Invecchi più lentamente", fx: { age: 0.6 } },
  // agenti
  agent_squalo: { label: "Agente: lo squalo", icon: "🦈", desc: "Più offerte e ingaggi alti, rapporti tesi", fx: { offers: 1, salary: 1.3, rel: -8 } },
  agent_famiglia: { label: "Agente: amico di famiglia", icon: "🤝", desc: "Poche offerte, tanta serenità", fx: { offers: -1, morale: 8 } },
  agent_super: { label: "Agente: il superagente", icon: "💼", desc: "Le big ti notano prima", fx: { eff: 3, salary: 1.15 } },
  agent_pigro: { label: "Agente: pigro", icon: "😴", desc: "Meno offerte", fx: { offers: -1 } },
  agent_ex: { label: "Agente: ex calciatore", icon: "🧓", desc: "Consigli preziosi: cresci un po' di più", fx: { grow: 0.4 } },
  agent_padre: { label: "Agente: tuo padre", icon: "👨", desc: "Morale alto, ingaggi più bassi", fx: { morale: 10, salary: 0.85 } },
};

/** Scuole calcistiche nazionali: testo dei tre esiti per paese. */
export const SCHOOLS: Record<string, [string, string, TraitFx][]> = {
  bra: [["Joga bonito", "Dribbling e fantasia", { a: 0.04, r: 0.1 }], ["Ginga", "Voti estremi, numeri da circo", { volatile: 0.3, g: 0.02 }], ["Futsal da bambino", "Tecnica sopraffina", { ovr: 1 }]],
  arg: [["Pibe de oro", "Talento e personalità", { g: 0.03, r: 0.1 }], ["Garra charrúa… quasi", "Grinta infinita", { r: 0.1, card: 1.4 }], ["Potrero", "Tecnica di strada", { a: 0.03 }]],
  ita: [["Scuola italiana", "Tattica e marcature", { r: 0.12 }], ["Catenaccio nel sangue", "Difesa prima di tutto", { r: 0.1, inj: 0.9 }], ["Fantasia italiana", "Colpo di genio", { g: 0.02, a: 0.02 }]],
  ned: [["Calcio totale", "Sai fare tutto", { ovr: 1 }], ["Scuola Ajax", "Tecnica e passaggi", { a: 0.03 }], ["Ala olandese", "Uno contro uno", { a: 0.02, g: 0.02 }]],
  esp: [["Tiki-taka", "Possesso e passaggi", { a: 0.04 }], ["La Masia", "Cresci con i migliori", { grow: 0.8 }], ["Furia roja", "Carattere", { r: 0.1 }]],
  eng: [["Box to box inglese", "Corsa e contrasti", { inj: 0.85, r: 0.08 }], ["Kick and rush", "Cross e colpi di testa", { g: 0.03 }], ["Academy moderna", "Preparazione top", { grow: 0.6 }]],
  ger: [["Mentalità tedesca", "Non molli mai", { r: 0.12 }], ["Precisione", "Pochi errori", { r: 0.08, card: 0.8 }], ["Gegenpressing", "Recuperi e ripartenze", { a: 0.03 }]],
  fra: [["Clairefontaine", "Il miglior vivaio d'Europa", { grow: 0.8 }], ["Banlieue", "Talento di strada", { g: 0.02, a: 0.02 }], ["Fisico e tecnica", "Completo", { ovr: 1 }]],
  por: [["Scuola portoghese", "Dribbling e tiro", { g: 0.02, a: 0.02 }], ["Fame di riscatto", "Cresci di più", { grow: 0.6 }], ["Saudade", "Voti estremi", { volatile: 0.25 }]],
  _: [["Orgoglio nazionale", "Sempre al massimo con la nazionale", { r: 0.08 }], ["Emigrato da ragazzo", "Ti adatti a tutto", { grow: 0.5 }], ["Lavoratore instancabile", "Pochi infortuni", { inj: 0.8 }]],
};

/* ---------- ruote ---------- */

const cm = (h: number) => `${(h / 100).toFixed(2).replace(".", ",")} m`;

/** Costruisce la ruota per l'id richiesto (alcune dipendono dalle scelte già fatte). */
export function proWheel(id: string, ctx: { role?: Role; nation?: string; sub?: string }): Wheel {
  const role = ctx.role ?? "ATT";
  switch (id) {
    case "nazione": return W("nazione", "Nazionalità", "Dove sei nato?", "🌍", "teal", NATIONS.map((n) => [n.name, n.weight, n.id, n.flag]));
    case "ruolo": return W("ruolo", "Ruolo", "In che ruolo giochi?", "👟", "blue", [["Portiere", 10, "POR", "🧤"], ["Difensore", 28, "DIF", "🛡️"], ["Centrocampista", 30, "CEN", "🎯"], ["Attaccante", 32, "ATT", "⚡"]]);
    case "tipo": return W("tipo", `Che ${ROLE_LABEL[role].toLowerCase()} sei?`, "Il tuo modo di stare in campo", "🧩", "purple", SUBS[role].map(([l, w]) => [l, w, l]));
    case "spec": return W("spec", "Specialità", "Qual è il tuo colpo migliore?", "✨", "gold", SPECS[role].map((l) => [l, 12, l]));
    case "piede": return W("piede", "Piede", "Con che piede calci?", "🦶", "teal", [["Destro", 60, "destro"], ["Sinistro", 30, "sinistro"], ["Ambidestro", 10, "ambidestro"]]);
    case "altezza": return W("altezza", "Altezza", "Quanto sei alto?", "📏", "pitch", HEIGHTS[role].map(([h, w]) => [cm(h), w, h]));
    case "velocita": return W("velocita", "Velocità", "Quanto sei veloce?", "💨", "red", SPEED.map((l, i) => [l, [6, 14, 30, 26, 16, 8][i], i + 1]));
    case "resistenza": return W("resistenza", "Resistenza", "Quanto regge il tuo fisico?", "🫀", "red", STAMINA.map((l, i) => [l, [10, 18, 40, 22, 10][i], i + 1]));
    case "forza": return W("forza", "Forza fisica", "Come stai nei contrasti?", "💪", "blue", POWER.map((l, i) => [l, [12, 18, 38, 22, 10][i], i + 1]));
    case "carattere": return W("carattere", "Carattere", "Che tipo sei nello spogliatoio?", "🧠", "purple", CHARACTERS.map(([c, w]) => [c, w, c]));
    case "talento": return W("talento", "Talento", "Quanto sei forte oggi, a 17 anni?", "⭐", "gold", TALENT.map(([l, v, w]) => [`${l} · ${v}`, w, v]));
    case "idolo": return W("idolo", "Idolo d'infanzia", "Chi avevi in camera da bambino?", "🖼️", "teal", IDOLS[role].map(([n, t]) => [n, 12, t]));
    case "agente": return W("agente", "Agente", "Chi cura i tuoi interessi?", "💼", "blue", AGENTS.map(([n, w, t]) => [n, w, t]));
    case "soprannome": return W("soprannome", "Soprannome", "Come ti chiameranno i tifosi?", "🏷️", "purple", NICKNAMES[role].map((n) => [n, 10, n]));
    case "esultanza": return W("esultanza", "Esultanza", "Come festeggi un gol?", "🙌", "rainbow", CELEBRATIONS.map((n) => [n, 10, n]));
    case "vivaio": {
      const nat = NATION_BY_ID.get(ctx.nation ?? "ita") ?? NATIONS[0];
      const home = nat.league != null;
      const pool = CLUBS.filter((c) => nat.academies.includes(c.league) && (home || c.strength >= 70));
      return W("vivaio", "Settore giovanile", home ? `In quale vivaio cresci (${nat.name})?` : `Ti nota un'accademia all'estero: dove vai?`, "🌱", "pitch",
        pool.map((c) => [c.name, c.strength >= 84 ? 3 : c.strength >= 78 ? 6 : 10, c.id]));
    }
    // ruote speciali (archetipi)
    case "sp_torre": return W(id, "La torre", "Sei un gigante là davanti: come lo usi?", "🗼", "purple", [["Gol di testa a raffica", 40, "torre_gol"], ["Sponde per i compagni", 35, "torre_sponda"], ["Lento ma decisivo", 25, "torre_lento"]], true);
    case "sp_freccia": return W(id, "La freccia", "Sei velocissimo: come la sfrutti?", "⚡", "purple", [["Contropiedista", 40, "freccia_contro"], ["Dribblomane", 35, "freccia_dribbling"], ["Recupero lampo", 25, "freccia_recupero"]], true);
    case "sp_fenomeno": return W(id, "Il fenomeno", "Tutti parlano di te: come la vivi?", "🌟", "purple", [["Fenomeno precoce", 40, "fen_precoce"], ["Figlio d'arte", 30, "fen_figlio"], ["Sotto i riflettori", 30, "fen_riflettori"]], true);
    case "sp_tascabile": return W(id, "Portiere tascabile", "Non sei altissimo: come compensi?", "🧤", "purple", [["Riflessi felini", 45, "tasc_riflessi"], ["Soffre le uscite", 30, "tasc_uscite"], ["Para-tutto", 25, "tasc_paratutto"]], true);
    case "sp_muro": return W(id, "Il muro", "Grande, grosso e cattivo: che difensore sei?", "🧱", "purple", [["Insuperabile", 40, "muro_insuperabile"], ["Pericolo sui corner", 35, "muro_corner"], ["Collezionista di gialli", 25, "muro_gialli"]], true);
    case "sp_mago": return W(id, "Il mago", "Palla al piede sei uno spettacolo: che numero fai?", "🎩", "purple", [["Tunnel e sombreri", 35, "mago_tunnel"], ["Doppio passo letale", 40, "mago_doppio"], ["Showman", 25, "mago_show"]], true);
    case "sp_gatto": return W(id, "Il gatto", "Riflessi da felino: che portiere diventi?", "🐈", "purple", [["Gatto", 40, "gatto_felino"], ["Volo plastico", 35, "gatto_volo"], ["Para-rigori nato", 25, "gatto_rigori"]], true);
    case "sp_bulldozer": return W(id, "Il bulldozer", "Corri e spingi come un treno: cosa fai meglio?", "🦬", "purple", [["Recupera tutto", 40, "bull_recupera"], ["Inserimenti devastanti", 35, "bull_inserimenti"], ["Cartellino facile", 25, "bull_cartellini"]], true);
    case "sp_cecchino": return W(id, "Il cecchino", "Hai un piede educatissimo: qual è il tuo colpo?", "🎯", "purple", [["Specialista punizioni", 35, "cecchino_punizioni"], ["Rigorista infallibile", 35, "cecchino_rigori"], ["Bomba da fuori", 30, "cecchino_bomba"]], true);
    case "sp_dieci": return W(id, "Il numero 10", "Genio e fantasia: che 10 sei?", "🔟", "purple", [["Fantasista puro", 40, "dieci_fantasista"], ["Genio incostante", 30, "dieci_incostante"], ["Leader tecnico", 30, "dieci_leader"]], true);
    case "sp_capitano": return W(id, "Il capitano", "Sei nato per guidare: che capitano sarai?", "©️", "purple", [["Capitano nato", 40, "cap_nato"], ["Voce dello spogliatoio", 35, "cap_voce"], ["Bandiera", 25, "cap_bandiera"]], true);
    case "sp_scuola": {
      const sc = SCHOOLS[ctx.nation ?? "_"] ?? SCHOOLS._;
      return W(id, "Scuola calcistica", "Cosa ti porti dal calcio del tuo paese?", "🏫", "purple", sc.map(([l], i) => [l, 34, `scuola_${i + 1}`]), true);
    }
    case "sp_gigante": return W(id, "Il gigante", "Sei altissimo: come ti adatti?", "🦒", "purple", [["Imbattibile di testa", 40, "gigante_testa"], ["Impacciato coi piedi", 30, "gigante_piedi"], ["Torre in area", 30, "gigante_torre"]], true);
    case "sp_folletto": return W(id, "Il folletto", "Piccolo e velocissimo: come li fai impazzire?", "🧚", "purple", [["Baricentro basso", 40, "folletto_baricentro"], ["Inafferrabile", 35, "folletto_inafferrabile"], ["Soffre i contrasti", 25, "folletto_contrasti"]], true);
    case "sp_ambidestro": return W(id, "Due piedi", "Usi entrambi i piedi: come lo sfrutti?", "🦶", "purple", [["Due piedi d'oro", 35, "ambi_oro"], ["Imprevedibile", 35, "ambi_imprevedibile"], ["Cross da entrambi i lati", 30, "ambi_cross"]], true);
    case "sp_cristallo": return W(id, "Talento di cristallo", "Talento enorme, fisico delicato: come lo gestisci?", "💎", "purple", [["Talento di cristallo", 35, "cristallo_fragile"], ["Ossessione per la preparazione", 40, "cristallo_ossessione"], ["Gioca col dolore", 25, "cristallo_dolore"]], true);
  }
  throw new Error("Ruota sconosciuta: " + id);
}

/** Ruote speciali sbloccate dalla combinazione di caratteristiche (archetipi). */
export function archetypeUnlocks(d: { role?: Role; sub?: string; spec?: string; foot?: string; height?: number; speed?: number; stamina?: number; power?: number; character?: string; talent?: number; nation?: string }): string[] {
  const out: string[] = [];
  const h = d.height ?? 180, sp = d.speed ?? 3, pw = d.power ?? 3, st = d.stamina ?? 3;
  if (d.role === "ATT" && h >= 188) out.push("sp_torre");
  if (sp >= 5 && (d.role === "ATT" || ["Terzino", "Terzino offensivo", "Quinto di fascia", "Esterno di centrocampo", "Mezzala"].includes(d.sub ?? ""))) out.push("sp_freccia");
  if (d.role === "POR" && h <= 183) out.push("sp_tascabile");
  if (d.role === "POR" && d.spec === "Riflessi" && h > 183) out.push("sp_gatto");
  if (d.role === "DIF" && h >= 188 && pw >= 4) out.push("sp_muro");
  if (d.spec === "Dribbling" && sp >= 4) out.push("sp_mago");
  if (d.role === "CEN" && ["Mediano", "Box to box", "Incursore"].includes(d.sub ?? "") && pw >= 4) out.push("sp_bulldozer");
  if (["Punizioni", "Rigori", "Tiro da fuori", "Tiro a giro"].includes(d.spec ?? "") && d.role !== "POR") out.push("sp_cecchino");
  if (["Trequartista", "Seconda punta", "Falso nove"].includes(d.sub ?? "") && ["Genio e sregolatezza", "Istrionico"].includes(d.character ?? "")) out.push("sp_dieci");
  if (["Leader", "Trascinatore"].includes(d.character ?? "") && d.role !== "ATT") out.push("sp_capitano");
  if (h >= 195 && d.role !== "POR") out.push("sp_gigante");
  if (h <= 169 && sp >= 4) out.push("sp_folletto");
  if (d.foot === "ambidestro" && d.role !== "POR") out.push("sp_ambidestro");
  if (st <= 2 && (d.talent ?? 0) >= 63) out.push("sp_cristallo");
  return out.slice(0, 3); // al massimo tre archetipi
}

/* ---------- ruote dell'estate ---------- */

export const SUMMER_WHEELS: Record<string, Wheel> = {
  ritiro: W("ritiro", "Ritiro estivo", "Come va la preparazione?", "🏕️", "pitch", [
    ["Condizione stratosferica", 8, 3], ["Condizione perfetta", 16, 2], ["Buona preparazione", 26, 1], ["Normale amministrazione", 20, 0],
    ["Qualche acciacco", 12, -1], ["Doppia seduta di troppo", 8, -1], ["Infortunio in ritiro", 7, -2], ["Torni in sovrappeso", 3, -2],
  ]),
};

export function goalWheel(role: Role, sub: string, youth = false): Wheel {
  if (youth) return W("obiettivo", "Obiettivo personale", "Cosa ti chiede il settore giovanile?", "🎯", "blue", [
    ["Esordio in prima squadra", 25, { kind: "pres", n: 1 }],
    ["3 presenze in prima squadra", 18, { kind: "pres", n: 3 }],
    [role === "ATT" ? "12 gol in Primavera" : role === "CEN" ? "6 gol in Primavera" : "25 presenze in Primavera", 22, role === "ATT" ? { kind: "ygol", n: 12 } : role === "CEN" ? { kind: "ygol", n: 6 } : { kind: "yapps", n: 25 }],
    [role === "ATT" ? "20 gol in Primavera" : "30 presenze in Primavera", 12, role === "ATT" ? { kind: "ygol", n: 20 } : { kind: "yapps", n: 30 }],
    ["10 presenze in prima squadra", 8, { kind: "pres", n: 10 }],
    ["Voto medio 6,5", 15, { kind: "voto", n: 6.5 }],
  ]);
  const off = sub === "Terzino" || sub === "Terzino offensivo" || sub === "Quinto di fascia";
  const segs: Seg[] = role === "ATT"
    ? [["Segnare 8 gol", 14, { kind: "gol", n: 8 }], ["Segnare 12 gol", 16, { kind: "gol", n: 12 }], ["Segnare 18 gol", 10, { kind: "gol", n: 18 }], ["Segnare 25 gol", 4, { kind: "gol", n: 25 }],
       ["15 tra gol e assist", 14, { kind: "ga", n: 15 }], ["8 assist", 10, { kind: "assist", n: 8 }], ["Voto medio 6,5", 12, { kind: "voto", n: 6.5 }], ["25 presenze", 12, { kind: "pres", n: 25 }], ["Squadra tra le prime 4", 8, { kind: "pos", n: 4 }]]
    : role === "CEN"
      ? [["6 assist", 14, { kind: "assist", n: 6 }], ["10 assist", 10, { kind: "assist", n: 10 }], ["5 gol", 12, { kind: "gol", n: 5 }], ["12 tra gol e assist", 12, { kind: "ga", n: 12 }],
         ["Voto medio 6,5", 14, { kind: "voto", n: 6.5 }], ["Voto medio 7", 6, { kind: "voto", n: 7 }], ["30 presenze", 12, { kind: "pres", n: 30 }], ["Squadra tra le prime 4", 10, { kind: "pos", n: 4 }], ["Vincere il campionato", 4, { kind: "pos", n: 1 }], ["40 passaggi chiave", 12, { kind: "kp", n: 40 }]]
      : role === "DIF"
        ? [["Voto medio 6,5", 16, { kind: "voto", n: 6.5 }], ["30 presenze", 14, { kind: "pres", n: 30 }], ["10 porte inviolate", 12, { kind: "cs", n: 10 }], [off ? "5 assist" : "3 gol", 14, off ? { kind: "assist", n: 5 } : { kind: "gol", n: 3 }],
           [off ? "8 assist" : "5 gol", 8, off ? { kind: "assist", n: 8 } : { kind: "gol", n: 5 }], ["Voto medio 7", 6, { kind: "voto", n: 7 }], ["Squadra tra le prime 4", 10, { kind: "pos", n: 4 }], ["Meno di 6 gialli", 10, { kind: "maxyellow", n: 5 }], ["Miglior difesa: prime 3", 8, { kind: "pos", n: 3 }], ["120 recuperi", 12, { kind: "rec", n: 120 }]]
        : [["8 porte inviolate", 14, { kind: "cs", n: 8 }], ["12 porte inviolate", 10, { kind: "cs", n: 12 }], ["16 porte inviolate", 4, { kind: "cs", n: 16 }], ["Voto medio 6,5", 16, { kind: "voto", n: 6.5 }],
           ["Voto medio 7", 6, { kind: "voto", n: 7 }], ["30 presenze", 16, { kind: "pres", n: 30 }], ["Squadra tra le prime 4", 10, { kind: "pos", n: 4 }], ["Vincere il campionato", 4, { kind: "pos", n: 1 }], ["90 parate", 12, { kind: "saves", n: 90 }]];
  return W("obiettivo", "Obiettivo personale", "Su cosa ti giudicheranno quest'anno?", "🎯", "blue", segs);
}

export const TOURNAMENT_WHEEL = (strength: number): Wheel => W("torneo", "Torneo estivo", "Come va la tua nazionale?", "🏆", "gold", [
  ["Campioni!", Math.max(2, strength - 70), "campioni"], ["Finale persa", Math.max(3, strength - 66), "finale"], ["Semifinale", 18, "semi"], ["Quarti", 22, "quarti"],
  ["Ottavi", 18, "ottavi"], ["Fuori ai gironi", Math.max(8, 90 - strength), "gironi"],
]);

export const leagueName = (l: LeagueCode) => LEAGUES[l].name;
