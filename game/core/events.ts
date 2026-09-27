import type { Difficulty } from "../config/difficulty";
import type { GoalView } from "./goals";
import type { CellRef, SpecialType } from "./types";

/**
 * One shared, long-lived EventTarget. React pages and the Phaser scene mount and unmount
 * independently of it, so every listener added here MUST be removed by its owner
 * (`onGameEvent` returns the unsubscribe function for exactly that).
 */
export const gameEvents = new EventTarget();

export const GameEvents = {
  SESSION_STARTED: "session-started",
  SCORE_UPDATED: "score-updated",
  COMBO_UPDATED: "combo-updated",
  TIMER_TICK: "timer-tick",
  MOVES_UPDATED: "moves-updated",
  GAME_OVER: "game-over",
  CALLOUT: "callout",
  LEVEL_OBJECTIVE_MET: "level-objective-met",
  CELEBRATION_LOCK_INPUT: "celebration-lock-input",
  CELEBRATION_LEVEL_CLEAR: "celebration-level-clear",
  CELEBRATION_CONVERT: "celebration-convert",
  CELEBRATION_DETONATE: "celebration-detonate",
  CELEBRATION_FINAL_SCORE: "celebration-final-score",
  CELEBRATION_STAR: "celebration-star",
  CELEBRATION_RESULT: "celebration-result",
  NEW_BEST: "new-best",
  RESTART_REQUESTED: "restart-requested",
  NEXT_LEVEL_REQUESTED: "next-level-requested",
  GOAL_PROGRESS: "goal-progress",
  /** React -> scene: freeze the game (the scene owns the actual pause and answers with PAUSE_CHANGED). */
  PAUSE_REQUESTED: "pause-requested",
  RESUME_REQUESTED: "resume-requested",
  /** Scene -> React: the scene really is paused / running again. */
  PAUSE_CHANGED: "pause-changed",
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];

export type PlayMode = "endless" | "level";

export interface LevelResultPayload {
  sessionId: number;
  levelId: string;
  levelNumber: number;
  difficulty: Difficulty;
  /** Stars this run earned (the record keeps the best across runs). */
  stars: number;
  starThresholds: readonly number[];
  finalScore: number;
  /** Best score for this level on this difficulty, after this run. */
  best: number;
  isNewBest: boolean;
  maxCombo: number;
  moveLimit: number;
  bonusMoves: number;
  bonusScore: number;
  /** There is a level after this one (false only for level 20). */
  hasNext: boolean;
  /** This clear raised the shared unlock line, so "next level unlocked" is news. */
  unlockedNext: boolean;
  /** Stars across all 20 levels of this difficulty, after this run. */
  totalStars: number;
}

export type CalloutKind = "score" | "combo" | "meme" | "boom" | "system";

/**
 * Callouts that carry words of the interface (only the reshuffle notice now) ship a key next to their
 * fallback text, and the React layer renders `key ? t(key, { n }) : text`. Verbatim content (scores,
 * the meme phrases including the combo shout, BOOM!) has no key.
 */
export type CalloutKey = "system.reshuffle";

export interface GameEventDetailMap {
  "session-started": {
    sessionId: number;
    mode: PlayMode;
    timeRemaining: number | null;
    movesRemaining: number | null;
    levelId: string | null;
    levelNumber: number | null;
    difficulty: Difficulty | null;
    goals: GoalView[];
    /** A one-line first-attempt hint for the level, when it has one and the player has not cleared it yet. */
    hintKey: string | null;
  };
  "score-updated": { sessionId: number; score: number; delta: number };
  "combo-updated": { sessionId: number; combo: number };
  "timer-tick": { sessionId: number; remaining: number };
  "moves-updated": { sessionId: number; movesRemaining: number };
  "game-over": {
    sessionId: number;
    mode: PlayMode;
    reason: "time-up" | "out-of-moves";
    score: number;
    maxCombo: number;
    levelId: string | null;
    levelNumber: number | null;
    difficulty: Difficulty | null;
    /** How far each goal got (level mode); empty for Endless. */
    goals: GoalView[];
    /** Endless: the saved best after this run. Level: this difficulty's best for the level (0 if none). */
    best: number;
    /** Endless only: this run beat the saved best (and was saved). */
    isNewBest: boolean;
  };
  callout: {
    sessionId: number;
    kind: CalloutKind;
    text: string;
    /** Set when `text` is only a fallback for translated copy. */
    key?: CalloutKey;
    /** The chain length of a combo callout: it scales the pop, and is not part of the text. */
    n?: number;
    x?: number;
    y?: number;
  };
  "level-objective-met": { sessionId: number; levelId: string; score: number; movesRemaining: number };
  "celebration-lock-input": { sessionId: number };
  "celebration-level-clear": { sessionId: number };
  "celebration-convert": { sessionId: number; uid: number; special: SpecialType; cell: CellRef };
  "celebration-detonate": { sessionId: number; uid: number; cell: CellRef; index: number; total: number };
  "celebration-final-score": { sessionId: number; score: number };
  "celebration-star": { sessionId: number; index: number; total: number };
  "celebration-result": LevelResultPayload;
  "new-best": { sessionId: number; levelId: string; score: number };
  "restart-requested": Record<string, never>;
  "next-level-requested": Record<string, never>;
  "goal-progress": { sessionId: number; goals: GoalView[] };
  "pause-requested": Record<string, never>;
  "resume-requested": Record<string, never>;
  "pause-changed": { sessionId: number; paused: boolean };
}

const listenerCounts = new Map<GameEventName, number>();

export function emitGameEvent<K extends GameEventName>(type: K, detail: GameEventDetailMap[K]): void {
  gameEvents.dispatchEvent(new CustomEvent(type, { detail }));
}

/** Subscribes to a game event; call the returned function to unsubscribe (idempotent). */
export function onGameEvent<K extends GameEventName>(
  type: K,
  handler: (detail: GameEventDetailMap[K]) => void
): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<GameEventDetailMap[K]>).detail);
  gameEvents.addEventListener(type, listener);
  listenerCounts.set(type, (listenerCounts.get(type) ?? 0) + 1);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    gameEvents.removeEventListener(type, listener);
    listenerCounts.set(type, (listenerCounts.get(type) ?? 1) - 1);
  };
}

/** Diagnostics: how many live listeners this module has attached (all types, or one). */
export function gameListenerCount(type?: GameEventName): number {
  if (type) return listenerCounts.get(type) ?? 0;
  let total = 0;
  for (const count of listenerCounts.values()) total += count;
  return total;
}

// --- active session ------------------------------------------------------
// Listeners drop events from a session other than the one currently on screen.

let activeSessionId = 0;

export function setActiveSessionId(id: number): void {
  activeSessionId = id;
}

export function getActiveSessionId(): number {
  return activeSessionId;
}
