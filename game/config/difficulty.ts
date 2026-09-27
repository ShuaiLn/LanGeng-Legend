/**
 * Difficulty is a small modifier profile applied to a level that is authored once, at Normal.
 * Every lever moves the way a player expects: Easy = more moves, lower goals, lower star lines;
 * Hard = fewer moves, higher goals, higher star lines. Scoring, matching, cascades, special-tile
 * generation, the RNG, the board size and the number of characters on the board are NOT touched.
 *
 * The star lines move further than the goals on purpose. An Easy player meets a lower goal with
 * more moves to spare and converts them into bonus, which is worth less than the moves they did not
 * play, so their final score ends up *below* a Normal player's on the same level; with a mild
 * multiplier the Easy stars would then be harder to earn than Normal's. x0.65 keeps every level
 * ordered (Easy >= Normal >= Hard per attempt, see levelBalance.test.ts), and Hard x1.10 keeps the top
 * tier there earnable but rare.
 *
 * All arithmetic is on integers (`n * 6 / 5`, never `n * 1.2`), so no float drift can move a
 * boundary: 20 moves on Easy is exactly 24.
 */

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFAULT_DIFFICULTY: Difficulty = "normal";

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/** Anything unknown (or a repeated query param) becomes Normal. */
export function parseDifficulty(value: unknown): Difficulty {
  const first = Array.isArray(value) ? value[0] : value;
  return isDifficulty(first) ? first : DEFAULT_DIFFICULTY;
}

export interface DifficultyProfile {
  moves: (moves: number) => number;
  /** Score goal target. */
  score: (target: number) => number;
  /** Collect goal count. */
  collect: (count: number) => number;
  /** "Make N special tiles". */
  specials: (count: number) => number;
  /** "Chain of x N". */
  chain: (length: number) => number;
  /** The 2-star and 3-star score lines. */
  stars: (line: number) => number;
}

const roundTo50 = (n: number): number => Math.round(n / 50) * 50;

export const PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    moves: (m) => Math.ceil((m * 6) / 5), // x1.2
    score: (n) => roundTo50((n * 4) / 5), // x0.8
    collect: (n) => Math.max(4, Math.round((n * 4) / 5)), // x0.8
    specials: (n) => Math.max(1, Math.ceil(n / 2)), // x0.5: 2 -> 1, 3 -> 2
    chain: (n) => Math.max(2, n - 1), // 3 -> 2, and a x2 chain stays a x2 chain
    stars: (n) => roundTo50((n * 13) / 20), // x0.65
  },
  normal: {
    moves: (m) => m,
    score: (n) => n,
    collect: (n) => n,
    specials: (n) => n,
    chain: (n) => n,
    stars: (n) => n,
  },
  hard: {
    moves: (m) => Math.floor((m * 23) / 25), // x0.92
    score: (n) => roundTo50((n * 11) / 10), // x1.10
    collect: (n) => Math.round((n * 11) / 10), // x1.10
    specials: (n) => (n >= 3 ? n + 1 : n), // 2 stays 2
    chain: (n) => Math.max(3, n), // 2 -> 3, 3 stays 3
    stars: (n) => roundTo50((n * 11) / 10), // x1.10
  },
};
