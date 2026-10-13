/** Icone a linea in SVG (stile coerente, colore = currentColor). */
type P = { size?: number; className?: string };
const S = ({ size = 22, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{children}</svg>
);

export const IcBall = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5L7 18.5M8 10L3.5 8.5" /></S>;
export const IcShield = (p: P) => <S {...p}><path d="M12 3l8 3v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></S>;
export const IcTrophy = (p: P) => <S {...p}><path d="M8 4h8v5a4 4 0 01-8 0z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 21h8M9 17h6" /></S>;
export const IcCalendar = (p: P) => <S {...p}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2M14 14h2M8 17h2" /></S>;
export const IcNews = (p: P) => <S {...p}><rect x="4" y="4" width="13" height="16" rx="1.5" /><path d="M17 8h3v10a2 2 0 01-2 2M7.5 8h6M7.5 11.5h6M7.5 15h4" /></S>;
export const IcBell = (p: P) => <S {...p}><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 004 0" /></S>;
export const IcBack = (p: P) => <S {...p}><path d="M15 5l-7 7 7 7" /></S>;
export const IcClose = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const IcNext = (p: P) => <S {...p}><path d="M9 5l7 7-7 7" /></S>;
export const IcPlay = (p: P) => <S {...p}><path d="M8 5l11 7-11 7z" fill="currentColor" /></S>;
export const IcPause = (p: P) => <S {...p}><path d="M8 5v14M16 5v14" strokeWidth="3" /></S>;
export const IcBoard = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M3 9h3v6H3M21 9h-3v6h3" /><circle cx="12" cy="12" r="2.5" /></S>;
export const IcCompass = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></S>;
export const IcRotate = (p: P) => <S {...p}><path d="M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></S>;
export const IcChat = (p: P) => <S {...p}><path d="M4 5h16v11H9l-5 4z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" strokeWidth="2.6" /></S>;
export const IcShare = (p: P) => <S {...p}><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></S>;
export const IcCopy = (p: P) => <S {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></S>;
export const IcSend = (p: P) => <S {...p}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></S>;
export const IcSound = (p: P) => <S {...p}><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /></S>;
export const IcMute = (p: P) => <S {...p}><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></S>;
export const IcWarn = (p: P) => <S {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" strokeWidth="2.4" /></S>;
export const IcCheck = (p: P) => <S {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>;
export const IcUsers = (p: P) => <S {...p}><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.7-3 3-4.5 5.5-4.5s4.8 1.5 5.5 4.5" /><circle cx="17" cy="8" r="2.6" /><path d="M16 13.5c2.3 0 4 1.2 4.6 3.7" /></S>;
export const IcGear = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></S>;
export const IcWhistle = (p: P) => <S {...p}><circle cx="9" cy="14" r="5" /><path d="M13 10.5L21 7v4.5l-5 1.2M7 6l1 2M11 5l-.2 2.2" /></S>;
export const IcStar = (p: P) => <S {...p}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z" fill="currentColor" /></S>;
