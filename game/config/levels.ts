import { DEFAULT_DIFFICULTY, PROFILES, type Difficulty } from "./difficulty";

/**
 * What a level asks of the player. A level combines up to three of these and is cleared when ALL are
 * met at the next settle (never mid-animation). All four are pure functions of the resolver's steps,
 * so none of them needs an engine change.
 */
export type Goal =
  | { type: "score"; target: number }
  /** Clear `count` tiles of the character at `activePool[slot]` (a collect target is never the custom tile). */
  | { type: "collect"; slot: 0 | 1 | 2; count: number }
  /** Create `count` special tiles (match 4, an L/T shape or 5). */
  | { type: "specials"; count: number }
  /** Reach a chain of `length` in one move; this is the HUD's `COMBO x N`. */
  | { type: "chain"; length: number };

export type GoalType = Goal["type"];

/** A localized one-line first-attempt hint; the keys live in lib/i18n/messages. */
export type LevelHintKey = `level.hint.${string}`;

/** Side of the square board: 8 or 9 (the engine allows any size; `MAX_GRID_SIZE` is the layout's cap). */
export type GridSize = 8 | 9;

export interface LevelDef {
  number: number;
  chapter: 1 | 2 | 3 | 4;
  /** Side of the square board (the level's own dimension, never the difficulty's). Independent of `poolSize`. */
  gridSize: GridSize;
  /** How many distinct characters share the board (the level's own dimension, never the difficulty's). */
  poolSize: 6 | 7 | 8;
  /** Authored at Normal; other difficulties are derived by `resolveLevel`. */
  moves: number;
  goals: readonly Goal[];
  /** 2-star and 3-star lines at Normal. The 1-star line is "level cleared" (= the score goal, if any). */
  twoStar: number;
  threeStar: number;
  hintKey?: LevelHintKey;
}

/** What a session consumes: one level at one difficulty. */
export interface LevelConfig {
  /** `normal-07`; unique across difficulties. */
  id: string;
  number: number;
  difficulty: Difficulty;
  chapter: number;
  gridSize: number;
  poolSize: number;
  moveLimit: number;
  goals: Goal[];
  /** [1-star, 2-star, 3-star], evaluated against the score AFTER the celebration's bonus phase. */
  starThresholds: [number, number, number];
  hintKey?: LevelHintKey;
}

export const LEVEL_COUNT = 20;

/** Star lines are rounded to this, and each is at least this far above the previous one. */
export const STAR_STEP = 50;

const score = (target: number): Goal => ({ type: "score", target });
const collect = (slot: 0 | 1 | 2, count: number): Goal => ({ type: "collect", slot, count });
const specials = (count: number): Goal => ({ type: "specials", count });
const chain = (length: number): Goal => ({ type: "chain", length });

/**
 * The 20 levels, authored at Normal. The numbers come from simulated play (an objective-aware bot and
 * a random-tapping bot through the real resolver; see game/core/__tests__/levelBalance.test.ts), not
 * from guesses: goal magnitudes and moves were bisected to the intended win rate, and the star lines
 * are generous: 2 stars at the 10th percentile of the bot's winning scores (about 90% of wins earn it,
 * never below one 50-point step over the score goal) and 3 stars at the 40th (about 60% of wins). Use
 * game/core/__tests__/calibrate.test.ts (CALIBRATE=1) to redo any of it. A human playtest pass is
 * still due.
 *
 * Chapters teach one demand each, then combine them: 1 warm-up (match, specials, collect),
 * 2 chains, 3 precision (tight moves), 4 mastery (up to 8 characters, several goals at once). The board
 * is 8x8 or 9x9 per level and the number of characters varies independently of it, so neither one climbs
 * steadily. Blockers and holes are deliberately out of scope: gravity, refill and the reshuffle assume a
 * full square grid.
 */
export const LEVEL_DEFS: readonly LevelDef[] = [
  { number: 1, chapter: 1, gridSize: 8, poolSize: 6, moves: 24, goals: [score(1200)], twoStar: 2250, threeStar: 3050, hintKey: "level.hint.swap" },
  { number: 2, chapter: 1, gridSize: 8, poolSize: 6, moves: 20, goals: [score(1500)], twoStar: 1950, threeStar: 2800 },
  { number: 3, chapter: 1, gridSize: 8, poolSize: 6, moves: 20, goals: [specials(2)], twoStar: 1450, threeStar: 2250, hintKey: "level.hint.specials" },
  { number: 4, chapter: 1, gridSize: 8, poolSize: 7, moves: 18, goals: [score(900)], twoStar: 1150, threeStar: 1900 },
  { number: 5, chapter: 1, gridSize: 9, poolSize: 6, moves: 16, goals: [collect(0, 18)], twoStar: 2000, threeStar: 2950, hintKey: "level.hint.collect" },
  { number: 6, chapter: 2, gridSize: 8, poolSize: 7, moves: 18, goals: [score(950), chain(2)], twoStar: 1100, threeStar: 1850, hintKey: "level.hint.chain" },
  { number: 7, chapter: 2, gridSize: 8, poolSize: 6, moves: 16, goals: [score(1350)], twoStar: 1550, threeStar: 2350 },
  { number: 8, chapter: 2, gridSize: 8, poolSize: 7, moves: 18, goals: [score(900), specials(2)], twoStar: 1300, threeStar: 1950 },
  { number: 9, chapter: 2, gridSize: 9, poolSize: 7, moves: 22, goals: [collect(0, 13), collect(1, 13)], twoStar: 1750, threeStar: 2700 },
  { number: 10, chapter: 2, gridSize: 9, poolSize: 6, moves: 20, goals: [score(2100), chain(3)], twoStar: 2550, threeStar: 3700 },
  { number: 11, chapter: 3, gridSize: 8, poolSize: 7, moves: 15, goals: [score(850)], twoStar: 950, threeStar: 1550 },
  { number: 12, chapter: 3, gridSize: 8, poolSize: 7, moves: 20, goals: [score(1150), specials(2)], twoStar: 1350, threeStar: 2050 },
  { number: 13, chapter: 3, gridSize: 8, poolSize: 6, moves: 16, goals: [collect(0, 20)], twoStar: 1600, threeStar: 2250 },
  { number: 14, chapter: 3, gridSize: 9, poolSize: 7, moves: 20, goals: [score(1400), chain(3)], twoStar: 1600, threeStar: 2350 },
  { number: 15, chapter: 3, gridSize: 8, poolSize: 8, moves: 20, goals: [score(1000)], twoStar: 1050, threeStar: 1400, hintKey: "level.hint.eight" },
  { number: 16, chapter: 4, gridSize: 8, poolSize: 7, moves: 23, goals: [collect(0, 14), collect(1, 14), collect(2, 14)], twoStar: 1500, threeStar: 2100 },
  { number: 17, chapter: 4, gridSize: 9, poolSize: 8, moves: 22, goals: [score(1150), specials(2)], twoStar: 1300, threeStar: 1950 },
  { number: 18, chapter: 4, gridSize: 8, poolSize: 8, moves: 20, goals: [score(1000), chain(3)], twoStar: 1100, threeStar: 1500 },
  { number: 19, chapter: 4, gridSize: 9, poolSize: 7, moves: 20, goals: [collect(0, 15), collect(1, 15), specials(2)], twoStar: 1650, threeStar: 2450 },
  { number: 20, chapter: 4, gridSize: 9, poolSize: 8, moves: 26, goals: [score(1550), specials(2), chain(3)], twoStar: 1700, threeStar: 2200 },
];

export function isValidLevelNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= LEVEL_COUNT;
}

/** `"7"` -> 7; anything that is not a whole level number (or a repeated param) -> `null`. */
export function parseLevelNumber(value: unknown): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== "string" || !/^\d{1,3}$/.test(first)) return null;
  const n = Number(first);
  return isValidLevelNumber(n) ? n : null;
}

export function getLevelDef(number: number): LevelDef {
  const def = LEVEL_DEFS[number - 1];
  if (!def || def.number !== number) throw new RangeError(`no level ${number}`);
  return def;
}

function scaleGoal(goal: Goal, difficulty: Difficulty): Goal {
  const profile = PROFILES[difficulty];
  switch (goal.type) {
    case "score":
      return { type: "score", target: profile.score(goal.target) };
    case "collect":
      return { type: "collect", slot: goal.slot, count: profile.collect(goal.count) };
    case "specials":
      return { type: "specials", count: profile.specials(goal.count) };
    case "chain":
      return { type: "chain", length: profile.chain(goal.length) };
  }
}

/** The one place a level number and a difficulty become something the game can play. */
export function resolveLevel(number: number, difficulty: Difficulty = DEFAULT_DIFFICULTY): LevelConfig {
  return resolveDefinition(getLevelDef(number), difficulty);
}

/** `resolveLevel` for any authored definition: what the balance tooling uses to try a candidate level. */
export function resolveDefinition(def: LevelDef, difficulty: Difficulty = DEFAULT_DIFFICULTY): LevelConfig {
  const number = def.number;
  const profile = PROFILES[difficulty];
  const goals = def.goals.map((goal) => scaleGoal(goal, difficulty));
  const scoreGoal = goals.find((goal) => goal.type === "score");
  // The first star is "cleared": a score goal's target, otherwise 0 (a victory always has >= 1 star).
  const cleared = scoreGoal?.type === "score" ? scoreGoal.target : 0;
  // Each line is at least one step above the one before it, whatever the profile did to the numbers:
  // a lowered goal must not swallow a lowered 2-star line (Easy scales the two by different amounts).
  const twoStar = Math.max(profile.stars(def.twoStar), cleared + STAR_STEP);
  const threeStar = Math.max(profile.stars(def.threeStar), twoStar + STAR_STEP);
  return {
    id: `${difficulty}-${String(number).padStart(2, "0")}`,
    number,
    difficulty,
    chapter: def.chapter,
    gridSize: def.gridSize,
    poolSize: def.poolSize,
    moveLimit: profile.moves(def.moves),
    goals,
    starThresholds: [cleared, twoStar, threeStar],
    hintKey: def.hintKey,
  };
}

/** The score goal's target, or `null` for a level that has none. */
export function scoreGoalTarget(level: Pick<LevelConfig, "goals">): number | null {
  const goal = level.goals.find((g) => g.type === "score");
  return goal?.type === "score" ? goal.target : null;
}

/** Number of stars (0-3) a score earns against a level's thresholds. */
export function computeStars(score: number, thresholds: readonly number[]): number {
  return thresholds.filter((threshold) => score >= threshold).length;
}

/** A cleared level is never worth fewer than one star, whatever the score line says. */
export function starsForVictory(score: number, thresholds: readonly number[]): number {
  return Math.max(1, computeStars(score, thresholds));
}
