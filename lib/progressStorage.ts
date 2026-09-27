/**
 * Level progress, kept in localStorage (`meme-match:progress:v1`); there are no accounts.
 *
 * Two rules shape everything here:
 *  - Stars and best scores are stored PER DIFFICULTY and level: Easy L8 three stars, Normal L8 two
 *    and Hard L8 one are independent records, and a worse replay never lowers any of them.
 *  - Unlocks are SHARED and never stored: level N is playable once level N-1 has at least one star
 *    on ANY difficulty, so `unlockedUpTo` is derived from the records and cannot drift from them.
 *
 * The pure functions work on a `Progress` value; the store wraps them with persistence and the
 * `useSyncExternalStore` plumbing.
 */
import { DIFFICULTIES, isDifficulty, type Difficulty } from "@/game/config/difficulty";
import { computeStars, isValidLevelNumber, LEVEL_COUNT, resolveLevel } from "@/game/config/levels";
import { getLevelBest } from "./levelBestStorage";
import { browserStorage, createPersistedStore, type StorageLike } from "./persistedStore";

export const PROGRESS_KEY = "meme-match:progress:v1";
/** The id the old single Demo Level stored its best under (`meme-match:level-best:demo-1`). */
export const LEGACY_DEMO_LEVEL_ID = "demo-1";

export interface LevelRecord {
  readonly stars: number;
  readonly best: number;
}

export type DifficultyRecords = Readonly<Record<string, LevelRecord>>;

export interface Progress {
  readonly v: 1;
  /** Only used to mark and focus the "Last played" row on the difficulty screen; never overrides a choice. */
  readonly lastDifficulty: Difficulty | null;
  readonly levels: Readonly<Record<Difficulty, DifficultyRecords>>;
}

export const EMPTY_PROGRESS: Progress = Object.freeze({
  v: 1,
  lastDifficulty: null,
  levels: Object.freeze({ easy: Object.freeze({}), normal: Object.freeze({}), hard: Object.freeze({}) }),
});

export interface VictoryOutcome {
  /** The final score beat this difficulty's previous best for this level. */
  isNewBest: boolean;
  /** Best score for this level on this difficulty after this run. */
  best: number;
  /** Best stars for this level on this difficulty after this run. */
  stars: number;
  /** This clear raised the shared unlock line (so "Level N+1 unlocked" is news). */
  unlockedNext: boolean;
  /** Stars across all 20 levels of this difficulty, after this run. */
  totalStars: number;
  hasNext: boolean;
}

// ---- pure ----------------------------------------------------------------------------------------

export function recordFor(progress: Progress, difficulty: Difficulty, level: number): LevelRecord | null {
  return progress.levels[difficulty][String(level)] ?? null;
}

/** Highest level with at least one star on this difficulty; 0 when none. */
export function highestCleared(progress: Progress, difficulty: Difficulty): number {
  let highest = 0;
  for (const [key, record] of Object.entries(progress.levels[difficulty])) {
    if (record.stars >= 1) highest = Math.max(highest, Number(key));
  }
  return highest;
}

/** The shared unlock line: `min(20, 1 + highest cleared on any difficulty)`. Level 1 is always open. */
export function unlockedUpTo(progress: Progress): number {
  const highest = Math.max(...DIFFICULTIES.map((difficulty) => highestCleared(progress, difficulty)));
  return Math.min(LEVEL_COUNT, 1 + highest);
}

export function isUnlocked(progress: Progress, level: number): boolean {
  return isValidLevelNumber(level) && level <= unlockedUpTo(progress);
}

/** Levels with at least one star on this difficulty. */
export function clearedCount(progress: Progress, difficulty: Difficulty): number {
  return Object.values(progress.levels[difficulty]).filter((record) => record.stars >= 1).length;
}

export function totalStars(progress: Progress, difficulty: Difficulty): number {
  return Object.values(progress.levels[difficulty]).reduce((sum, record) => sum + record.stars, 0);
}

/** Stars across every difficulty (the mode picker's one-line summary). */
export function totalStarsAll(progress: Progress): number {
  return DIFFICULTIES.reduce((sum, difficulty) => sum + totalStars(progress, difficulty), 0);
}

/**
 * The most stars this level has on any difficulty (0 when it has never been cleared): what its cell
 * in the level grid shows. The grid comes before the difficulty is chosen, so no single difficulty's
 * record is "the" record there.
 */
export function bestStarsAcross(progress: Progress, level: number): number {
  return Math.max(0, ...DIFFICULTIES.map((difficulty) => recordFor(progress, difficulty, level)?.stars ?? 0));
}

export function withLastDifficulty(progress: Progress, difficulty: Difficulty): Progress {
  return progress.lastDifficulty === difficulty ? progress : { ...progress, lastDifficulty: difficulty };
}

/** Merges a victory into the records (max of stars and of best, independently) and reports what changed. */
export function applyVictory(
  progress: Progress,
  difficulty: Difficulty,
  level: number,
  score: number,
  stars: number
): { progress: Progress; outcome: VictoryOutcome } {
  const finalScore = Math.max(0, Math.round(score));
  const runStars = Math.min(3, Math.max(1, Math.round(stars))); // a victory is worth at least one star
  const previous = recordFor(progress, difficulty, level);
  const record: LevelRecord = {
    stars: Math.max(previous?.stars ?? 0, runStars),
    best: Math.max(previous?.best ?? 0, finalScore),
  };
  const next: Progress = {
    ...progress,
    lastDifficulty: difficulty,
    levels: { ...progress.levels, [difficulty]: { ...progress.levels[difficulty], [String(level)]: record } },
  };
  return {
    progress: next,
    outcome: {
      isNewBest: finalScore > (previous?.best ?? 0),
      best: record.best,
      stars: record.stars,
      unlockedNext: unlockedUpTo(next) > unlockedUpTo(progress),
      totalStars: totalStars(next, difficulty),
      hasNext: level < LEVEL_COUNT,
    },
  };
}

function parseRecord(value: unknown): LevelRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const { stars, best } = value as Record<string, unknown>;
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 0 || stars > 3) return null;
  if (typeof best !== "number" || !Number.isFinite(best) || best < 0) return null;
  return { stars, best: Math.round(best) };
}

/** Corrupt, partial or foreign JSON never throws: whatever cannot be trusted is dropped. */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return EMPTY_PROGRESS;
    const record = data as Record<string, unknown>;
    if (record.v !== 1) return EMPTY_PROGRESS;

    const levels = {} as Record<Difficulty, DifficultyRecords>;
    for (const difficulty of DIFFICULTIES) {
      const table: Record<string, LevelRecord> = {};
      const stored = (record.levels as Record<string, unknown> | undefined)?.[difficulty];
      if (typeof stored === "object" && stored !== null) {
        for (const [key, value] of Object.entries(stored)) {
          const parsed = parseRecord(value);
          if (parsed && /^\d+$/.test(key) && isValidLevelNumber(Number(key))) table[String(Number(key))] = parsed;
        }
      }
      levels[difficulty] = table;
    }
    return { v: 1, lastDifficulty: isDifficulty(record.lastDifficulty) ? record.lastDifficulty : null, levels };
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** The old Demo Level was Level 1 at today's Normal numbers: seed that record from its lone best score. */
export function progressFromLegacyBest(best: number): Progress {
  if (!(best > 0)) return EMPTY_PROGRESS;
  const { starThresholds } = resolveLevel(1, "normal");
  const stars = Math.max(1, computeStars(best, starThresholds));
  return { ...EMPTY_PROGRESS, levels: { ...EMPTY_PROGRESS.levels, normal: { "1": { stars, best: Math.round(best) } } } };
}

// ---- store ---------------------------------------------------------------------------------------

export interface ProgressStore {
  get(): Progress;
  subscribe(listener: () => void): () => void;
  recordLevel(difficulty: Difficulty, level: number, score: number, stars: number): VictoryOutcome;
  setLastDifficulty(difficulty: Difficulty): void;
}

/**
 * `legacyBest` reads the single best score the pre-levels game stored. It is imported exactly once,
 * only while `progress:v1` does not exist yet, and the old key is left untouched (nothing is lost).
 */
export function createProgressStore(
  getStorage: () => StorageLike | null,
  legacyBest: () => number = () => 0
): ProgressStore {
  const store = createPersistedStore<Progress>({
    key: PROGRESS_KEY,
    getStorage,
    load(raw) {
      if (raw === null) {
        const seeded = progressFromLegacyBest(legacyBest());
        return { value: seeded, migrated: seeded !== EMPTY_PROGRESS };
      }
      return { value: parseProgress(raw) };
    },
    serialize: (value) => JSON.stringify(value),
  });

  return {
    get: store.get,
    subscribe: store.subscribe,
    recordLevel(difficulty, level, score, stars) {
      const { progress, outcome } = applyVictory(store.get(), difficulty, level, score, stars);
      store.set(progress);
      return outcome;
    },
    setLastDifficulty(difficulty) {
      const current = store.get();
      const next = withLastDifficulty(current, difficulty);
      if (next !== current) store.set(next);
    },
  };
}

const defaultStore = createProgressStore(browserStorage, () => getLevelBest(LEGACY_DEMO_LEVEL_ID));

export const getProgress = defaultStore.get;
export const getServerProgress = (): Progress => EMPTY_PROGRESS;
export const subscribeProgress = defaultStore.subscribe;
export const recordLevel = defaultStore.recordLevel;
export const setLastDifficulty = defaultStore.setLastDifficulty;
