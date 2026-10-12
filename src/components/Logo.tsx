/** Logo Spin League: scudo con pallone e corona, tutto in SVG. */
export function Logo({ size = 120, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <svg width={size} height={size * (wordmark ? 1.05 : 0.9)} viewBox={wordmark ? "0 0 200 210" : "0 0 200 180"} role="img" aria-label="Spin League">
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd35a" /><stop offset="1" stopColor="#e09a0b" />
        </linearGradient>
        <clipPath id="lg-ball"><circle cx="100" cy="88" r="40" /></clipPath>
      </defs>
      {/* corona */}
      <path d="M72 30 L80 8 L92 24 L100 4 L108 24 L120 8 L128 30 Z" fill="url(#lg-gold)" stroke="#2a1a00" strokeWidth="2.5" strokeLinejoin="round" />
      {/* scudo */}
      <path d="M30 34 H170 V104 C170 148 136 170 100 184 C64 170 30 148 30 104 Z" fill="#0b2e22" stroke="url(#lg-gold)" strokeWidth="7" strokeLinejoin="round" />
      <path d="M44 46 H156 V102 C156 136 130 154 100 166 C70 154 44 136 44 102 Z" fill="#134a37" />
      {/* pallone */}
      <g clipPath="url(#lg-ball)">
        <circle cx="100" cy="88" r="40" fill="#f3f6ee" />
        <polygon points="100,72 115,83 109,100 91,100 85,83" fill="#10241b" />
        <polygon points="100,46 112,50 100,58 88,50" fill="#10241b" />
        <polygon points="138,78 140,95 128,88" fill="#10241b" />
        <polygon points="62,78 72,88 60,95" fill="#10241b" />
        <polygon points="80,124 86,110 96,120 92,130" fill="#10241b" />
        <polygon points="120,124 114,110 104,120 108,130" fill="#10241b" />
        <g stroke="#10241b" strokeWidth="2.2" fill="none">
          <path d="M100 72 V58 M115 83 L128 88 M109 100 L114 110 M91 100 L86 110 M85 83 L72 88" />
        </g>
      </g>
      <circle cx="100" cy="88" r="40" fill="none" stroke="#10241b" strokeWidth="2" />
      {wordmark && (
        <g>
          <path d="M14 138 H186 L176 160 L186 182 H14 L24 160 Z" fill="url(#lg-gold)" stroke="#2a1a00" strokeWidth="2.5" strokeLinejoin="round" />
          <text x="100" y="171" textAnchor="middle" fontFamily="Big Shoulders Display, Impact, sans-serif" fontWeight="900" fontSize="34" fill="#10241b" letterSpacing="1">SPIN LEAGUE</text>
        </g>
      )}
    </svg>
  );
}
