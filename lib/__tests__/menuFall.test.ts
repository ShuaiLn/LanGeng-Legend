import { describe, expect, it } from "vitest";
import { CHARACTER_LIBRARY } from "@/game/config/characters";
import { fallSpecs, FALL_LIMITS, interleavedLanes } from "../menuFall";

const IDS = CHARACTER_LIBRARY.map((c) => c.id);

describe("fallSpecs", () => {
  it("makes exactly the number asked for, and the menu shows fourteen (nine on a phone), not many more", () => {
    expect(fallSpecs(14, 1, IDS)).toHaveLength(14);
    expect(fallSpecs(9, 1, IDS)).toHaveLength(9);
    expect(fallSpecs(0, 1, IDS)).toEqual([]);
    expect(fallSpecs(5, 1, [])).toEqual([]);
  });

  it("is deterministic: same seed, same specs (so server and client markup match)", () => {
    expect(fallSpecs(14, 20260926, IDS)).toEqual(fallSpecs(14, 20260926, IDS));
    expect(fallSpecs(14, 1, IDS)).not.toEqual(fallSpecs(14, 2, IDS));
  });

  it("keeps every value inside its limits", () => {
    for (const seed of [1, 2, 3, 20260926, 99999]) {
      for (const spec of fallSpecs(14, seed, IDS)) {
        expect(spec.left).toBeGreaterThanOrEqual(0);
        expect(spec.left).toBeLessThanOrEqual(FALL_LIMITS.leftMax);
        expect(spec.size).toBeGreaterThanOrEqual(FALL_LIMITS.size.min);
        expect(spec.size).toBeLessThanOrEqual(FALL_LIMITS.size.max);
        expect(spec.duration).toBeGreaterThanOrEqual(FALL_LIMITS.duration.min);
        expect(spec.duration).toBeLessThanOrEqual(FALL_LIMITS.duration.max);
        expect(Math.abs(spec.rotate)).toBeLessThanOrEqual(FALL_LIMITS.rotate.max);
        expect(spec.rotate).not.toBe(0);
        expect(IDS).toContain(spec.id);
      }
    }
  });

  it("staggers the starts: every delay is <= 0 (already falling at first paint) and they are not all equal", () => {
    const specs = fallSpecs(14, 20260926, IDS);
    expect(specs.every((s) => s.delay <= 0)).toBe(true);
    expect(new Set(specs.map((s) => s.delay)).size).toBeGreaterThan(5);
    expect(specs.every((s) => -s.delay <= s.duration)).toBe(true);
  });

  it("uses each lane once and stays inside it, so the tiles spread across the width", () => {
    const specs = fallSpecs(14, 7, IDS);
    expect(specs.map((s) => s.lane).sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => i));
    for (const spec of specs) {
      const laneWidth = FALL_LIMITS.leftMax / 14;
      expect(spec.left).toBeGreaterThanOrEqual(spec.lane * laneWidth);
      expect(spec.left).toBeLessThanOrEqual((spec.lane + 1) * laneWidth);
    }
  });

  it("spreads any prefix too: the first nine (the phone set) do not clump on one side", () => {
    for (const seed of [1, 2, 3, 20260926]) {
      const lefts = fallSpecs(14, seed, IDS)
        .slice(0, 9)
        .map((s) => s.left)
        .sort((a, b) => a - b);
      expect(lefts[0]).toBeLessThan(25);
      expect(lefts[lefts.length - 1]).toBeGreaterThan(70);
      const gaps = lefts.slice(1).map((left, i) => left - lefts[i]);
      expect(Math.max(...gaps)).toBeLessThan(30); // no wide empty stretch
    }
  });

  it("never shows the same character in neighbouring lanes", () => {
    for (const seed of [1, 2, 3, 4, 5, 20260926]) {
      const byLane = fallSpecs(14, seed, IDS).sort((a, b) => a.lane - b.lane);
      for (let i = 1; i < byLane.length; i++) expect(byLane[i].id, `seed ${seed} lane ${i}`).not.toBe(byLane[i - 1].id);
    }
  });

  it("uses only characters it was given, and cycles through them when there are more lanes than characters", () => {
    const three = ["a", "b", "c"];
    const specs = fallSpecs(14, 3, three).sort((x, y) => x.lane - y.lane);
    expect(new Set(specs.map((s) => s.id))).toEqual(new Set(three));
    for (let i = 1; i < specs.length; i++) expect(specs[i].id).not.toBe(specs[i - 1].id);
  });
});

describe("interleavedLanes", () => {
  it("is a permutation of 0..n-1 for any n", () => {
    for (const n of [1, 2, 3, 5, 7, 10, 11, 12, 16]) {
      expect([...interleavedLanes(n)].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
});
