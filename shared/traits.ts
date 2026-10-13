// Tratti del club: escono dalle ruote speciali e hanno effetti veri nel gioco.
import type { Club } from "./types";

export type TraitId =
  | "pres_mecenate" | "pres_vulcanico" | "pres_tifoso" | "pres_affari"
  | "salv_popolare" | "salv_svende" | "salv_last" | "salv_penal"
  | "bach_trofei" | "bach_80" | "bach_coppa"
  | "riv_derby" | "riv_forte" | "riv_nemesi" | "riv_destino"
  | "paese_stadio" | "paese_dopo" | "paese_sindaco" | "paese_parroco"
  | "curva_coreo" | "curva_trasferta" | "curva_calda" | "curva_gemellata"
  | "panch_miracolo" | "panch_disastro" | "panch_vice"
  | "att_bomber" | "att_tridente" | "att_falso9"
  | "camp_leader" | "camp_bizzoso" | "camp_fragile" | "camp_eterno"
  | "marchio_rigori" | "marchio_derby" | "marchio_punizioni" | "marchio_assist";

export const TRAITS: Record<TraitId, { label: string; icon: string; desc: string }> = {
  pres_mecenate: { label: "Presidente mecenate", icon: "💸", desc: "+5 M€ dopo ogni vittoria" },
  pres_vulcanico: { label: "Presidente vulcanico", icon: "🌋", desc: "Il morale sale e scende il doppio" },
  pres_tifoso: { label: "Presidente-tifoso", icon: "📣", desc: "+1 fattore campo" },
  pres_affari: { label: "Presidente uomo d'affari", icon: "💼", desc: "Mercato scontato del 20%" },
  salv_popolare: { label: "Azionariato popolare", icon: "🤝", desc: "La tifoseria è almeno calda" },
  salv_svende: { label: "Ha svenduto i gioielli", icon: "🏷️", desc: "+40 M€, ma un reparto −3" },
  salv_last: { label: "Salvataggio last minute", icon: "🛟", desc: "+25 M€" },
  salv_penal: { label: "Penalizzazione", icon: "⚖️", desc: "−3 punti in classifica, morale +10" },
  bach_trofei: { label: "Bacheca piena", icon: "🏆", desc: "Morale +5, ma ogni sconfitta pesa di più" },
  bach_80: { label: "Scudetto anni '80", icon: "📼", desc: "Nostalgia: +1 fattore campo" },
  bach_coppa: { label: "Coppa europea in bacheca", icon: "🌍", desc: "Allenatore +2" },
  riv_derby: { label: "Rivale: il derby", icon: "⚔️", desc: "La rivale è il club più vicino" },
  riv_forte: { label: "Rivale: la più forte", icon: "👑", desc: "La rivale è la squadra col voto più alto" },
  riv_nemesi: { label: "Rivale: la nemesi", icon: "😤", desc: "La rivale sarà la prima squadra che ti batte" },
  riv_destino: { label: "Rivale: scelta dal destino", icon: "🎲", desc: "La rivale la sceglie la sorte" },
  paese_stadio: { label: "Tutto il paese allo stadio", icon: "🏘️", desc: "+2 fattore campo" },
  paese_dopo: { label: "Dopolavoristi", icon: "🔧", desc: "Panchina −5, morale +5" },
  paese_sindaco: { label: "Il sindaco presidente", icon: "🎩", desc: "+10 M€" },
  paese_parroco: { label: "Il parroco in panchina", icon: "⛪", desc: "Morale +10, allenatore −3" },
  curva_coreo: { label: "Curva delle coreografie", icon: "🎆", desc: "+1 fattore campo" },
  curva_trasferta: { label: "Trasferte oceaniche", icon: "🚌", desc: "Fattore campo anche in trasferta (+1)" },
  curva_calda: { label: "Curva calda", icon: "🔥", desc: "Rischio campo squalificato dopo una sconfitta in casa" },
  curva_gemellata: { label: "Curva gemellata", icon: "🫂", desc: "Morale +5" },
  panch_miracolo: { label: "Il miracolo della bandiera", icon: "✨", desc: "Allenatore +8" },
  panch_disastro: { label: "Bandiera allo sbando", icon: "🫠", desc: "Allenatore −5" },
  panch_vice: { label: "Vice esperto", icon: "🧓", desc: "Allenatore +10" },
  att_bomber: { label: "Bomber d'area", icon: "🎯", desc: "Segnano soprattutto gli attaccanti" },
  att_tridente: { label: "Tridente", icon: "🔱", desc: "Più gol su cross" },
  att_falso9: { label: "Falso nueve", icon: "🌀", desc: "Più gol e assist dei centrocampisti" },
  camp_leader: { label: "Campione leader", icon: "🦁", desc: "Morale in partita +5" },
  camp_bizzoso: { label: "Campione bizzoso", icon: "😒", desc: "Fuoriclasse +1, ma vuole andare via più spesso" },
  camp_fragile: { label: "Campione fragile", icon: "🩹", desc: "Fuoriclasse +2, ma si infortuna più spesso" },
  camp_eterno: { label: "Campione eterno", icon: "♾️", desc: "Non cala mai, morale +3" },
  marchio_rigori: { label: "Rigorista", icon: "⚪", desc: "Il fuoriclasse tira tutti i rigori" },
  marchio_derby: { label: "Uomo derby", icon: "⚔️", desc: "Fuoriclasse a forza doppia nei derby e contro la rivale" },
  marchio_punizioni: { label: "Specialista punizioni", icon: "🎯", desc: "Segna più spesso su punizione" },
  marchio_assist: { label: "Uomo assist", icon: "🅰️", desc: "Fuoriclasse con assist a peso triplo" },
};

export const has = (c: Pick<Club, "traits"> | null | undefined, t: TraitId) => !!c?.traits?.includes(t);
