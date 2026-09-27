import { describe, expect, it } from "vitest";
import type { Goal } from "../../config/levels";
import { applyClear, applySpecialSpawn, createGoals, goalsMet, goalViews } from "../goals";

const POOL = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }, { id: "f" }];
const ctx = (score = 0, maxCombo = 0) => ({ score, maxCombo });
const tiles = (...ids: string[]) => ids.map((characterId) => ({ characterId }));

describe("score goal", () => {
  it("follows the session score and is met at the target, not before", () => {
    const state = createGoals([{ type: "score", target: 500 }], POOL);
    expect(goalsMet(state, ctx(499))).toBe(false);
    expect(goalsMet(state, ctx(500))).toBe(true);
    expect(goalViews(state, ctx(250))).toEqual([{ type: "score", current: 250, target: 500, done: false }]);
    expect(goalViews(state, ctx(900))[0]).toMatchObject({ current: 500, done: true }); // clamped for display
  });
});

describe("collect goal", () => {
  const goals: Goal[] = [{ type: "collect", slot: 1, count: 4 }];

  it("points at the character in its pool slot and counts only that character", () => {
    const state = createGoals(goals, POOL);
    expect(state.collectIds).toEqual(["b"]);
    expect(applyClear(state, tiles("a", "c", "d"))).toBe(false); // nothing of "b"
    expect(applyClear(state, tiles("b", "b", "a"))).toBe(true);
    expect(goalViews(state, ctx())[0]).toMatchObject({ current: 2, target: 4, characterId: "b", done: false });
  });

  it("counts every tile of the target that a clear removes, bystanders swept by a special included", () => {
    const state = createGoals(goals, POOL);
    applyClear(state, tiles("b", "b", "b", "b", "b")); // a 3-match plus two swept up
    expect(goalsMet(state, ctx())).toBe(true);
    expect(goalViews(state, ctx())[0].current).toBe(4); // display clamps at the target
  });

  it("keeps two collect goals separate and needs both", () => {
    const state = createGoals(
      [
        { type: "collect", slot: 0, count: 2 },
        { type: "collect", slot: 1, count: 2 },
      ],
      POOL
    );
    applyClear(state, tiles("a", "a", "a"));
    expect(goalsMet(state, ctx())).toBe(false);
    applyClear(state, tiles("b", "b"));
    expect(goalsMet(state, ctx())).toBe(true);
  });

  it("a slot beyond the pool has no target character and can never be met", () => {
    const state = createGoals([{ type: "collect", slot: 2, count: 1 }], [{ id: "a" }]);
    expect(state.collectIds).toEqual([null]);
    expect(applyClear(state, tiles("a"))).toBe(false);
    expect(goalsMet(state, ctx())).toBe(false);
  });
});

describe("specials goal", () => {
  it("counts specials created, and only when the level asks for them", () => {
    const state = createGoals([{ type: "specials", count: 2 }], POOL);
    expect(applySpecialSpawn(state)).toBe(true);
    expect(goalsMet(state, ctx())).toBe(false);
    expect(applySpecialSpawn(state)).toBe(true);
    expect(goalsMet(state, ctx())).toBe(true);

    const scoreOnly = createGoals([{ type: "score", target: 100 }], POOL);
    expect(applySpecialSpawn(scoreOnly)).toBe(false);
    expect(scoreOnly.specialsMade).toBe(0);
  });
});

describe("chain goal", () => {
  it("is met once a chain of that length has been reached, and stays met", () => {
    const state = createGoals([{ type: "chain", length: 3 }], POOL);
    expect(goalsMet(state, ctx(0, 2))).toBe(false);
    expect(goalsMet(state, ctx(0, 3))).toBe(true);
    expect(goalViews(state, ctx(0, 5))[0]).toMatchObject({ current: 3, target: 3, done: true });
  });
});

describe("several goals", () => {
  const goals: Goal[] = [
    { type: "score", target: 950 },
    { type: "specials", count: 2 },
    { type: "chain", length: 3 },
  ];

  it("needs every goal at once", () => {
    const state = createGoals(goals, POOL);
    applySpecialSpawn(state, 2);
    expect(goalsMet(state, ctx(950, 2))).toBe(false); // chain short
    expect(goalsMet(state, ctx(900, 3))).toBe(false); // score short
    expect(goalsMet(state, ctx(950, 3))).toBe(true);
    expect(goalViews(state, ctx(950, 3)).map((v) => v.done)).toEqual([true, true, true]);
  });

  it("starts from zero for every new state (nothing carries between sessions)", () => {
    const first = createGoals(goals, POOL);
    applySpecialSpawn(first, 2);
    const second = createGoals(goals, POOL);
    expect(second.specialsMade).toBe(0);
    expect(second.collected).toEqual([0, 0, 0]);
  });

  it("a level with no goals is never met (it would otherwise clear on its first settle)", () => {
    expect(goalsMet(createGoals([], POOL), ctx(9999, 9))).toBe(false);
  });
});
