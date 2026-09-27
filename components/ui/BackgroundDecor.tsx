// Decoration with no JS. Deterministic values (no Math.random) so server and client markup always
// match. Motion is transform-only and switches off under reduced motion.
import FallingTiles from "./FallingTiles";

// left %, size px, top %, float duration s, delay s
const BUBBLES = [
  [8, 260, 6, 22, 0],
  [78, 320, 10, 28, -6],
  [58, 200, 52, 24, -12],
  [-6, 300, 62, 30, -3],
  [88, 240, 74, 26, -9],
  [34, 180, 30, 20, -15],
] as const;

/** The start screen: pale gradient, soft bubbles, and the characters falling gently past them. */
export function MenuBackground() {
  return (
    <div aria-hidden className="bg-menu pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {BUBBLES.map(([left, size, top, duration, delay], i) => (
        <span
          key={`b${i}`}
          className="bg-bubble"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
      <FallingTiles />
    </div>
  );
}

/** In-game: `#F7FAFE` with a faint static dot grid; nothing detailed behind the tiles. */
export function GameBackground() {
  return <div aria-hidden className="bg-game pointer-events-none fixed inset-0 -z-10" />;
}
