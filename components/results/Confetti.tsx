// One small CSS-only burst: ~24 pieces, sky blue / white / gold, ~1.2s, a single run. Deterministic
// table (no Math.random) so it renders the same everywhere; hidden under reduced motion.

const COLORS = ["#2E8FEA", "#7DBAF5", "#B8DBFC", "#FFFFFF", "#FFC933"] as const;

interface Piece {
  left: number; // %
  delay: number; // ms
  drift: number; // px
  spin: number; // deg
  color: string;
  w: number;
  h: number;
}

const PIECES: Piece[] = Array.from({ length: 24 }, (_, i) => {
  // a small LCG-free spread: golden-ratio steps cover the width evenly
  const t = (i * 0.61803398875) % 1;
  const u = (i * 0.7548776662) % 1;
  return {
    left: 4 + t * 92,
    delay: Math.round(u * 260),
    drift: Math.round((t - 0.5) * 120),
    spin: Math.round(180 + u * 540) * (i % 2 === 0 ? 1 : -1),
    color: COLORS[i % COLORS.length],
    w: 7 + (i % 3) * 3,
    h: 10 + ((i + 1) % 3) * 3,
  };
});

export default function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[45] overflow-hidden">
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className="anim-confetti absolute top-0 block rounded-[2px]"
          style={
            {
              left: `${piece.left}%`,
              width: piece.w,
              height: piece.h,
              background: piece.color,
              boxShadow: piece.color === "#FFFFFF" ? "0 0 0 1px #D6E6F7" : undefined,
              animationDelay: `${piece.delay}ms`,
              "--confetti-x": `${piece.drift}px`,
              "--confetti-r": `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
