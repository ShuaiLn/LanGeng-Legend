import type { MatchKind } from "../core/types";

export const BOARD_ROWS = 8;
export const BOARD_COLS = 8;

export const ENDLESS_DURATION_SECONDS = 60;

/** Drag distance (px) past which a pointer gesture counts as a swipe rather than a tap. */
export const SWIPE_THRESHOLD_PX = 20;

// --- scoring -----------------------------------------------------------
export const BASE_TILE_SCORE = 10;
export const TIER_MULTIPLIER: Record<MatchKind, number> = {
  line3: 1,
  line4: 1.5,
  "lt-shape": 1.5,
  line5: 2,
};
/** Bystanders swept up by a special tile score at a flat multiplier. */
export const BYSTANDER_MULTIPLIER = 1;
/** Combo multiplier for pass N of a chain is `1 + COMBO_STEP * N`. */
export const COMBO_STEP = 0.5;

/** A combo chain at or above this length pops a callout. */
export const COMBO_CALLOUT_MIN = 3;

// --- animation timings (ms) ---------------------------------------------
export const ANIMATION = {
  swap: 150,
  clear: 210,
  fallBase: 110,
  fallPerRow: 45,
  specialPop: 240,
  reshuffleFade: 220,
  boardIntro: 420,
} as const;

// --- level-clear celebration beats (ms) ----------------------------------
export interface CelebrationTimings {
  pause: number;
  banner: number;
  convertStagger: number;
  detonateGap: number;
  starGap: number;
  beforeResult: number;
}
export const CELEBRATION_TIMINGS: CelebrationTimings = {
  pause: 350,
  banner: 1700,
  convertStagger: 175,
  detonateGap: 350,
  starGap: 300,
  beforeResult: 700,
};
