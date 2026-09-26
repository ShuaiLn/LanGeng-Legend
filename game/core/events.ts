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
} as const;

export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];

export type PlayMode = "endless" | "level";

export interface LevelResultPayload {
  sessionId: number;
  levelId: string;
  levelName: string;
  stars: number;
  starThresholds: readonly number[];
  finalScore: number;
  best: number;
  isNewBest: boolean;
  maxCombo: number;
  bonusMoves: number;
  bonusScore: number;
}

export type CalloutKind = "score" | "combo" | "meme" | "boom" | "system";

export interface GameEventDetailMap {
  "session-started": {
    sessionId: number;
    mode: PlayMode;
    timeRemaining: number | null;
    movesRemaining: number | null;
    targetScore: number | null;
    levelId: string | null;
    levelName: string | null;
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
    levelName: string | null;
  };
  callout: { sessionId: number; kind: CalloutKind; text: string; x?: number; y?: number };
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
