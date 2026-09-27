import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "../../config/difficulty";
import { LEVEL_COUNT, resolveLevel } from "../../config/levels";
import { goalBot, playLevel, randomBot, seedsFor, tally, type Bot, type Tally } from "./bots";

/**
 * Simulated play through the REAL session, resolver and celebration (bots.ts).
 *
 * The default run is a smoke test (a few seconds): the ends of the curve and the ordering of the
 * difficulties. `BALANCE=1 npm test` runs the full bands (all 20 levels x 3 difficulties, 40 games
 * each with the goal bot, plus the random bot): about ten minutes, for when a level, a goal rule or
 * the scoring is touched.
 *
 * The bands were set from that same run, with about 10 points of slack around what it measured; they
 * are a regression net, not a promise about human players. A human playtest pass is still due.
 *
 * Stars are generous on purpose: the 2-star line is the 10th percentile of a level's winning scores and
 * the 3-star line the 40th (about 90% and 60% of wins), and the difficulties are ordered per attempt.
 * game/core/__tests__/calibrate.test.ts (CALIBRATE=1) is the tool for finding those numbers again.
 */

const NUMBERS = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);
const percent = (t: Tally) => (100 * t.wins) / t.games;

describe("every level x difficulty is playable", () => {
  /** Plays only the first `moves` moves, then stops: enough to prove a level starts, moves and stays healthy. */
  const limited = (bot: Bot, moves: number): Bot => {
    let used = 0;
    return (context) => (used++ < moves ? bot(context) : null);
  };

  it("starts, spends moves and never throws, for all 60", async () => {
    for (const difficulty of DIFFICULTIES) {
      for (const n of NUMBERS) {
        const level = resolveLevel(n, difficulty);
        const game = await playLevel(level, 4242 + n, limited(randomBot, 5));
        expect(game.movesUsed, `${difficulty} L${n}`).toBeGreaterThan(0);
        expect(game.movesUsed, `${difficulty} L${n}`).toBeLessThanOrEqual(5);
        expect(game.finalScore, `${difficulty} L${n}`).toBeGreaterThan(0);
      }
    }
  }, 120_000);
});

describe("9x9 levels", () => {
  it("play start to finish: every move is spent or the level ends, and the score only grows", async () => {
    for (const n of [5, 9, 10, 14, 17, 19, 20]) {
      const level = resolveLevel(n, "normal");
      expect(level.gridSize, `L${n}`).toBe(9);
      const game = await playLevel(level, 31337 + n, goalBot);
      expect(game.movesUsed, `L${n}`).toBeGreaterThan(0);
      expect(game.movesUsed, `L${n}`).toBeLessThanOrEqual(level.moveLimit);
      expect(game.finalScore, `L${n}`).toBeGreaterThan(0);
      if (game.result) expect(game.result.finalScore, `L${n}`).toBeGreaterThanOrEqual(game.objectiveScore ?? 0);
      else expect(game.movesUsed, `L${n} lost`).toBe(level.moveLimit);
    }
  }, 240_000);
});

describe("level balance: smoke", () => {
  it("level 1 is easy to clear on Normal", async () => {
    const t = await tally(resolveLevel(1, "normal"), goalBot, seedsFor(8));
    expect(t.wins).toBeGreaterThanOrEqual(7);
  }, 120_000);

  it("the finale gets harder with the difficulty: Easy >= Normal >= Hard, and Easy > Hard", async () => {
    const wins: Record<Difficulty, number> = { easy: 0, normal: 0, hard: 0 };
    for (const difficulty of DIFFICULTIES) {
      wins[difficulty] = (await tally(resolveLevel(20, difficulty), goalBot, seedsFor(10))).wins;
    }
    expect(wins.easy).toBeGreaterThanOrEqual(wins.normal);
    expect(wins.normal).toBeGreaterThanOrEqual(wins.hard);
    expect(wins.easy).toBeGreaterThan(wins.hard);
  }, 240_000);
});

// ---- the full bands, opt-in ---------------------------------------------------------------------------

describe.skipIf(process.env.BALANCE !== "1")("level balance: full bands (BALANCE=1)", () => {
  const GAMES = 40;
  const seeds = seedsFor(GAMES);
  const goal = {} as Record<Difficulty, Tally[]>;
  const random = {} as Record<Difficulty, Tally[]>;

  it("plays every level at every difficulty", async () => {
    for (const difficulty of DIFFICULTIES) {
      goal[difficulty] = [];
      random[difficulty] = [];
      for (const n of NUMBERS) {
        const level = resolveLevel(n, difficulty);
        goal[difficulty].push(await tally(level, goalBot, seeds));
        random[difficulty].push(await tally(level, randomBot, seeds));
      }
    }
    expect(goal.normal).toHaveLength(LEVEL_COUNT);
  }, 3_600_000);

  const at = (table: Record<Difficulty, Tally[]>, difficulty: Difficulty, n: number) => table[difficulty][n - 1];

  it("Normal: the warm-up is generous, the finale is a real test", () => {
    for (const n of NUMBERS) {
      const wins = percent(at(goal, "normal", n));
      const where = `Normal L${n}: ${wins}%`;
      if (n <= 4) expect(wins, where).toBeGreaterThanOrEqual(90);
      else if (n <= 12) expect(wins, where).toBeGreaterThanOrEqual(70);
      else expect(wins, where).toBeGreaterThanOrEqual(45);
    }
    expect(percent(at(goal, "normal", 20))).toBeLessThanOrEqual(70);
    expect(percent(at(goal, "normal", 20))).toBeLessThan(percent(at(goal, "normal", 1)));
  });

  it("Easy never drops below 85% for a thinking player", () => {
    for (const n of NUMBERS) expect(percent(at(goal, "easy", n)), `Easy L${n}`).toBeGreaterThanOrEqual(85);
  });

  it("Hard is a real step up, but every level stays winnable", () => {
    for (const n of NUMBERS) expect(percent(at(goal, "hard", n)), `Hard L${n}`).toBeGreaterThanOrEqual(15);
    for (const n of [1, 3]) expect(percent(at(goal, "hard", n)), `Hard L${n}`).toBeGreaterThanOrEqual(90);
    expect(percent(at(goal, "hard", 20))).toBeLessThanOrEqual(50);
  });

  it("the difficulties are ordered: on average Easy > Normal > Hard, by a clear margin", () => {
    const average = (difficulty: Difficulty) => goal[difficulty].reduce((sum, t) => sum + percent(t), 0) / LEVEL_COUNT;
    expect(average("easy")).toBeGreaterThan(average("normal") + 5);
    expect(average("normal")).toBeGreaterThan(average("hard") + 5);
  });

  it("a player who does not think cannot walk through the game", () => {
    expect(percent(at(random, "normal", 20))).toBeLessThanOrEqual(20);
    expect(percent(at(random, "hard", 20))).toBeLessThanOrEqual(10);
    for (const difficulty of DIFFICULTIES) {
      for (const n of NUMBERS) {
        // thinking is never worse than not thinking (a little slack for the seeds)
        expect(at(random, difficulty, n).wins, `${difficulty} L${n}`).toBeLessThanOrEqual(at(goal, difficulty, n).wins + 2);
      }
    }
  });

  it("Easy is still winnable by tapping, so the first hour is not a wall", () => {
    for (const n of NUMBERS) expect(percent(at(random, "easy", n)), `random Easy L${n}`).toBeGreaterThanOrEqual(40);
  });

  // ---- stars: generous on Normal, and ordered by difficulty ------------------------------------------
  // Per ATTEMPT (games played, not only wins): P(>= k stars) = wins that ended on k stars or more / games.

  /** Wins that ended on k stars or more, as a percentage of all games. */
  const attempts = (t: Tally, k: 2 | 3) => (100 * t.stars.slice(k - 1).reduce((sum, n) => sum + n, 0)) / t.games;
  const averageAttempts = (difficulty: Difficulty, k: 2 | 3) =>
    goal[difficulty].reduce((sum, t) => sum + attempts(t, k), 0) / LEVEL_COUNT;
  /** A few games of seed slack, in percentage points of the GAMES sample. */
  const SLACK = (3 / GAMES) * 100;

  it("stars are easy to earn on Normal: about 90% of wins earn 2 stars, about 60% earn 3", () => {
    const wins = goal.normal.reduce((sum, t) => sum + t.wins, 0);
    const from = (tier: 0 | 1 | 2) => goal.normal.reduce((sum, t) => sum + t.stars.slice(tier).reduce((a, n) => a + n, 0), 0);
    expect((100 * from(1)) / wins, "wins with 2+ stars").toBeGreaterThanOrEqual(80);
    expect((100 * from(1)) / wins, "wins with 2+ stars").toBeLessThanOrEqual(97);
    expect((100 * from(2)) / wins, "wins with 3 stars").toBeGreaterThanOrEqual(50);
    expect((100 * from(2)) / wins, "wins with 3 stars").toBeLessThanOrEqual(72);
  });

  it("per level, a harder difficulty never makes 2 or 3 stars easier (a few games of seed slack)", () => {
    for (const n of NUMBERS) {
      for (const k of [2, 3] as const) {
        const [easy, normal, hard] = DIFFICULTIES.map((d) => attempts(at(goal, d, n), k));
        expect(easy + SLACK, `L${n} P(>=${k}*): Easy ${easy} vs Normal ${normal}`).toBeGreaterThanOrEqual(normal);
        expect(normal + SLACK, `L${n} P(>=${k}*): Normal ${normal} vs Hard ${hard}`).toBeGreaterThanOrEqual(hard);
      }
    }
  });

  it("on average Easy > Normal > Hard for both tiers, each step by a clear margin (8+ points)", () => {
    for (const k of [2, 3] as const) {
      const [easy, normal, hard] = DIFFICULTIES.map((d) => averageAttempts(d, k));
      expect(easy, `P(>=${k}*) Easy vs Normal`).toBeGreaterThan(normal + 8);
      expect(normal, `P(>=${k}*) Normal vs Hard`).toBeGreaterThan(hard + 8);
    }
  });

  it("the top tier stays reachable on Hard: at least 5% of attempts on average, and on every level", () => {
    expect(averageAttempts("hard", 3)).toBeGreaterThanOrEqual(5);
    for (const n of NUMBERS) expect(attempts(at(goal, "hard", n), 3), `Hard L${n}`).toBeGreaterThanOrEqual(5);
  });
});
