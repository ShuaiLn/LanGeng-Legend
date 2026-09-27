import { describe, expect, it } from "vitest";
import { DIFFICULTIES, isDifficulty, parseDifficulty, PROFILES, type Difficulty } from "../difficulty";
import { DEFAULT_GRID_SIZE, MAX_GRID_SIZE } from "../gameConfig";
import {
  computeStars,
  getLevelDef,
  LEVEL_COUNT,
  LEVEL_DEFS,
  parseLevelNumber,
  resolveLevel,
  scoreGoalTarget,
  STAR_STEP,
  starsForVictory,
  type Goal,
  type LevelConfig,
} from "../levels";

const NUMBERS = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);

/** `S950+X2`: score, Collect, speciaL-Kount, Xhain: the notation of the plan's tables. */
function describeGoals(goals: readonly Goal[]): string {
  return goals
    .map((goal) => {
      switch (goal.type) {
        case "score":
          return `S${goal.target}`;
        case "collect":
          return `C${goal.count}`;
        case "specials":
          return `K${goal.count}`;
        case "chain":
          return `X${goal.length}`;
      }
    })
    .join("+");
}

const magnitudes = (level: LevelConfig): number[] =>
  level.goals.map((goal) => {
    switch (goal.type) {
      case "score":
        return goal.target;
      case "collect":
      case "specials":
        return goal.count;
      case "chain":
        return goal.length;
    }
  });

describe("difficulty", () => {
  it("has exactly easy, normal and hard, and falls back to normal for anything else", () => {
    expect([...DIFFICULTIES]).toEqual(["easy", "normal", "hard"]);
    expect(parseDifficulty("hard")).toBe("hard");
    expect(parseDifficulty("easy")).toBe("easy");
    for (const bad of [undefined, null, "", "HARD", "expert", 3, {}]) expect(parseDifficulty(bad)).toBe("normal");
    expect(parseDifficulty(["easy", "hard"])).toBe("easy"); // a repeated query param: the first wins
    expect(isDifficulty("normal")).toBe(true);
    expect(isDifficulty("nightmare")).toBe(false);
  });

  it("does its arithmetic on integers, so boundaries never drift", () => {
    expect(PROFILES.easy.moves(20)).toBe(24);
    expect(PROFILES.easy.moves(15)).toBe(18);
    expect(PROFILES.hard.moves(25)).toBe(23);
    expect(PROFILES.hard.moves(20)).toBe(18);
    expect(PROFILES.easy.score(1500)).toBe(1200);
    expect(PROFILES.hard.score(1250)).toBe(1400); // 1375 rounds up to the next 50
    expect(PROFILES.easy.collect(11)).toBe(9);
    expect(PROFILES.hard.collect(10)).toBe(11);
    expect(PROFILES.easy.specials(2)).toBe(1);
    expect(PROFILES.easy.specials(3)).toBe(2);
    expect(PROFILES.hard.specials(2)).toBe(2);
    expect(PROFILES.hard.specials(3)).toBe(4);
    expect(PROFILES.easy.chain(3)).toBe(2);
    expect(PROFILES.easy.chain(2)).toBe(2);
    expect(PROFILES.hard.chain(2)).toBe(3);
    expect(PROFILES.hard.chain(3)).toBe(3);
  });

  it("scales the star lines further than the goals: Easy x0.65 and Hard x1.10, in steps of 50", () => {
    expect(PROFILES.easy.stars(2000)).toBe(1300);
    expect(PROFILES.easy.stars(2250)).toBe(1450); // 1462.5 rounds to the nearest 50
    expect(PROFILES.hard.stars(2000)).toBe(2200);
    expect(PROFILES.hard.stars(1550)).toBe(1700); // 1705 rounds to the nearest 50
    expect(PROFILES.normal.stars(1550)).toBe(1550);
  });
});

describe("the 20 levels", () => {
  it("has exactly 20 contiguous, numbered definitions", () => {
    expect(LEVEL_DEFS).toHaveLength(20);
    expect(LEVEL_DEFS.map((d) => d.number)).toEqual(NUMBERS);
    for (const n of NUMBERS) expect(getLevelDef(n).number).toBe(n);
    expect(() => getLevelDef(0)).toThrow();
    expect(() => getLevelDef(21)).toThrow();
  });

  it("gives every level x difficulty a unique id", () => {
    const ids = DIFFICULTIES.flatMap((d) => NUMBERS.map((n) => resolveLevel(n, d).id));
    expect(new Set(ids).size).toBe(60);
    expect(resolveLevel(7, "normal").id).toBe("normal-07");
    expect(resolveLevel(20, "hard").id).toBe("hard-20");
  });

  it("orders the chapters", () => {
    expect(NUMBERS.map((n) => getLevelDef(n).chapter)).toEqual([
      ...Array(5).fill(1),
      ...Array(5).fill(2),
      ...Array(5).fill(3),
      ...Array(5).fill(4),
    ]);
  });

  it("gives every level its own board size (8 or 9, never above the cap), pinned per level", () => {
    const GRID = [8, 8, 8, 8, 9, 8, 8, 8, 9, 9, 8, 8, 8, 9, 8, 8, 9, 8, 9, 9];
    expect(NUMBERS.map((n) => getLevelDef(n).gridSize)).toEqual(GRID);
    for (const n of NUMBERS) {
      expect([8, 9], `L${n}`).toContain(getLevelDef(n).gridSize);
      expect(getLevelDef(n).gridSize, `L${n}`).toBeLessThanOrEqual(MAX_GRID_SIZE);
      expect(getLevelDef(n).gridSize, `L${n}`).toBeGreaterThanOrEqual(DEFAULT_GRID_SIZE);
    }
    expect(MAX_GRID_SIZE).toBe(9);
    expect(DEFAULT_GRID_SIZE).toBe(8);
  });

  it("starts with four 8x8 levels, and the size does not climb steadily (a 9x9 level is followed by an 8x8 one)", () => {
    for (const n of [1, 2, 3, 4]) expect(getLevelDef(n).gridSize, `L${n}`).toBe(8);
    const sizes = NUMBERS.map((n) => getLevelDef(n).gridSize);
    expect(sizes.some((size, i) => size === 9 && sizes[i + 1] === 8)).toBe(true);
    expect(sizes).not.toEqual([...sizes].sort((a, b) => a - b));
  });

  it("gives every level its own number of characters (6, 7 or 8), pinned per level and independent of the board size", () => {
    const KINDS = [6, 6, 6, 7, 6, 7, 6, 7, 7, 6, 7, 7, 6, 7, 8, 7, 8, 8, 7, 8];
    expect(NUMBERS.map((n) => getLevelDef(n).poolSize)).toEqual(KINDS);
    // the first 8-character level is 15: that is the one whose hint says "Eight characters this time"
    expect(NUMBERS.find((n) => getLevelDef(n).poolSize === 8)).toBe(15);
    expect(getLevelDef(15).hintKey).toBe("level.hint.eight");
    // not tied to the grid: both sizes appear with more than one number of characters
    for (const size of [8, 9]) {
      const kinds = new Set(NUMBERS.filter((n) => getLevelDef(n).gridSize === size).map((n) => getLevelDef(n).poolSize));
      expect(kinds.size, `${size}x${size}`).toBeGreaterThan(1);
    }
    // and not monotone either
    expect(KINDS.some((kinds, i) => kinds > (KINDS[i + 1] ?? Infinity))).toBe(true);
  });

  it("is well-formed for every level at every difficulty", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const n of NUMBERS) {
        const level = resolveLevel(n, difficulty);
        const where = `${difficulty} L${n}`;
        expect(level.number, where).toBe(n);
        expect(level.difficulty, where).toBe(difficulty);
        expect(level.gridSize, where).toBe(getLevelDef(n).gridSize);
        expect(level.gridSize, where).toBeLessThanOrEqual(MAX_GRID_SIZE);
        expect(level.moveLimit, where).toBeGreaterThanOrEqual(8);
        expect([6, 7, 8], where).toContain(level.poolSize);
        expect(level.goals.length, where).toBeGreaterThanOrEqual(1);
        expect(level.goals.length, where).toBeLessThanOrEqual(3);
        for (const goal of level.goals) {
          const size = magnitudes({ ...level, goals: [goal] })[0];
          expect(Number.isInteger(size) && size > 0, `${where} ${goal.type}`).toBe(true);
          if (goal.type === "collect") expect(goal.slot).toBeLessThan(level.poolSize - 1); // never the custom tile
        }
        const [t1, t2, t3] = level.starThresholds;
        expect(t2 - t1, where).toBeGreaterThanOrEqual(STAR_STEP);
        expect(t3 - t2, where).toBeGreaterThanOrEqual(STAR_STEP);
        expect(t2 % STAR_STEP, where).toBe(0);
        expect(t3 % STAR_STEP, where).toBe(0);
        const target = scoreGoalTarget(level);
        expect(t1, where).toBe(target ?? 0);
        if (target !== null) expect(t2, where).toBeGreaterThan(target);
      }
    }
  });

  it("has a hint key only where the plan names one (L1, L3, L5, L6, L15)", () => {
    const withHint = NUMBERS.filter((n) => getLevelDef(n).hintKey !== undefined);
    expect(withHint).toEqual([1, 3, 5, 6, 15]);
  });

  it("uses all four objective types, and L20 combines them all", () => {
    const types = new Set(LEVEL_DEFS.flatMap((d) => d.goals.map((g) => g.type)));
    expect(types).toEqual(new Set(["score", "collect", "specials", "chain"]));
    expect(new Set(getLevelDef(20).goals.map((g) => g.type)).size).toBe(3);
    expect(getLevelDef(20).goals).not.toEqual(getLevelDef(1).goals);
  });

  it("keeps three collect targets distinct (slots 0, 1, 2) on the three-target level", () => {
    const slots = getLevelDef(16).goals.map((g) => (g.type === "collect" ? g.slot : -1));
    expect(slots).toEqual([0, 1, 2]);
  });
});

describe("resolveLevel: the difficulty rule", () => {
  it("makes Normal exactly the authored level", () => {
    for (const n of NUMBERS) {
      const def = getLevelDef(n);
      const level = resolveLevel(n, "normal");
      expect(level.moveLimit).toBe(def.moves);
      expect(level.goals).toEqual(def.goals);
      expect(level.starThresholds.slice(1)).toEqual([def.twoStar, def.threeStar]);
    }
  });

  it("orders every lever the way a player expects: Easy has more moves, lower goals and lower star lines", () => {
    for (const n of NUMBERS) {
      const [easy, normal, hard] = DIFFICULTIES.map((d) => resolveLevel(n, d));
      const where = `L${n}`;
      expect(easy.moveLimit, where).toBeGreaterThanOrEqual(normal.moveLimit);
      expect(normal.moveLimit, where).toBeGreaterThanOrEqual(hard.moveLimit);
      expect(easy.moveLimit, where).toBeGreaterThan(hard.moveLimit);

      magnitudes(normal).forEach((value, i) => {
        expect(magnitudes(easy)[i], `${where} goal ${i}`).toBeLessThanOrEqual(value);
        expect(value, `${where} goal ${i}`).toBeLessThanOrEqual(magnitudes(hard)[i]);
      });

      for (const line of [1, 2] as const) {
        expect(easy.starThresholds[line], `${where} star line ${line + 1}`).toBeLessThanOrEqual(normal.starThresholds[line]);
        expect(normal.starThresholds[line], `${where} star line ${line + 1}`).toBeLessThanOrEqual(hard.starThresholds[line]);
      }
    }
  });

  it("never lets a lowered goal swallow a lowered star line: each line is at least one step above the last", () => {
    // Easy scales the goal (x0.8) and the lines (x0.65) by different amounts: raw, L15's 2-star line
    // would be 750, under its own 800 goal. The resolver lifts it to one step over the goal instead.
    expect(PROFILES.easy.stars(getLevelDef(15).twoStar)).toBe(700);
    expect(resolveLevel(15, "easy").starThresholds).toEqual([800, 850, 900]);
    expect(resolveLevel(11, "easy").starThresholds).toEqual([700, 750, 1000]);
    // Normal is authored with the same gap, and Hard's lines only ever move up with its goal
    for (const n of NUMBERS) {
      const [, two] = resolveLevel(n, "normal").starThresholds;
      const target = scoreGoalTarget(resolveLevel(n, "normal"));
      if (target !== null) expect(two - target, `L${n}`).toBeGreaterThanOrEqual(STAR_STEP);
    }
  });

  it("keeps the same goal types, board size, pool size and chapter across difficulties", () => {
    for (const n of NUMBERS) {
      const [easy, normal, hard] = DIFFICULTIES.map((d) => resolveLevel(n, d));
      for (const other of [easy, hard]) {
        expect(other.goals.map((g) => g.type)).toEqual(normal.goals.map((g) => g.type));
        expect(other.gridSize).toBe(normal.gridSize);
        expect(other.poolSize).toBe(normal.poolSize);
        expect(other.chapter).toBe(normal.chapter);
      }
    }
  });

  // The plan's tables (moves, goals, 2-star / 3-star lines), transcribed. `easy`/`hard` are derived
  // by the profile rules, so this pins every one of the 40 derived levels.
  const TABLE: [number, string, string][] = [
    // L, easy [moves goals 2* 3*], hard [...]
    [1, "29 S950 1450 2000", "22 S1300 2500 3350"],
    [2, "24 S1200 1250 1800", "18 S1650 2150 3100"],
    [3, "24 K1 950 1450", "18 K2 1600 2500"],
    [4, "22 S700 750 1250", "16 S1000 1250 2100"],
    [5, "20 C14 1300 1900", "14 C20 2200 3250"],
    [6, "22 S750+X2 800 1200", "16 S1050+X3 1200 2050"],
    [7, "20 S1100 1150 1550", "14 S1500 1700 2600"],
    [8, "22 S700+K1 850 1250", "16 S1000+K2 1450 2150"],
    [9, "27 C10+C10 1150 1750", "20 C14+C14 1950 2950"],
    [10, "24 S1700+X2 1750 2400", "18 S2300+X3 2800 4050"],
    [11, "18 S700 750 1000", "13 S950 1050 1700"],
    [12, "24 S900+K1 950 1350", "18 S1250+K2 1500 2250"],
    [13, "20 C16 1050 1450", "14 C22 1750 2500"],
    [14, "24 S1100+X2 1150 1550", "18 S1550+X3 1750 2600"],
    [15, "24 S800 850 900", "18 S1100 1150 1550"],
    [16, "28 C11+C11+C11 1000 1350", "21 C15+C15+C15 1650 2300"],
    [17, "27 S900+K1 950 1250", "20 S1250+K2 1450 2150"],
    [18, "24 S800+X2 850 1000", "18 S1100+X3 1200 1650"],
    [19, "24 C12+C12+K1 1050 1600", "18 C17+C17+K2 1800 2700"],
    [20, "32 S1250+K1+X2 1300 1450", "23 S1700+K2+X3 1850 2400"],
  ];

  it.each(TABLE)("L%i matches the plan's Easy and Hard rows", (n, easyRow, hardRow) => {
    const line = (difficulty: Difficulty) => {
      const level = resolveLevel(n, difficulty);
      return `${level.moveLimit} ${describeGoals(level.goals)} ${level.starThresholds[1]} ${level.starThresholds[2]}`;
    };
    expect(line("easy")).toBe(easyRow);
    expect(line("hard")).toBe(hardRow);
  });

  it("pins the authored Normal values of L1, L7 and L20", () => {
    const l1 = resolveLevel(1, "normal");
    expect([l1.moveLimit, describeGoals(l1.goals), ...l1.starThresholds]).toEqual([24, "S1200", 1200, 2250, 3050]);
    const l7 = resolveLevel(7, "normal");
    expect([l7.moveLimit, describeGoals(l7.goals), ...l7.starThresholds]).toEqual([16, "S1350", 1350, 1550, 2350]);
    const l20 = resolveLevel(20, "normal");
    expect([l20.moveLimit, describeGoals(l20.goals), ...l20.starThresholds]).toEqual([
      26,
      "S1550+K2+X3",
      1550,
      1700,
      2200,
    ]);
  });
});

describe("parseLevelNumber", () => {
  it("accepts whole numbers 1-20 only", () => {
    expect(parseLevelNumber("1")).toBe(1);
    expect(parseLevelNumber("20")).toBe(20);
    for (const bad of ["0", "21", "-1", "1.5", "abc", "", "007x", undefined, null, 5]) {
      expect(parseLevelNumber(bad)).toBeNull();
    }
    expect(parseLevelNumber(["7", "9"])).toBe(7);
  });
});

describe("stars", () => {
  it("counts the thresholds a score reaches", () => {
    const t = resolveLevel(1, "normal").starThresholds;
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

  it("never grades a victory below one star, even on a level with no score goal", () => {
    const collectLevel = resolveLevel(5, "normal");
    expect(collectLevel.starThresholds[0]).toBe(0);
    expect(starsForVictory(0, collectLevel.starThresholds)).toBe(1);
    expect(starsForVictory(10, [999, 2000, 3000])).toBe(1); // a hand-made line above the score
    expect(starsForVictory(3000, [999, 2000, 3000])).toBe(3);
  });
});
