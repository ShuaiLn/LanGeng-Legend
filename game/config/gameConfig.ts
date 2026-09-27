import type { MatchKind } from "../core/types";

/** The board is always square. Endless plays on the default; a level chooses its own, up to the cap. */
export const DEFAULT_GRID_SIZE = 8;
export const MAX_GRID_SIZE = 9;

export const ENDLESS_DURATION_SECONDS = 60;
/** The player-chosen tile set for Endless can never drop below this many characters. */
export const ENDLESS_MIN_TILES = 4;

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

/** A combo chain at or above this length pops a combo shout (2 = the first cascade). */
export const COMBO_CALLOUT_MIN = 2;

// --- animation timings (ms) ---------------------------------------------
export const ANIMATION = {
  swap: 150,
  /** A plain clear: flash + pop, then shrink away. */
  clearNormal: 230,
  /** A chained (combo) clear runs a little longer so the gold flash can be read. */
  clearCombo: 270,
  /** Milliseconds of a clear spent flashing / popping before the shrink starts. */
  clearFlash: 70,
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

// --- tile sounds ---------------------------------------------------------
export const AUDIO = {
  /** One clear event plays at most this many sounds (the most-cleared characters), never one per tile. */
  maxSoundsPerClear: 3,
  /** Hard cap on overlapping tile sounds; when a 6th starts the oldest is faded out. */
  maxVoices: 5,
  /** Same character retriggered sooner than this is ignored (an id already playing is restarted). */
  retriggerMs: 150,
  /** Fade applied to a voice that is evicted by the voice cap. */
  evictFadeMs: 80,
  /** Fade applied to a voice that is restarted or replaced (same id, or a new Gallery preview). */
  restartFadeMs: 60,
  /** Headroom of the SFX bus before the compressor, so five stacked clips do not clip. */
  busGain: 0.9,
} as const;
