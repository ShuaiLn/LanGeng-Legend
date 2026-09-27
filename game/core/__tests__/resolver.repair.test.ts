import { beforeEach, describe, expect, it, vi } from "vitest";
import * as playableModule from "../playable";
import { attemptSwap, resolveSpecialActivation, type ResolutionStep } from "../resolver";
import { createRng } from "../rng";
import { boardFrom, cell, TEST_POOL } from "./helpers";

// The resolver's contract with the repair ladder: it asks for a repair after every settled loop,
// reports what the ladder did as a `reshuffle` step, and can be told not to (the celebration).
vi.mock("../playable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../playable")>();
  return { ...actual, ensurePlayable: vi.fn(actual.ensurePlayable) };
});

const ensure = vi.mocked(playableModule.ensurePlayable);
const realEnsure = ensure.getMockImplementation()!;

beforeEach(() => {
  ensure.mockReset().mockImplementation(realEnsure);
});

const reshuffles = (steps: ResolutionStep[]) => steps.filter((s) => s.type === "reshuffle");

describe("resolver -> repair ladder", () => {
  const rows = ["xaxbc", "dxfgh", "ijklm", "nopqr", "stuvw"];

  it("reports a reshuffle step carrying the repair method and a snapshot of the repaired board", () => {
    ensure.mockImplementation(() => ({ method: "construct" }));
    const board = boardFrom(rows);
    const result = attemptSwap(board, cell(0, 1), cell(1, 1), TEST_POOL, createRng(5));
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    const [step] = reshuffles(result.steps);
    expect(step).toMatchObject({ type: "reshuffle", method: "construct" });
    expect(result.steps[result.steps.length - 1]).toBe(step); // always the last thing that happens
    if (step.type === "reshuffle") {
      expect(step.board).not.toBe(board); // a clone, so playback never sees later mutations
      expect(step.board.map((r) => r.map((t) => t!.uid))).toEqual(board.map((r) => r.map((t) => t!.uid)));
    }
  });

  it("adds no step when the board still has a move (method none)", () => {
    ensure.mockImplementation(() => ({ method: "none" }));
    const board = boardFrom(rows);
    const result = attemptSwap(board, cell(0, 1), cell(1, 1), TEST_POOL, createRng(5));
    expect(result.valid && reshuffles(result.steps)).toEqual([]);
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("reports every repair method other than none as a reshuffle step", () => {
    for (const method of ["shuffle", "reroll", "construct", "regenerate"] as const) {
      ensure.mockReset().mockImplementation(() => ({ method }));
      const board = boardFrom(rows);
      const result = attemptSwap(board, cell(0, 1), cell(1, 1), TEST_POOL, createRng(3));
      expect(result.valid).toBe(true);
      const steps = result.valid ? result.steps : [];
      expect(reshuffles(steps).map((s) => (s.type === "reshuffle" ? s.method : ""))).toEqual([method]);
    }
  });

  it("the celebration path (ensure = false) never asks for a repair", () => {
    ensure.mockImplementation(() => ({ method: "construct" }));
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "2,2": "wrapped" });
    const steps = resolveSpecialActivation(board, cell(2, 2), 0, TEST_POOL, createRng(1), false);
    expect(reshuffles(steps)).toEqual([]);
    expect(ensure).not.toHaveBeenCalled();
  });

  it("a special activation repairs by default, like any other resolution", () => {
    ensure.mockImplementation(() => ({ method: "shuffle" }));
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "2,2": "wrapped" });
    const steps = resolveSpecialActivation(board, cell(2, 2), 0, TEST_POOL, createRng(1));
    expect(reshuffles(steps)).toHaveLength(1);
  });
});
