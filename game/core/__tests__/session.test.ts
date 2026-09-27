import { afterEach, describe, expect, it } from "vitest";
import { getActiveSessionId, onGameEvent, GameEvents, gameListenerCount, type GameEventName } from "../events";
import { GameSession } from "../session";
import { createRng } from "../rng";
import { computeStars, resolveLevel, scoreGoalTarget, type Goal, type LevelConfig } from "../../config/levels";
import { getActivePool, CHARACTER_LIBRARY, ACTIVE_POOL_SIZE, CUSTOM_CHARACTER_ID } from "../../config/characters";
import type { ClearStep, SpawnSpecialStep } from "../resolver";

const disposers: (() => void)[] = [];
afterEach(() => {
  while (disposers.length) disposers.pop()!();
});

function record(names: GameEventName[]) {
  const seen: { type: GameEventName; detail: unknown }[] = [];
  for (const type of names) {
    disposers.push(onGameEvent(type, (detail) => seen.push({ type, detail })));
  }
  return seen;
}

const pool = getActivePool(null, createRng(1));
const BASE = resolveLevel(1, "normal");
const TARGET = scoreGoalTarget(BASE)!;
const levelOf = (overrides: Partial<LevelConfig> = {}): LevelConfig => ({ ...BASE, ...overrides });
const withGoals = (goals: Goal[], overrides: Partial<LevelConfig> = {}): LevelConfig =>
  levelOf({ goals, ...overrides });
const noBest = { recordEndlessBest: (score: number) => ({ best: score, isNewBest: true }) };

const clear = (
  comboIndex: number,
  characterIds: string[],
  scoreDelta = 30
): ClearStep => ({
  type: "clear",
  cleared: characterIds.map((characterId, i) => ({
    uid: i,
    cell: { row: 0, col: i },
    characterId,
    special: null,
  })),
  activated: [],
  kinds: ["line3"],
  comboIndex,
  scoreDelta,
});
const spawn: SpawnSpecialStep = { type: "spawnSpecial", uid: 1, cell: { row: 0, col: 0 }, special: "striped-row" };

describe("GameSession ids", () => {
  it("mints a new sessionId per session and marks the newest as active", () => {
    const a = new GameSession({ mode: "endless", durationSeconds: 60 }, pool, createRng(1), noBest);
    const b = new GameSession({ mode: "endless", durationSeconds: 60 }, pool, createRng(1), noBest);
    expect(b.sessionId).toBeGreaterThan(a.sessionId);
    a.start();
    b.start();
    expect(getActiveSessionId()).toBe(b.sessionId);
  });
});

describe("GameSession: endless mode", () => {
  it("counts down, and only ends once evaluateSettled runs after the clock hits zero", () => {
    const seen = record([GameEvents.TIMER_TICK, GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "endless", durationSeconds: 2 }, pool, createRng(1), noBest);
    expect(session.tickSecond()).toBe(1);
    expect(session.evaluateSettled()).toBe("continue");
    expect(session.tickSecond()).toBe(0);
    // time is up, but nothing ends until the board has settled and we ask
    expect(seen.filter((e) => e.type === GameEvents.GAME_OVER)).toHaveLength(0);
    expect(session.evaluateSettled()).toBe("game-over");
    expect(seen.filter((e) => e.type === GameEvents.GAME_OVER)).toHaveLength(1);
    expect(session.evaluateSettled()).toBe("inactive"); // no second game-over
    expect(seen.filter((e) => e.type === GameEvents.GAME_OVER)).toHaveLength(1);
  });

  it("keeps accepting score for a cascade that was already animating", () => {
    const session = new GameSession({ mode: "endless", durationSeconds: 1 }, pool, createRng(1), noBest);
    session.tickSecond();
    session.addScore(120);
    expect(session.score).toBe(120);
  });

  it("saves the best at game over only, and reports whether this run beat it", () => {
    const seen = record([GameEvents.GAME_OVER]);
    const saved: number[] = [];
    let best = 500;
    const recordEndlessBest = (score: number) => {
      saved.push(score);
      const isNewBest = score > best;
      if (isNewBest) best = score;
      return { best, isNewBest };
    };
    const session = new GameSession({ mode: "endless", durationSeconds: 1 }, pool, createRng(1), { recordEndlessBest });
    session.addScore(900);
    expect(saved).toEqual([]); // a run in progress saves nothing
    session.tickSecond();
    session.evaluateSettled();
    expect(saved).toEqual([900]);
    expect(seen[0].detail).toMatchObject({ mode: "endless", reason: "time-up", score: 900, best: 900, isNewBest: true });
    session.evaluateSettled(); // inactive: nothing is saved twice
    expect(saved).toEqual([900]);
  });

  it("does not flag a lower score as a best", () => {
    const seen = record([GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "endless", durationSeconds: 1 }, pool, createRng(1), {
      recordEndlessBest: () => ({ best: 5000, isNewBest: false }),
    });
    session.addScore(100);
    session.tickSecond();
    session.evaluateSettled();
    expect(seen[0].detail).toMatchObject({ score: 100, best: 5000, isNewBest: false });
  });

  it("reports no goals and no level in Endless", () => {
    const seen = record([GameEvents.SESSION_STARTED]);
    const session = new GameSession({ mode: "endless", durationSeconds: 60 }, pool, createRng(1), noBest);
    session.start();
    expect(seen[0].detail).toMatchObject({
      mode: "endless",
      timeRemaining: 60,
      movesRemaining: null,
      levelId: null,
      levelNumber: null,
      difficulty: null,
      goals: [],
      hintKey: null,
    });
    expect(session.goalViews()).toEqual([]);
  });
});

describe("GameSession: level mode", () => {
  it("only spends moves through consumeMove", () => {
    const session = new GameSession({ mode: "level", level: levelOf({ moveLimit: 3 }) }, pool, createRng(1));
    expect(session.movesRemaining).toBe(3);
    session.consumeMove();
    expect(session.movesRemaining).toBe(2);
  });

  it("announces the level, its difficulty, its goals and (on a first attempt) its hint", () => {
    const seen = record([GameEvents.SESSION_STARTED]);
    const level = resolveLevel(6, "hard");
    new GameSession({ mode: "level", level }, pool, createRng(1)).start();
    new GameSession({ mode: "level", level }, pool, createRng(1), { levelCleared: () => true }).start();
    expect(seen[0].detail).toMatchObject({
      mode: "level",
      levelId: "hard-06",
      levelNumber: 6,
      difficulty: "hard",
      movesRemaining: level.moveLimit,
      hintKey: "level.hint.chain",
    });
    expect((seen[0].detail as { goals: unknown[] }).goals).toHaveLength(2);
    expect((seen[1].detail as { hintKey: unknown }).hintKey).toBeNull(); // already cleared: no hint
  });

  it("dispatches LEVEL_OBJECTIVE_MET (not game-over) when the target is reached, recording the pre-bonus score", () => {
    const seen = record([GameEvents.LEVEL_OBJECTIVE_MET, GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "level", level: levelOf() }, pool, createRng(1));
    session.consumeMove();
    session.addScore(TARGET - 1);
    expect(session.evaluateSettled()).toBe("continue");
    session.addScore(1);
    expect(session.evaluateSettled()).toBe("objective-met");
    expect(session.status).toBe("celebrating");
    expect(session.objectiveScore).toBe(TARGET);
    expect(session.movesAtObjective).toBe(BASE.moveLimit - 1);
    expect(seen.map((e) => e.type)).toEqual([GameEvents.LEVEL_OBJECTIVE_MET]);
    expect(seen[0].detail).toMatchObject({
      sessionId: session.sessionId,
      movesRemaining: BASE.moveLimit - 1,
      score: TARGET,
    });
  });

  it("goes straight to a failed game-over when moves run out below the objective", () => {
    const seen = record([GameEvents.LEVEL_OBJECTIVE_MET, GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "level", level: levelOf({ moveLimit: 1 }) }, pool, createRng(1), {
      levelBest: () => 777,
    });
    session.consumeMove();
    session.addScore(500);
    expect(session.evaluateSettled()).toBe("game-over");
    expect(seen.map((e) => e.type)).toEqual([GameEvents.GAME_OVER]);
    expect(seen[0].detail).toMatchObject({
      mode: "level",
      reason: "out-of-moves",
      score: 500,
      levelNumber: 1,
      difficulty: "normal",
      best: 777,
      isNewBest: false,
    });
    expect((seen[0].detail as { goals: { current: number }[] }).goals[0].current).toBe(500);
  });

  it("a last-move objective hit still celebrates instead of failing", () => {
    const seen = record([GameEvents.LEVEL_OBJECTIVE_MET, GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "level", level: levelOf({ moveLimit: 1 }) }, pool, createRng(1));
    session.consumeMove();
    session.addScore(TARGET + 200);
    expect(session.evaluateSettled()).toBe("objective-met");
    expect(seen.map((e) => e.type)).toEqual([GameEvents.LEVEL_OBJECTIVE_MET]);
  });

  it("tracks combo chains and the max reached", () => {
    const session = new GameSession({ mode: "level", level: levelOf() }, pool, createRng(1));
    session.registerCombo(0);
    session.registerCombo(3);
    session.resetCombo();
    session.registerCombo(1);
    expect(session.combo).toBe(2);
    expect(session.maxCombo).toBe(4);
  });
});

describe("GameSession: goals", () => {
  it("clears only when EVERY goal is met at the settle, not as soon as the score is", () => {
    const level = withGoals([
      { type: "score", target: 300 },
      { type: "specials", count: 1 },
    ]);
    const session = new GameSession({ mode: "level", level }, pool, createRng(1));
    session.applyStep(clear(0, [], 400));
    expect(session.evaluateSettled()).toBe("continue"); // score is there, the special is not
    session.applyStep(spawn);
    expect(session.evaluateSettled()).toBe("objective-met");
  });

  it("collects the character in the goal's pool slot, including swept-up tiles", () => {
    const target = pool[0].id;
    const other = pool[1].id;
    const session = new GameSession(
      { mode: "level", level: withGoals([{ type: "collect", slot: 0, count: 4 }]) },
      pool,
      createRng(1)
    );
    session.applyStep(clear(0, [other, other, other]));
    expect(session.evaluateSettled()).toBe("continue");
    session.applyStep(clear(0, [target, target, target, other]));
    expect(session.goalViews()[0]).toMatchObject({ current: 3, target: 4, characterId: target });
    session.applyStep(clear(1, [target, other]));
    expect(session.evaluateSettled()).toBe("objective-met");
  });

  it("a chain goal is met by a chain reached in one move and stays met", () => {
    const session = new GameSession(
      { mode: "level", level: withGoals([{ type: "chain", length: 3 }]) },
      pool,
      createRng(1)
    );
    session.applyStep(clear(0, ["x"]));
    session.applyStep(clear(1, ["x"]));
    session.resetCombo();
    expect(session.evaluateSettled()).toBe("continue");
    session.applyStep(clear(0, ["x"]));
    session.applyStep(clear(1, ["x"]));
    session.applyStep(clear(2, ["x"]));
    session.resetCombo();
    expect(session.evaluateSettled()).toBe("objective-met");
  });

  it("applyStep scores, extends the combo and emits goal progress exactly once per clear step", () => {
    const seen = record([GameEvents.SCORE_UPDATED, GameEvents.COMBO_UPDATED, GameEvents.GOAL_PROGRESS]);
    const session = new GameSession(
      { mode: "level", level: withGoals([{ type: "score", target: 1000 }]) },
      pool,
      createRng(1)
    );
    session.applyStep(clear(0, ["a", "b", "c"], 90));
    expect(seen.map((e) => e.type)).toEqual([
      GameEvents.SCORE_UPDATED,
      GameEvents.COMBO_UPDATED,
      GameEvents.GOAL_PROGRESS,
    ]);
    expect((seen[2].detail as { goals: { current: number }[] }).goals[0].current).toBe(90);
    expect(session.score).toBe(90);
    expect(session.combo).toBe(1);
  });

  it("only spawn steps that matter emit progress, and steps that do nothing emit nothing", () => {
    const seen = record([GameEvents.GOAL_PROGRESS]);
    const scoreOnly = new GameSession({ mode: "level", level: withGoals([{ type: "score", target: 1000 }]) }, pool, createRng(1));
    scoreOnly.applyStep(spawn);
    scoreOnly.applyStep({ type: "fall", moves: [] });
    expect(seen).toHaveLength(0);

    const wantsSpecials = new GameSession({ mode: "level", level: withGoals([{ type: "specials", count: 2 }]) }, pool, createRng(1));
    wantsSpecials.applyStep(spawn);
    expect(seen).toHaveLength(1);
  });

  it("starts every session's goals from zero", () => {
    const level = withGoals([{ type: "specials", count: 1 }]);
    const first = new GameSession({ mode: "level", level }, pool, createRng(1));
    first.applyStep(spawn);
    const second = new GameSession({ mode: "level", level }, pool, createRng(1));
    expect(second.goalViews()[0].current).toBe(0);
  });

  it("is not tied to the difficulty: the same code judges Easy, Normal and Hard levels", () => {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const level = resolveLevel(3, difficulty);
      const session = new GameSession({ mode: "level", level }, pool, createRng(1));
      const needed = level.goals[0].type === "specials" ? level.goals[0].count : 0;
      for (let i = 0; i < needed - 1; i++) session.applyStep(spawn);
      expect(session.evaluateSettled(), difficulty).toBe("continue");
      session.applyStep(spawn);
      expect(session.evaluateSettled(), difficulty).toBe("objective-met");
    }
  });
});

describe("event listener bookkeeping", () => {
  it("unsubscribe removes exactly its own listener and is idempotent", () => {
    const before = gameListenerCount(GameEvents.SCORE_UPDATED);
    let hits = 0;
    const off = onGameEvent(GameEvents.SCORE_UPDATED, () => hits++);
    expect(gameListenerCount(GameEvents.SCORE_UPDATED)).toBe(before + 1);
    const session = new GameSession({ mode: "endless", durationSeconds: 5 }, pool, createRng(1), noBest);
    session.addScore(10);
    expect(hits).toBe(1);
    off();
    off();
    session.addScore(10);
    expect(hits).toBe(1);
    expect(gameListenerCount(GameEvents.SCORE_UPDATED)).toBe(before);
  });
});

describe("computeStars", () => {
  it("counts thresholds reached", () => {
    const t = BASE.starThresholds;
    const [one, two, three] = t;
    expect(computeStars(0, t)).toBe(0);
    expect(computeStars(one - 1, t)).toBe(0);
    expect(computeStars(one, t)).toBe(1);
    expect(computeStars(two - 1, t)).toBe(1);
    expect(computeStars(two, t)).toBe(2);
    expect(computeStars(three - 1, t)).toBe(2);
    expect(computeStars(three, t)).toBe(3);
    expect(computeStars(three * 10, t)).toBe(3);
  });
});

describe("getActivePool", () => {
  it("draws ACTIVE_POOL_SIZE distinct library characters without a custom tile", () => {
    const active = getActivePool(null, createRng(9));
    expect(active).toHaveLength(ACTIVE_POOL_SIZE);
    expect(new Set(active.map((c) => c.id)).size).toBe(ACTIVE_POOL_SIZE);
    expect(active.every((c) => CHARACTER_LIBRARY.some((l) => l.id === c.id))).toBe(true);
  });

  it("honours a level's own pool size (6, 7 or 8)", () => {
    for (const size of [6, 7, 8]) {
      const active = getActivePool(null, createRng(size), size);
      expect(active).toHaveLength(size);
      expect(new Set(active.map((c) => c.id)).size).toBe(size);
    }
  });

  const custom = {
    id: CUSTOM_CHARACTER_ID,
    label: "自定义",
    color: 0x999999,
    assets: { normal: "data:image/png;base64,AAAA", sound: null, special: null, explode: null },
  };

  it("a custom tile takes one slot instead of adding an extra one", () => {
    const active = getActivePool(custom, createRng(9));
    expect(active).toHaveLength(ACTIVE_POOL_SIZE);
    expect(active.filter((c) => c.id === CUSTOM_CHARACTER_ID)).toHaveLength(1);
    expect(active.filter((c) => c.id !== CUSTOM_CHARACTER_ID)).toHaveLength(ACTIVE_POOL_SIZE - 1);
  });

  it("keeps the custom tile in the last slot for every pool size, so a collect goal can never target it", () => {
    for (const size of [6, 7, 8]) {
      const active = getActivePool(custom, createRng(size), size);
      expect(active).toHaveLength(size);
      expect(active[size - 1].id).toBe(CUSTOM_CHARACTER_ID);
      expect(active.slice(0, 3).some((c) => c.id === CUSTOM_CHARACTER_ID)).toBe(false);
    }
  });

  it("never modifies or trims the fixed 11-character library", () => {
    const before = CHARACTER_LIBRARY.map((c) => c.id);
    getActivePool(null, createRng(3));
    getActivePool({ id: CUSTOM_CHARACTER_ID, label: "x", color: 0, assets: { normal: null, sound: null, special: null, explode: null } }, createRng(4));
    expect(CHARACTER_LIBRARY.map((c) => c.id)).toEqual(before);
    expect(CHARACTER_LIBRARY).toHaveLength(11);
  });

  it("is reproducible for a fixed seed", () => {
    expect(getActivePool(null, createRng(5)).map((c) => c.id)).toEqual(getActivePool(null, createRng(5)).map((c) => c.id));
  });
});
