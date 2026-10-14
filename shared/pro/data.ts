// Carriera giocatore: campionati e club reali (forza indicativa 60-90).

export type LeagueCode = "ENG" | "ESP" | "ITA" | "GER" | "FRA" | "NED" | "POR" | "ENG2" | "ESP2" | "ITA2" | "GER2" | "FRA2" | "USA" | "SAU" | "BRA" | "ARG";

export type League = { code: LeagueCode; name: string; country: string; flag: string; stars: number; table: boolean };
export type ProClub = { id: string; name: string; league: LeagueCode; strength: number; colors: [string, string] };

export const LEAGUES: Record<LeagueCode, League> = {
  ENG: { code: "ENG", name: "Premier League", country: "Inghilterra", flag: "🏴", stars: 5, table: true },
  ESP: { code: "ESP", name: "LaLiga", country: "Spagna", flag: "🇪🇸", stars: 5, table: true },
  ITA: { code: "ITA", name: "Serie A", country: "Italia", flag: "🇮🇹", stars: 4, table: true },
  GER: { code: "GER", name: "Bundesliga", country: "Germania", flag: "🇩🇪", stars: 4, table: true },
  FRA: { code: "FRA", name: "Ligue 1", country: "Francia", flag: "🇫🇷", stars: 3, table: true },
  NED: { code: "NED", name: "Eredivisie", country: "Olanda", flag: "🇳🇱", stars: 3, table: true },
  POR: { code: "POR", name: "Liga Portugal", country: "Portogallo", flag: "🇵🇹", stars: 3, table: true },
  ENG2: { code: "ENG2", name: "Championship", country: "Inghilterra", flag: "🏴", stars: 2, table: false },
  ESP2: { code: "ESP2", name: "LaLiga 2", country: "Spagna", flag: "🇪🇸", stars: 2, table: false },
  ITA2: { code: "ITA2", name: "Serie B", country: "Italia", flag: "🇮🇹", stars: 2, table: false },
  GER2: { code: "GER2", name: "2. Bundesliga", country: "Germania", flag: "🇩🇪", stars: 2, table: false },
  FRA2: { code: "FRA2", name: "Ligue 2", country: "Francia", flag: "🇫🇷", stars: 2, table: false },
  USA: { code: "USA", name: "MLS", country: "Stati Uniti", flag: "🇺🇸", stars: 2, table: false },
  SAU: { code: "SAU", name: "Saudi Pro League", country: "Arabia Saudita", flag: "🇸🇦", stars: 2, table: false },
  BRA: { code: "BRA", name: "Brasileirão", country: "Brasile", flag: "🇧🇷", stars: 3, table: false },
  ARG: { code: "ARG", name: "Liga Profesional", country: "Argentina", flag: "🇦🇷", stars: 2, table: false },
};

const C = (id: string, name: string, league: LeagueCode, strength: number, a: string, b: string): ProClub => ({ id, name, league, strength, colors: [a, b] });

export const CLUBS: ProClub[] = [
  // Premier League
  C("mci", "Manchester City", "ENG", 88, "#6cabdd", "#1c2c5b"), C("ars", "Arsenal", "ENG", 87, "#ef0107", "#ffffff"), C("liv", "Liverpool", "ENG", 88, "#c8102e", "#f6eb61"),
  C("che", "Chelsea", "ENG", 84, "#034694", "#ffffff"), C("mun", "Manchester United", "ENG", 80, "#da291c", "#fbe122"), C("tot", "Tottenham", "ENG", 80, "#ffffff", "#132257"),
  C("new", "Newcastle", "ENG", 81, "#241f20", "#ffffff"), C("avl", "Aston Villa", "ENG", 79, "#670e36", "#95bfe5"), C("bha", "Brighton", "ENG", 76, "#0057b8", "#ffffff"), C("whu", "West Ham", "ENG", 74, "#7a263a", "#1bb1e7"),
  // LaLiga
  C("rma", "Real Madrid", "ESP", 89, "#ffffff", "#febe10"), C("bar", "Barcellona", "ESP", 87, "#a50044", "#004d98"), C("atm", "Atlético Madrid", "ESP", 84, "#cb3524", "#ffffff"),
  C("ath", "Athletic Club", "ESP", 79, "#ee2523", "#ffffff"), C("rso", "Real Sociedad", "ESP", 77, "#0067b1", "#ffffff"), C("vil", "Villarreal", "ESP", 78, "#ffe667", "#005187"),
  C("bet", "Real Betis", "ESP", 77, "#0bb363", "#ffffff"), C("sev", "Siviglia", "ESP", 75, "#ffffff", "#d81920"), C("val", "Valencia", "ESP", 73, "#ffffff", "#ee3524"), C("gir", "Girona", "ESP", 75, "#cd2534", "#ffffff"),
  // Serie A
  C("int", "Inter", "ITA", 85, "#0068a8", "#000000"), C("nap", "Napoli", "ITA", 83, "#12a0d7", "#ffffff"), C("juv", "Juventus", "ITA", 82, "#ffffff", "#000000"),
  C("mil", "Milan", "ITA", 81, "#fb090b", "#000000"), C("ata", "Atalanta", "ITA", 81, "#1e71b8", "#000000"), C("rom", "Roma", "ITA", 79, "#8e1f2f", "#f0bc42"),
  C("laz", "Lazio", "ITA", 78, "#87d8f7", "#ffffff"), C("fio", "Fiorentina", "ITA", 76, "#482e92", "#ffffff"), C("bol", "Bologna", "ITA", 77, "#1a2f48", "#a21c26"), C("tor", "Torino", "ITA", 73, "#881f19", "#ffffff"),
  // Bundesliga
  C("bay", "Bayern Monaco", "GER", 88, "#dc052d", "#ffffff"), C("lev", "Bayer Leverkusen", "GER", 84, "#e32221", "#000000"), C("bvb", "Borussia Dortmund", "GER", 83, "#fde100", "#000000"),
  C("rbl", "RB Lipsia", "GER", 81, "#ffffff", "#dd0741"), C("vfb", "Stoccarda", "GER", 78, "#ffffff", "#e32219"), C("sge", "Eintracht Francoforte", "GER", 78, "#e1000f", "#000000"),
  C("wob", "Wolfsburg", "GER", 75, "#65b32e", "#ffffff"), C("scf", "Friburgo", "GER", 75, "#000000", "#e2001a"), C("tsg", "Hoffenheim", "GER", 74, "#1961b5", "#ffffff"), C("fcu", "Union Berlino", "GER", 73, "#eb1923", "#ffffff"),
  // Ligue 1
  C("psg", "Paris Saint-Germain", "FRA", 86, "#004170", "#da291c"), C("asm", "Monaco", "FRA", 79, "#e51b22", "#ffffff"), C("om", "Marsiglia", "FRA", 79, "#2faee0", "#ffffff"),
  C("losc", "Lille", "FRA", 78, "#e01e13", "#20325f"), C("ol", "Lione", "FRA", 77, "#ffffff", "#14387f"), C("ogcn", "Nizza", "FRA", 76, "#c4161c", "#000000"),
  C("rcl", "Lens", "FRA", 75, "#ffd700", "#e30613"), C("srfc", "Rennes", "FRA", 75, "#e13327", "#000000"), C("rcsa", "Strasburgo", "FRA", 72, "#0a5ea8", "#ffffff"), C("fcn", "Nantes", "FRA", 70, "#fcd405", "#00954c"),
  // Eredivisie
  C("psv", "PSV", "NED", 79, "#ed1c24", "#ffffff"), C("aja", "Ajax", "NED", 78, "#ffffff", "#d2122e"), C("fey", "Feyenoord", "NED", 78, "#e2001a", "#ffffff"), C("az", "AZ Alkmaar", "NED", 75, "#e3001b", "#ffffff"),
  C("twe", "Twente", "NED", 73, "#e30613", "#ffffff"), C("utr", "Utrecht", "NED", 71, "#ed1c24", "#ffffff"), C("hee", "Heerenveen", "NED", 68, "#0066b3", "#ffffff"), C("spa", "Sparta Rotterdam", "NED", 67, "#e2001a", "#ffffff"),
  // Liga Portugal
  C("ben", "Benfica", "POR", 80, "#e30613", "#ffffff"), C("fcp", "Porto", "POR", 80, "#00428c", "#ffffff"), C("scp", "Sporting CP", "POR", 80, "#008057", "#ffffff"), C("sbr", "Braga", "POR", 76, "#d71920", "#ffffff"),
  C("vsc", "Vitória Guimarães", "POR", 72, "#ffffff", "#000000"), C("fam", "Famalicão", "POR", 69, "#1d3f8f", "#ffffff"), C("rav", "Rio Ave", "POR", 68, "#00843d", "#ffffff"), C("bfc", "Boavista", "POR", 66, "#000000", "#ffffff"),

  // resto dei campionati (squadre di metà e bassa classifica)
  C("cry", "Crystal Palace", "ENG", 75, "#1b458f", "#c4122e"), C("ful", "Fulham", "ENG", 74, "#ffffff", "#000000"), C("bre", "Brentford", "ENG", 74, "#e30613", "#ffffff"),
  C("eve", "Everton", "ENG", 73, "#003399", "#ffffff"), C("wol", "Wolverhampton", "ENG", 72, "#fdb913", "#231f20"), C("bou", "Bournemouth", "ENG", 74, "#da291c", "#000000"),
  C("nfo", "Nottingham Forest", "ENG", 74, "#dd0000", "#ffffff"), C("lee", "Leeds United", "ENG", 71, "#ffffff", "#1d428a"), C("sun", "Sunderland", "ENG", 70, "#eb172b", "#ffffff"), C("bur", "Burnley", "ENG", 69, "#6c1d45", "#99d6ea"),
  C("osa", "Osasuna", "ESP", 72, "#d91a21", "#0a346f"), C("cel", "Celta Vigo", "ESP", 73, "#8ac3ee", "#ffffff"), C("ray", "Rayo Vallecano", "ESP", 72, "#ffffff", "#e53027"),
  C("mll", "Maiorca", "ESP", 71, "#e20613", "#000000"), C("get", "Getafe", "ESP", 71, "#005999", "#ffffff"), C("esp", "Espanyol", "ESP", 70, "#007fc8", "#ffffff"),
  C("ala", "Alavés", "ESP", 70, "#0761af", "#ffffff"), C("elc", "Elche", "ESP", 68, "#ffffff", "#05642c"), C("lev", "Levante", "ESP", 68, "#b4053f", "#004f9f"), C("ovi", "Real Oviedo", "ESP", 67, "#0066b3", "#ffffff"),
  C("com", "Como", "ITA", 75, "#003e7e", "#ffffff"), C("udi", "Udinese", "ITA", 72, "#ffffff", "#000000"), C("gen", "Genoa", "ITA", 71, "#c8102e", "#002f6c"),
  C("cag", "Cagliari", "ITA", 70, "#a6192e", "#002d72"), C("lec", "Lecce", "ITA", 69, "#ffde00", "#d4001c"), C("par", "Parma", "ITA", 70, "#ffde00", "#003da5"),
  C("sas", "Sassuolo", "ITA", 70, "#00a650", "#000000"), C("ver", "Verona", "ITA", 69, "#ffde00", "#002f6c"), C("cre", "Cremonese", "ITA", 68, "#e2001a", "#a6a6a6"), C("pis", "Pisa", "ITA", 68, "#00205b", "#000000"),
  C("m05", "Mainz", "GER", 73, "#c3141e", "#ffffff"), C("bmg", "Borussia Mönchengladbach", "GER", 73, "#ffffff", "#000000"), C("svw", "Werder Brema", "GER", 72, "#1d9053", "#ffffff"),
  C("fca", "Augusta", "GER", 71, "#ba3733", "#46714d"), C("koe", "Colonia", "GER", 70, "#ffffff", "#ed1c24"), C("hsv", "Amburgo", "GER", 70, "#ffffff", "#0a3f86"),
  C("fch", "Heidenheim", "GER", 68, "#e30613", "#003b79"), C("stp", "St. Pauli", "GER", 68, "#5c3c24", "#ffffff"),
  C("sb29", "Brest", "FRA", 72, "#e30613", "#ffffff"), C("tfc", "Tolosa", "FRA", 72, "#5b3a8e", "#ffffff"), C("aja2", "Auxerre", "FRA", 70, "#ffffff", "#004b9b"),
  C("sco", "Angers", "FRA", 68, "#ffffff", "#000000"), C("hac", "Le Havre", "FRA", 68, "#7fc2ec", "#0b2a5c"), C("fcl", "Lorient", "FRA", 68, "#f58220", "#000000"),
  C("pfc", "Paris FC", "FRA", 69, "#002b5c", "#ffffff"), C("fcm2", "Metz", "FRA", 67, "#8a1538", "#ffffff"),
  C("nec", "NEC Nijmegen", "NED", 70, "#e2001a", "#000000"), C("gae", "Go Ahead Eagles", "NED", 69, "#e2001a", "#fde100"), C("for", "Fortuna Sittard", "NED", 67, "#fde100", "#00953b"),
  C("pec", "PEC Zwolle", "NED", 66, "#005ba9", "#ffffff"), C("gro", "Groningen", "NED", 67, "#00a850", "#ffffff"), C("nac", "NAC Breda", "NED", 66, "#fde100", "#000000"),
  C("her", "Heracles", "NED", 65, "#ffffff", "#000000"), C("exc", "Excelsior", "NED", 64, "#e2001a", "#000000"), C("vol", "Volendam", "NED", 64, "#f48120", "#ffffff"), C("tel", "Telstar", "NED", 63, "#ffffff", "#e2001a"),
  C("gil", "Gil Vicente", "POR", 69, "#e2001a", "#ffffff"), C("mor", "Moreirense", "POR", 67, "#00843d", "#ffffff"), C("est", "Estoril", "POR", 68, "#ffde00", "#004b9b"),
  C("cpi", "Casa Pia", "POR", 67, "#ffffff", "#000000"), C("aro", "Arouca", "POR", 66, "#fde100", "#003da5"), C("scl", "Santa Clara", "POR", 67, "#e2001a", "#ffffff"),
  C("ama", "Estrela Amadora", "POR", 65, "#e2001a", "#00843d"), C("nacm", "Nacional", "POR", 65, "#ffffff", "#000000"), C("avs", "AVS", "POR", 64, "#ffde00", "#e2001a"), C("alv", "Alverca", "POR", 63, "#e2001a", "#ffffff"),
  // Seconde divisioni
  C("sam", "Sampdoria", "ITA2", 66, "#1b5faa", "#ffffff"), C("pal", "Palermo", "ITA2", 66, "#f5a9c9", "#000000"), C("bari", "Bari", "ITA2", 64, "#ffffff", "#e30613"),
  C("nor", "Norwich", "ENG2", 67, "#fff200", "#00a650"), C("mid", "Middlesbrough", "ENG2", 67, "#e2001a", "#ffffff"), C("wba", "West Bromwich", "ENG2", 66, "#122f67", "#ffffff"),
  C("zar", "Real Saragozza", "ESP2", 64, "#ffffff", "#1b3d92"), C("spg", "Sporting Gijón", "ESP2", 65, "#e2001a", "#ffffff"), C("mal", "Málaga", "ESP2", 64, "#2a6eb6", "#ffffff"),
  C("s04", "Schalke 04", "GER2", 67, "#004d9d", "#ffffff"), C("bsc", "Hertha Berlino", "GER2", 66, "#004d9e", "#ffffff"), C("fck", "Kaiserslautern", "GER2", 64, "#e2001a", "#ffffff"),
  C("asse", "Saint-Étienne", "FRA2", 66, "#009639", "#ffffff"), C("fcb", "Bordeaux", "FRA2", 63, "#0a1f44", "#ffffff"), C("eag", "Guingamp", "FRA2", 62, "#e2001a", "#000000"),
  // Resto del mondo
  C("mia", "Inter Miami", "USA", 72, "#f7b5cd", "#231f20"), C("lag", "LA Galaxy", "USA", 70, "#00245d", "#ffd200"), C("lafc", "Los Angeles FC", "USA", 70, "#000000", "#c39e6d"),
  C("hil", "Al-Hilal", "SAU", 77, "#005caa", "#ffffff"), C("nas", "Al-Nassr", "SAU", 76, "#ffde00", "#1d4797"), C("itt", "Al-Ittihad", "SAU", 75, "#fdd700", "#000000"),
  C("fla", "Flamengo", "BRA", 76, "#c52613", "#000000"), C("pal2", "Palmeiras", "BRA", 76, "#006437", "#ffffff"), C("spfc", "São Paulo", "BRA", 73, "#ffffff", "#e2001a"),
  C("boca", "Boca Juniors", "ARG", 74, "#103f79", "#f3b229"), C("riv", "River Plate", "ARG", 75, "#ffffff", "#e2001a"), C("rac", "Racing Club", "ARG", 71, "#6cace4", "#ffffff"),
];

export const CLUB_BY_ID = new Map(CLUBS.map((c) => [c.id, c]));
export const clubsOf = (l: LeagueCode) => CLUBS.filter((c) => c.league === l);
export const TABLE_LEAGUES: LeagueCode[] = ["ENG", "ESP", "ITA", "GER", "FRA", "NED", "POR"];

/** Posti in Champions per campionato (dalla classifica della stagione prima). */
export const CL_SPOTS: Partial<Record<LeagueCode, number>> = { ENG: 4, ESP: 4, ITA: 3, GER: 3, FRA: 2, NED: 1, POR: 1 };

export type Conf = "UEFA" | "CONMEBOL" | "CAF" | "AFC" | "CONCACAF";
/** league: campionato di casa (se è nel gioco); academies: dove vanno i ragazzi di quel paese. */
export type Nation = { id: string; name: string; flag: string; league: LeagueCode | null; academies: LeagueCode[]; strength: number; conf: Conf; weight: number };
const N = (id: string, name: string, flag: string, league: LeagueCode | null, academies: LeagueCode[], strength: number, conf: Conf, weight: number): Nation => ({ id, name, flag, league, academies, strength, conf, weight });
export const NATIONS: Nation[] = [
  N("ita", "Italia", "🇮🇹", "ITA", ["ITA", "ITA2"], 76, "UEFA", 18),
  N("esp", "Spagna", "🇪🇸", "ESP", ["ESP", "ESP2"], 81, "UEFA", 8),
  N("eng", "Inghilterra", "🏴", "ENG", ["ENG", "ENG2"], 80, "UEFA", 8),
  N("fra", "Francia", "🇫🇷", "FRA", ["FRA", "FRA2"], 82, "UEFA", 8),
  N("ger", "Germania", "🇩🇪", "GER", ["GER", "GER2"], 78, "UEFA", 7),
  N("bra", "Brasile", "🇧🇷", "BRA", ["BRA"], 80, "CONMEBOL", 7),
  N("arg", "Argentina", "🇦🇷", "ARG", ["ARG"], 81, "CONMEBOL", 6),
  N("por", "Portogallo", "🇵🇹", "POR", ["POR"], 79, "UEFA", 5),
  N("ned", "Olanda", "🇳🇱", "NED", ["NED"], 78, "UEFA", 4),
  N("bel", "Belgio", "🇧🇪", null, ["NED", "FRA"], 77, "UEFA", 3),
  N("cro", "Croazia", "🇭🇷", null, ["GER", "ITA"], 77, "UEFA", 3),
  N("srb", "Serbia", "🇷🇸", null, ["ITA", "POR"], 72, "UEFA", 2),
  N("den", "Danimarca", "🇩🇰", null, ["NED", "GER"], 75, "UEFA", 2),
  N("nor", "Norvegia", "🇳🇴", null, ["NED", "GER"], 74, "UEFA", 2),
  N("swe", "Svezia", "🇸🇪", null, ["NED", "ITA"], 71, "UEFA", 2),
  N("pol", "Polonia", "🇵🇱", null, ["GER", "ITA"], 72, "UEFA", 2),
  N("sui", "Svizzera", "🇨🇭", null, ["GER", "ITA"], 74, "UEFA", 2),
  N("aut", "Austria", "🇦🇹", null, ["GER"], 74, "UEFA", 2),
  N("tur", "Turchia", "🇹🇷", null, ["GER", "NED"], 74, "UEFA", 2),
  N("uru", "Uruguay", "🇺🇾", null, ["ARG", "ESP"], 77, "CONMEBOL", 2),
  N("col", "Colombia", "🇨🇴", null, ["ARG", "POR"], 76, "CONMEBOL", 2),
  N("mex", "Messico", "🇲🇽", null, ["USA", "ESP"], 72, "CONCACAF", 2),
  N("usa", "Stati Uniti", "🇺🇸", "USA", ["USA", "ENG2"], 73, "CONCACAF", 2),
  N("jpn", "Giappone", "🇯🇵", null, ["GER", "NED"], 74, "AFC", 2),
  N("kor", "Corea del Sud", "🇰🇷", null, ["GER", "POR"], 72, "AFC", 2),
  N("mar", "Marocco", "🇲🇦", null, ["FRA", "ESP"], 77, "CAF", 2),
  N("sen", "Senegal", "🇸🇳", null, ["FRA", "FRA2"], 75, "CAF", 2),
  N("nga", "Nigeria", "🇳🇬", null, ["POR", "NED"], 73, "CAF", 2),
  N("civ", "Costa d'Avorio", "🇨🇮", null, ["FRA", "FRA2"], 74, "CAF", 2),
  N("gha", "Ghana", "🇬🇭", null, ["POR", "NED"], 71, "CAF", 1),
];
export const CONF_CUP: Record<Conf, string> = { UEFA: "Europeo", CONMEBOL: "Copa América", CAF: "Coppa d'Africa", AFC: "Coppa d'Asia", CONCACAF: "Gold Cup" };
export const NATION_BY_ID = new Map(NATIONS.map((n) => [n.id, n]));

export const leagueOf = (clubId: string) => LEAGUES[CLUB_BY_ID.get(clubId)!.league];
