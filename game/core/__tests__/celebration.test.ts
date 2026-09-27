import { afterEach, describe, expect, it } from "vitest";
import { ACTIVE_POOL_SIZE, getActivePool } from "../../config/characters";
import type { CelebrationTimings } from "../../config/gameConfig";
import { computeStars, resolveLevel, scoreGoalTarget, type LevelConfig } from "../../config/levels";
import type { VictoryOutcome } from "../../../lib/progressStorage";
import { findTileCellByUid, generateBoard } from "../board";
import {
  activeCelebrationCount,
  BONUS_SPECIAL_TYPES,
  cancelAllCelebrations,
  pickBonusTarget,
  startCelebrationListener,
  type CelebrationHost,
} from "../celebration";
import {
  emitGameEvent,
  GameEvents,
  gameListenerCount,
  onGameEvent,
  type GameEventDetailMap,
  type GameEventName,
} from "../events";
import { createRng } from "../rng";
import { GameSession } from "../session";
import { boardFrom } from "./helpers";

const ZERO: CelebrationTimings = {
  pause: 0,
  banner: 0,
  convertStagger: 0,
  detonateGap: 0,
  starGap: 0,
  beforeResult: 0,
};
const SLOW: CelebrationTimings = { ...ZERO, pause: 30, banner: 30, convertStagger: 30 };

const CELEBRATION_EVENTS: GameEventName[] = [
  GameEvents.CELEBRATION_LOCK_INPUT,
  GameEvents.CELEBRATION_LEVEL_CLEAR,
  GameEvents.CELEBRATION_CONVERT,
  GameEvents.CELEBRATION_DETONATE,
  GameEvents.CELEBRATION_FINAL_SCORE,
  GameEvents.CELEBRATION_STAR,
  GameEvents.NEW_BEST,
  GameEvents.CELEBRATION_RESULT,
];

const disposers: (() => void)[] = [];
afterEach(() => {
  cancelAllCelebrations();
  while (disposers.length) disposers.pop()!();
});

function record(names: GameEventName[] = CELEBRATION_EVENTS) {
  const seen: { type: GameEventName; detail: { sessionId: number } & Record<string, unknown> }[] = [];
  for (const type of names) {
    disposers.push(
      onGameEvent(type, (detail) => seen.push({ type, detail: detail as (typeof seen)[number]["detail"] }))
    );
  }
  return seen;
}

const LEVEL = resolveLevel(1, "normal");
const TARGET = scoreGoalTarget(LEVEL)!;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function waitForResult(sessionId: number, timeoutMs = 3000): Promise<GameEventDetailMap["celebration-result"]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("celebration did not finish")), timeoutMs);
    const off = onGameEvent(GameEvents.CELEBRATION_RESULT, (detail) => {
      if (detail.sessionId !== sessionId) return;
      clearTimeout(timer);
      off();
      resolve(detail);
    });
  });
}

function makeHost(opts: { seed: number; level?: LevelConfig; movesUsed?: number }) {
  const level = opts.level ?? LEVEL;
  const rng = createRng(opts.seed);
  const pool = getActivePool(null, rng);
  const session = new GameSession({ mode: "level", level }, pool, rng);
  session.start();
  const board = generateBoard(8, 8, pool, rng);
  for (let i = 0; i < (opts.movesUsed ?? 0); i++) session.consumeMove();

  const host: CelebrationHost = {
    session,
    getBoard: () => board,
    // mimic BoardScene: scores apply as each clear step "plays"
    playSteps: async (steps) => {
      for (const step of steps) session.applyStep(step);
    },
  };
  return { host, session, board, pool };
}

function reachObjective(session: GameSession) {
  session.addScore(scoreGoalTarget(session.level!)!);
  return session.evaluateSettled();
}

/** A stand-in for the progress store: reports the outcome a store holding `best` would, and logs what it is asked to record. */
const stubStorage = (best = 0, overrides: Partial<VictoryOutcome> = {}) => {
  const writes: number[] = [];
  const records: { level: LevelConfig; score: number; stars: number }[] = [];
  return {
    writes,
    records,
    storage: {
      record: (level: LevelConfig, score: number, stars: number): VictoryOutcome => {
        writes.push(score);
        records.push({ level, score, stars });
        return {
          isNewBest: score > best,
          best: Math.max(best, score),
          stars,
          unlockedNext: true,
          totalStars: stars,
          hasNext: level.number < 20,
          ...overrides,
        };
      },
    },
  };
};

describe("pickBonusTarget", () => {
  it("only ever offers non-special tiles", () => {
    const board = boardFrom(["abc", "def", "ghi"], { "0,0": "wrapped", "1,1": "super", "2,2": "striped-row" });
    const rng = createRng(3);
    for (let i = 0; i < 50; i++) {
      const target = pickBonusTarget(board, rng)!;
      expect(board[target.cell.row][target.cell.col]!.special).toBeNull();
    }
  });

  it("returns null when every tile is already special", () => {
    const specials = Object.fromEntries(
      [0, 1].flatMap((r) => [0, 1].map((c) => [`${r},${c}`, "wrapped" as const]))
    );
    expect(pickBonusTarget(boardFrom(["ab", "cd"], specials), createRng(1))).toBeNull();
  });

  it("the bonus special set never includes super", () => {
    expect(BONUS_SPECIAL_TYPES).not.toContain("super");
  });
});

describe("celebration sequence", () => {
  it("runs every beat in order and settles the final score exactly once", async () => {
    const seen = record();
    const { host, session, board } = makeHost({ seed: 21, movesUsed: 12 });
    const { storage, writes } = stubStorage(0);
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);

    expect(reachObjective(session)).toBe("objective-met");
    const result = await done;

    const types = seen.map((e) => e.type);
    expect(types.slice(0, 2)).toEqual([GameEvents.CELEBRATION_LOCK_INPUT, GameEvents.CELEBRATION_LEVEL_CLEAR]);
    const firstConvert = types.indexOf(GameEvents.CELEBRATION_CONVERT);
    const firstDetonate = types.indexOf(GameEvents.CELEBRATION_DETONATE);
    const finalScoreAt = types.indexOf(GameEvents.CELEBRATION_FINAL_SCORE);
    const firstStar = types.indexOf(GameEvents.CELEBRATION_STAR);
    const resultAt = types.indexOf(GameEvents.CELEBRATION_RESULT);
    expect(firstConvert).toBe(2);
    expect(firstDetonate).toBeGreaterThan(types.lastIndexOf(GameEvents.CELEBRATION_CONVERT));
    expect(finalScoreAt).toBeGreaterThan(types.lastIndexOf(GameEvents.CELEBRATION_DETONATE));
    if (firstStar !== -1) expect(firstStar).toBeGreaterThan(finalScoreAt);
    expect(resultAt).toBe(types.length - 1);
    expect(types.filter((t) => t === GameEvents.CELEBRATION_FINAL_SCORE)).toHaveLength(1);
    expect(types.filter((t) => t === GameEvents.CELEBRATION_RESULT)).toHaveLength(1);

    // 12 of 24 moves used -> 12 leftover moves, each converted to a striped/wrapped tile (never super)
    const converts = seen.filter((e) => e.type === GameEvents.CELEBRATION_CONVERT);
    expect(converts).toHaveLength(LEVEL.moveLimit - 12);
    expect(converts.every((e) => (BONUS_SPECIAL_TYPES as readonly string[]).includes(e.detail.special as string))).toBe(true);
    expect(session.movesRemaining).toBe(0);
    // (a `super` may still appear later, but only by a genuine 5-match in a bonus cascade)
    expect(converts.some((e) => e.detail.special === "super")).toBe(false);
    expect(board.flat().every((t) => t !== null)).toBe(true);

    // scoring: final == live score; bonus is what was added after the objective was hit
    expect(result.finalScore).toBe(session.score);
    expect(result.bonusScore).toBe(session.score - TARGET);
    expect(result.bonusMoves).toBe(LEVEL.moveLimit - 12);
    expect(result.stars).toBe(computeStars(session.score, LEVEL.starThresholds));
    expect(seen.filter((e) => e.type === GameEvents.CELEBRATION_STAR)).toHaveLength(result.stars);
    expect(seen.find((e) => e.type === GameEvents.CELEBRATION_FINAL_SCORE)!.detail.score).toBe(session.score);
    expect(result.maxCombo).toBeGreaterThanOrEqual(1);
    expect(session.status).toBe("ended");

    // NEW BEST written exactly once
    expect(result.isNewBest).toBe(true);
    expect(writes).toEqual([session.score]);
    expect(seen.filter((e) => e.type === GameEvents.NEW_BEST)).toHaveLength(1);
    await sleep(0); // the token is released just after the result event has fired
    expect(activeCelebrationCount()).toBe(0);
  });

  it("does not flag NEW BEST when the stored best is higher", async () => {
    const seen = record();
    const { host, session } = makeHost({ seed: 22, movesUsed: 15 });
    const { storage, writes } = stubStorage(999_999);
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    reachObjective(session);
    const result = await done;
    expect(result.isNewBest).toBe(false);
    expect(result.best).toBe(999_999);
    expect(writes).toEqual([session.score]); // still recorded: the stars and the unlock count even without a new best
    expect(seen.some((e) => e.type === GameEvents.NEW_BEST)).toBe(false);
  });

  it("records the clear once, before the star beats, against the level and difficulty it was played on", async () => {
    const seen = record();
    const level = resolveLevel(9, "hard");
    const { host, session } = makeHost({ seed: 26, level, movesUsed: level.moveLimit - 2 });
    const { storage, records } = stubStorage(0);
    let recordedBeforeFirstStar = false;
    disposers.push(
      onGameEvent(GameEvents.CELEBRATION_STAR, () => {
        recordedBeforeFirstStar ||= records.length === 1;
      })
    );
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    session.addScore(level.starThresholds[0] + 10);
    // level 9 wants two collect goals: satisfy them through the session so the objective is really met
    for (const goal of level.goals) {
      if (goal.type !== "collect") continue;
      const id = session.activePool[goal.slot].id;
      session.applyStep({ type: "clear", cleared: Array.from({ length: goal.count }, (_, i) => ({ uid: 900 + i, cell: { row: 0, col: 0 }, characterId: id, special: null })), activated: [], kinds: ["line3"], comboIndex: 0, scoreDelta: 0 });
    }
    expect(session.evaluateSettled()).toBe("objective-met");
    const result = await done;

    expect(records).toHaveLength(1);
    expect(records[0].level.id).toBe("hard-09");
    expect(records[0].score).toBe(session.score);
    expect(records[0].stars).toBe(result.stars);
    expect(recordedBeforeFirstStar || result.stars === 0).toBe(true);
    expect(seen.filter((e) => e.type === GameEvents.CELEBRATION_RESULT)).toHaveLength(1);
  });

  it("puts the level, difficulty, move limit, next-level and unlock facts on the result", async () => {
    const level = resolveLevel(7, "easy");
    const { host, session } = makeHost({ seed: 27, level, movesUsed: 4 });
    const { storage } = stubStorage(0, { unlockedNext: false, totalStars: 11 });
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    reachObjective(session);
    const result = await done;
    expect(result).toMatchObject({
      levelId: "easy-07",
      levelNumber: 7,
      difficulty: "easy",
      moveLimit: level.moveLimit,
      bonusMoves: level.moveLimit - 4,
      hasNext: true,
      unlockedNext: false,
      totalStars: 11,
    });
  });

  it("level 20 has no next level", async () => {
    const level = resolveLevel(20, "normal");
    const { host, session } = makeHost({ seed: 28, level, movesUsed: level.moveLimit });
    const { storage } = stubStorage(0);
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    session.addScore(level.starThresholds[0]);
    session.applyStep({ type: "spawnSpecial", uid: 1, cell: { row: 0, col: 0 }, special: "striped-row" });
    session.applyStep({ type: "spawnSpecial", uid: 2, cell: { row: 0, col: 1 }, special: "striped-row" });
    for (let i = 0; i < level.goals.length; i++) {
      const goal = level.goals[i];
      if (goal.type === "chain") for (let c = 0; c < goal.length; c++) session.registerCombo(c);
    }
    expect(session.evaluateSettled()).toBe("objective-met");
    expect((await done).hasNext).toBe(false);
  });

  it("a level with no score goal still earns a star on victory", async () => {
    const level = resolveLevel(3, "normal"); // "make 2 special tiles"
    expect(level.starThresholds[0]).toBe(0);
    const { host, session } = makeHost({ seed: 29, level, movesUsed: level.moveLimit });
    const { storage } = stubStorage(0);
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    session.applyStep({ type: "spawnSpecial", uid: 1, cell: { row: 0, col: 0 }, special: "striped-row" });
    session.applyStep({ type: "spawnSpecial", uid: 2, cell: { row: 0, col: 1 }, special: "striped-row" });
    expect(session.evaluateSettled()).toBe("objective-met");
    expect((await done).stars).toBeGreaterThanOrEqual(1);
  });

  it("looks bonus specials up by uid: swept-away ones are skipped silently, none detonate twice", async () => {
    const seen = record();
    // 30 leftover moves -> 30 converted tiles crowded on a 64-tile board: chains must eat some
    const { host, session, board } = makeHost({
      seed: 23,
      level: { ...LEVEL, moveLimit: 30 },
    });

    // every detonation must target a tile that is genuinely on the board at that moment
    const mismatches: string[] = [];
    disposers.push(
      onGameEvent(GameEvents.CELEBRATION_DETONATE, (d) => {
        const at = findTileCellByUid(board, d.uid);
        if (!at || at.row !== d.cell.row || at.col !== d.cell.col) mismatches.push(`uid ${d.uid}`);
      })
    );

    const { storage } = stubStorage();
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    reachObjective(session);
    await done;

    const converted = seen.filter((e) => e.type === GameEvents.CELEBRATION_CONVERT).map((e) => e.detail.uid as number);
    const detonated = seen.filter((e) => e.type === GameEvents.CELEBRATION_DETONATE).map((e) => e.detail.uid as number);
    expect(converted).toHaveLength(30);
    expect(detonated.length).toBeLessThan(converted.length); // some were swept up by earlier chains
    expect(new Set(detonated).size).toBe(detonated.length);
    expect(detonated.every((uid) => converted.includes(uid))).toBe(true);
    expect(mismatches).toEqual([]);
  });

  it("ends the convert beat early when no eligible tile remains", async () => {
    const seen = record();
    const { host, session, board } = makeHost({ seed: 24, movesUsed: 10 });
    for (const tile of board.flat()) tile!.special = "striped-row";
    const { storage } = stubStorage();
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    reachObjective(session);
    await done;
    expect(seen.some((e) => e.type === GameEvents.CELEBRATION_CONVERT)).toBe(false);
    expect(seen.some((e) => e.type === GameEvents.CELEBRATION_DETONATE)).toBe(false);
    expect(seen.some((e) => e.type === GameEvents.CELEBRATION_RESULT)).toBe(true);
  });

  it("with no leftover moves it still celebrates and grades the score as-is", async () => {
    const { host, session } = makeHost({ seed: 25, movesUsed: LEVEL.moveLimit });
    const { storage } = stubStorage();
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    const done = waitForResult(session.sessionId);
    reachObjective(session);
    const result = await done;
    expect(result.bonusMoves).toBe(0);
    expect(result.bonusScore).toBe(0);
    expect(result.finalScore).toBe(TARGET);
    expect(result.stars).toBe(computeStars(TARGET, LEVEL.starThresholds));
  });
});

describe("celebration cancellation and session isolation", () => {
  it("cancelling mid-sequence stops every later beat and clears the timer", async () => {
    const seen = record();
    const { host, session } = makeHost({ seed: 31, movesUsed: 10 });
    const { storage } = stubStorage();
    const dispose = startCelebrationListener(() => host, { timings: SLOW, storage });
    reachObjective(session);
    expect(activeCelebrationCount()).toBe(1);

    await sleep(45); // lock-input and level-clear have fired; the banner beat is pending
    dispose();
    const countAtCancel = seen.length;
    expect(activeCelebrationCount()).toBe(0);

    await sleep(250);
    expect(seen).toHaveLength(countAtCancel);
    expect(seen.some((e) => e.type === GameEvents.CELEBRATION_RESULT)).toBe(false);
    expect(seen.some((e) => e.type === GameEvents.CELEBRATION_CONVERT)).toBe(false);
  });

  it("a cancelled session's celebration never leaks into the next session", async () => {
    const seen = record();
    const a = makeHost({ seed: 41, movesUsed: 10 });
    const { storage } = stubStorage();
    const disposeA = startCelebrationListener(() => a.host, { timings: SLOW, storage });
    reachObjective(a.session);
    await sleep(10);
    cancelAllCelebrations(); // e.g. React unmount / route change
    disposeA();

    // "Retry": a brand new session starts while A's timers would still have been pending
    const b = makeHost({ seed: 42, movesUsed: 10 });
    disposers.push(startCelebrationListener(() => b.host, { timings: ZERO, storage }));
    const done = waitForResult(b.session.sessionId);
    reachObjective(b.session);
    await done;
    await sleep(150);

    expect(seen.some((e) => e.detail.sessionId === b.session.sessionId)).toBe(true);
    const staleAfterCancel = seen.filter(
      (e) => e.detail.sessionId === a.session.sessionId && e.type !== GameEvents.CELEBRATION_LOCK_INPUT
    );
    // the only A event allowed is what fired before the cancel (at most the lock-input beat)
    expect(staleAfterCancel.filter((e) => e.type === GameEvents.CELEBRATION_RESULT)).toHaveLength(0);
    expect(staleAfterCancel.filter((e) => e.type === GameEvents.CELEBRATION_STAR)).toHaveLength(0);
    expect(staleAfterCancel.filter((e) => e.type === GameEvents.CELEBRATION_CONVERT)).toHaveLength(0);
  });

  it("ignores an objective-met event that belongs to a different session", () => {
    const seen = record();
    const { host, session } = makeHost({ seed: 51 });
    const { storage } = stubStorage();
    disposers.push(startCelebrationListener(() => host, { timings: ZERO, storage }));
    emitGameEvent(GameEvents.LEVEL_OBJECTIVE_MET, {
      sessionId: session.sessionId + 1000,
      levelId: LEVEL.id,
      score: TARGET,
      movesRemaining: 5,
    });
    expect(seen).toHaveLength(0);
    expect(activeCelebrationCount()).toBe(0);
  });

  it("the disposer removes its listener, so re-mounting never doubles up", async () => {
    const before = gameListenerCount(GameEvents.LEVEL_OBJECTIVE_MET);
    const { host } = makeHost({ seed: 61 });
    const disposeFirst = startCelebrationListener(() => host, { timings: ZERO });
    expect(gameListenerCount(GameEvents.LEVEL_OBJECTIVE_MET)).toBe(before + 1);
    disposeFirst();
    expect(gameListenerCount(GameEvents.LEVEL_OBJECTIVE_MET)).toBe(before);

    // mount / unmount / mount: exactly one celebration for one objective-met event
    const seen = record([GameEvents.CELEBRATION_LOCK_INPUT]);
    const { host: host2, session } = makeHost({ seed: 62, movesUsed: 19 });
    const { storage } = stubStorage();
    const disposeSecond = startCelebrationListener(() => host2, { timings: ZERO, storage });
    disposers.push(disposeSecond);
    const done = waitForResult(session.sessionId);
    reachObjective(session);
    await done;
    expect(seen).toHaveLength(1);
    expect(ACTIVE_POOL_SIZE).toBeGreaterThan(0);
  });
});
