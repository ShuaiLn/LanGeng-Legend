import { afterEach, describe, expect, it } from "vitest";
import { getActiveSessionId, onGameEvent, GameEvents, gameListenerCount, type GameEventName } from "../events";
import { GameSession } from "../session";
import { createRng } from "../rng";
import { computeStars, DEMO_LEVEL, type LevelConfig } from "../../config/levels";
import { getActivePool, CHARACTER_LIBRARY, ACTIVE_POOL_SIZE, CUSTOM_CHARACTER_ID } from "../../config/characters";

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
const TARGET = DEMO_LEVEL.objective.targetScore;
const levelOf = (overrides: Partial<LevelConfig> = {}): LevelConfig => ({ ...DEMO_LEVEL, ...overrides });

describe("GameSession ids", () => {
  it("mints a new sessionId per session and marks the newest as active", () => {
    const a = new GameSession({ mode: "endless", durationSeconds: 60 }, pool, createRng(1));
    const b = new GameSession({ mode: "endless", durationSeconds: 60 }, pool, createRng(1));
    expect(b.sessionId).toBeGreaterThan(a.sessionId);
    a.start();
    b.start();
    expect(getActiveSessionId()).toBe(b.sessionId);
  });
});

describe("GameSession: endless mode", () => {
  it("counts down, and only ends once evaluateSettled runs after the clock hits zero", () => {
    const seen = record([GameEvents.TIMER_TICK, GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "endless", durationSeconds: 2 }, pool, createRng(1));
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
    const session = new GameSession({ mode: "endless", durationSeconds: 1 }, pool, createRng(1));
    session.tickSecond();
    session.addScore(120);
    expect(session.score).toBe(120);
  });
});

describe("GameSession: level mode", () => {
  it("only spends moves through consumeMove", () => {
    const session = new GameSession({ mode: "level", level: levelOf({ moveLimit: 3 }) }, pool, createRng(1));
    expect(session.movesRemaining).toBe(3);
    session.consumeMove();
    expect(session.movesRemaining).toBe(2);
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
    expect(session.movesAtObjective).toBe(19);
    expect(seen.map((e) => e.type)).toEqual([GameEvents.LEVEL_OBJECTIVE_MET]);
    expect(seen[0].detail).toMatchObject({ sessionId: session.sessionId, movesRemaining: 19, score: TARGET });
  });

  it("goes straight to a failed game-over when moves run out below the objective", () => {
    const seen = record([GameEvents.LEVEL_OBJECTIVE_MET, GameEvents.GAME_OVER]);
    const session = new GameSession({ mode: "level", level: levelOf({ moveLimit: 1 }) }, pool, createRng(1));
    session.consumeMove();
    session.addScore(500);
    expect(session.evaluateSettled()).toBe("game-over");
    expect(seen.map((e) => e.type)).toEqual([GameEvents.GAME_OVER]);
    expect(seen[0].detail).toMatchObject({ mode: "level", reason: "out-of-moves", score: 500 });
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

describe("event listener bookkeeping", () => {
  it("unsubscribe removes exactly its own listener and is idempotent", () => {
    const before = gameListenerCount(GameEvents.SCORE_UPDATED);
    let hits = 0;
    const off = onGameEvent(GameEvents.SCORE_UPDATED, () => hits++);
    expect(gameListenerCount(GameEvents.SCORE_UPDATED)).toBe(before + 1);
    const session = new GameSession({ mode: "endless", durationSeconds: 5 }, pool, createRng(1));
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
    const t = DEMO_LEVEL.starThresholds;
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

  it("a custom tile takes one slot instead of adding an extra one", () => {
    const custom = { id: CUSTOM_CHARACTER_ID, label: "自定义", color: 0x999999, assets: { normal: "data:image/png;base64,AAAA", special: null, explode: null } };
    const active = getActivePool(custom, createRng(9));
    expect(active).toHaveLength(ACTIVE_POOL_SIZE);
    expect(active.filter((c) => c.id === CUSTOM_CHARACTER_ID)).toHaveLength(1);
    expect(active.filter((c) => c.id !== CUSTOM_CHARACTER_ID)).toHaveLength(ACTIVE_POOL_SIZE - 1);
  });

  it("never modifies or trims the fixed 11-character library", () => {
    const before = CHARACTER_LIBRARY.map((c) => c.id);
    getActivePool(null, createRng(3));
    getActivePool({ id: CUSTOM_CHARACTER_ID, label: "x", color: 0, assets: { normal: null, special: null, explode: null } }, createRng(4));
    expect(CHARACTER_LIBRARY.map((c) => c.id)).toEqual(before);
    expect(CHARACTER_LIBRARY).toHaveLength(11);
  });

  it("is reproducible for a fixed seed", () => {
    expect(getActivePool(null, createRng(5)).map((c) => c.id)).toEqual(getActivePool(null, createRng(5)).map((c) => c.id));
  });
});
