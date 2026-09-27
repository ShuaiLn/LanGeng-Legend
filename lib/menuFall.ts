import { createRng, shuffle } from "@/game/core/rng";

/**
 * The main menu's falling characters: "random but controlled". A pure, seeded function, so the server
 * and the client render identical markup (no hydration mismatch) and tests can pin every property.
 *
 *  - one tile per horizontal lane, jittered inside it, so they spread across the width instead of clumping;
 *  - the lanes are handed out in an interleaved order, so ANY prefix (the first 9 on a phone) is spread too;
 *  - characters cycle through a shuffled list, so neighbouring lanes never show the same one;
 *  - delays are negative (each tile starts part-way down its fall), so the screen is populated at first paint.
 */

export interface FallSpec {
  /** Character id: the caller maps it to art. */
  id: string;
  /** Lane 0..count-1, left to right. */
  lane: number;
  /** Left edge, as a percentage of the width (kept inside 0-94 so the tile is never cut off at the right). */
  left: number;
  /** Side of the square, in CSS px. */
  size: number;
  /** Seconds for one fall. */
  duration: number;
  /** Seconds; always <= 0. */
  delay: number;
  /** Degrees of rotation over the fall (positive or negative). */
  rotate: number;
}

export const FALL_LIMITS = {
  size: { min: 46, max: 80 },
  duration: { min: 16, max: 30 },
  rotate: { max: 14 },
  /** The furthest right a tile may start, in percent of the width. */
  leftMax: 94,
} as const;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The order lanes are used in: a step coprime with `count`, near the golden ratio, so prefixes spread. */
export function interleavedLanes(count: number): number[] {
  if (count <= 1) return Array.from({ length: count }, (_, i) => i);
  let step = Math.max(1, Math.round(count * 0.618));
  while (gcd(step, count) !== 1) step++;
  return Array.from({ length: count }, (_, i) => (i * step) % count);
}

export function fallSpecs(count: number, seed: number, ids: readonly string[]): FallSpec[] {
  if (count <= 0 || ids.length === 0) return [];
  const rng = createRng(seed);
  const order = shuffle(ids, rng);
  const between = (min: number, max: number) => min + rng() * (max - min);

  return interleavedLanes(count).map((lane) => {
    const duration = between(FALL_LIMITS.duration.min, FALL_LIMITS.duration.max);
    const sign = rng() < 0.5 ? -1 : 1;
    return {
      // `lane` indexes the character list, so lanes next to each other differ (when there are enough characters)
      id: order[lane % order.length],
      lane,
      left: ((lane + 0.1 + rng() * 0.8) / count) * FALL_LIMITS.leftMax,
      size: Math.round(between(FALL_LIMITS.size.min, FALL_LIMITS.size.max)),
      duration: Math.round(duration * 10) / 10,
      delay: -Math.round(rng() * duration * 10) / 10,
      rotate: sign * Math.round(between(4, FALL_LIMITS.rotate.max)),
    };
  });
}
