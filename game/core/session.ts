import type { CharacterConfig } from "../config/characters";
import type { LevelConfig } from "../config/levels";
import { recordEndlessScore, type EndlessBestResult } from "../../lib/endlessBestStorage";
import { emitGameEvent, GameEvents, setActiveSessionId, type PlayMode } from "./events";
import {
  applyClear,
  applySpecialSpawn,
  createGoals,
  goalsMet,
  goalViews,
  type GoalState,
  type GoalView,
} from "./goals";
import type { ResolutionStep } from "./resolver";
import type { Rng } from "./types";

export type SessionConfig =
  | { mode: "endless"; durationSeconds: number }
  | { mode: "level"; level: LevelConfig };

export type SessionStatus = "playing" | "celebrating" | "ended";

/** What `evaluateSettled` decided; anything but `continue` means input must stay locked. */
export type SettleOutcome = "continue" | "objective-met" | "game-over" | "inactive";

export interface SessionOptions {
  /** Endless: called once, when the clock runs out, with the final score (saves it if it is a best). */
  recordEndlessBest?: (score: number) => EndlessBestResult;
  /** Level: this difficulty's stored best for the level, shown on the defeat card. */
  levelBest?: (level: LevelConfig) => number;
  /** Level: whether the player has already cleared this level (a first-attempt hint is only for a first attempt). */
  levelCleared?: (level: LevelConfig) => boolean;
}

let sessionCounter = 0;

/** A fresh id for every (re)initialised session; used to discard events from stale sessions. */
export function mintSessionId(): number {
  return ++sessionCounter;
}

export class GameSession {
  readonly sessionId = mintSessionId();
  readonly mode: PlayMode;

  score = 0;
  combo = 0;
  maxCombo = 0;
  status: SessionStatus = "playing";

  timeRemaining: number | null;
  movesRemaining: number | null;

  /** Score / moves left at the instant the level objective was met (before any bonus phase). */
  objectiveScore: number | null = null;
  movesAtObjective: number | null = null;

  private readonly goals: GoalState | null;
  private readonly options: SessionOptions;

  constructor(
    readonly config: SessionConfig,
    /** Locked for the whole session: never re-rolled on refill or reshuffle. */
    readonly activePool: readonly CharacterConfig[],
    readonly rng: Rng,
    options: SessionOptions = {}
  ) {
    this.mode = config.mode;
    this.options = options;
    this.timeRemaining = config.mode === "endless" ? config.durationSeconds : null;
    this.movesRemaining = config.mode === "level" ? config.level.moveLimit : null;
    this.goals = config.mode === "level" ? createGoals(config.level.goals, activePool) : null;
  }

  get level(): LevelConfig | null {
    return this.config.mode === "level" ? this.config.level : null;
  }

  /** Progress of every goal right now (empty in Endless). */
  goalViews(): GoalView[] {
    return this.goals ? goalViews(this.goals, { score: this.score, maxCombo: this.maxCombo }) : [];
  }

  private goalsAreMet(): boolean {
    return this.goals !== null && goalsMet(this.goals, { score: this.score, maxCombo: this.maxCombo });
  }

  private emitGoalProgress(): void {
    if (!this.goals) return;
    emitGameEvent(GameEvents.GOAL_PROGRESS, { sessionId: this.sessionId, goals: this.goalViews() });
  }

  start(): void {
    setActiveSessionId(this.sessionId);
    const level = this.level;
    emitGameEvent(GameEvents.SESSION_STARTED, {
      sessionId: this.sessionId,
      mode: this.mode,
      timeRemaining: this.timeRemaining,
      movesRemaining: this.movesRemaining,
      levelId: level?.id ?? null,
      levelNumber: level?.number ?? null,
      difficulty: level?.difficulty ?? null,
      goals: this.goalViews(),
      hintKey: level?.hintKey && !this.options.levelCleared?.(level) ? level.hintKey : null,
    });
  }

  addScore(delta: number): void {
    if (delta === 0) return;
    this.score += delta;
    emitGameEvent(GameEvents.SCORE_UPDATED, { sessionId: this.sessionId, score: this.score, delta });
  }

  /** `comboIndex` is 0 for the pass a player's swap triggered, 1 for the first cascade, ... */
  registerCombo(comboIndex: number): void {
    this.combo = comboIndex + 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    emitGameEvent(GameEvents.COMBO_UPDATED, { sessionId: this.sessionId, combo: this.combo });
  }

  resetCombo(): void {
    if (this.combo === 0) return;
    this.combo = 0;
    emitGameEvent(GameEvents.COMBO_UPDATED, { sessionId: this.sessionId, combo: 0 });
  }

  /**
   * Applies one resolver step to the session as it is played: a clear scores, extends the chain and
   * counts collected tiles; a special spawn counts toward "make specials". Goal progress is emitted
   * once per step, never per tile. The scene calls this while animating (so the HUD ticks live) and
   * a headless bot calls it the same way, so both walk exactly the same code.
   */
  applyStep(step: ResolutionStep): void {
    if (step.type === "clear") {
      this.addScore(step.scoreDelta);
      this.registerCombo(step.comboIndex);
      if (this.goals) {
        applyClear(this.goals, step.cleared);
        this.emitGoalProgress();
      }
    } else if (step.type === "spawnSpecial") {
      if (this.goals && applySpecialSpawn(this.goals)) this.emitGoalProgress();
    }
  }

  /** Called only for swaps that actually triggered a clear. */
  consumeMove(): void {
    if (this.movesRemaining === null) return;
    this.movesRemaining = Math.max(0, this.movesRemaining - 1);
    emitGameEvent(GameEvents.MOVES_UPDATED, {
      sessionId: this.sessionId,
      movesRemaining: this.movesRemaining,
    });
  }

  /** Endless mode: advance the clock one second and return what is left. */
  tickSecond(): number {
    if (this.timeRemaining === null) return 0;
    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    emitGameEvent(GameEvents.TIMER_TICK, { sessionId: this.sessionId, remaining: this.timeRemaining });
    return this.timeRemaining;
  }

  /**
   * Call after every fully settled resolve loop (and when the timer expires while idle).
   * Never fires mid-animation, so the board is never frozen in the middle of a cascade.
   */
  evaluateSettled(): SettleOutcome {
    if (this.status !== "playing") return "inactive";

    if (this.config.mode === "endless") {
      if ((this.timeRemaining ?? 1) > 0) return "continue";
      this.status = "ended";
      // Saved only here, when the run really ends: leaving mid-run (Pause -> Home) is not a result.
      const { best, isNewBest } = (this.options.recordEndlessBest ?? recordEndlessScore)(this.score);
      emitGameEvent(GameEvents.GAME_OVER, {
        sessionId: this.sessionId,
        mode: "endless",
        reason: "time-up",
        score: this.score,
        maxCombo: this.maxCombo,
        levelId: null,
        levelNumber: null,
        difficulty: null,
        goals: [],
        best,
        isNewBest,
      });
      return "game-over";
    }

    const { level } = this.config;
    if (this.goalsAreMet()) {
      // Not final: the celebration's bonus phase still adds score before stars are computed.
      this.status = "celebrating";
      this.objectiveScore = this.score;
      this.movesAtObjective = this.movesRemaining;
      emitGameEvent(GameEvents.LEVEL_OBJECTIVE_MET, {
        sessionId: this.sessionId,
        levelId: level.id,
        score: this.score,
        movesRemaining: this.movesRemaining ?? 0,
      });
      return "objective-met";
    }

    if ((this.movesRemaining ?? 0) <= 0) {
      this.status = "ended";
      emitGameEvent(GameEvents.GAME_OVER, {
        sessionId: this.sessionId,
        mode: "level",
        reason: "out-of-moves",
        score: this.score,
        maxCombo: this.maxCombo,
        levelId: level.id,
        levelNumber: level.number,
        difficulty: level.difficulty,
        goals: this.goalViews(),
        best: this.options.levelBest?.(level) ?? 0,
        isNewBest: false,
      });
      return "game-over";
    }
    return "continue";
  }

  /** The celebration converts leftover moves into bonus specials one at a time. */
  consumeBonusMove(): void {
    this.consumeMove();
  }

  finishCelebration(): void {
    this.status = "ended";
  }
}
