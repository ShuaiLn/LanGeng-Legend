import { beforeEach, describe, expect, it, vi } from "vitest";
import * as boardModule from "../board";
import { hasValidMove } from "../board";
import { hasMatch } from "../matcher";
import { ensurePlayable } from "../playable";
import { createRng } from "../rng";
import type { Board, Rng } from "../types";
import { boardFrom, poolOf } from "./helpers";

// Forces the lower tiers of the repair ladder by making the tiers above them fail, so each rung is
// exercised on purpose instead of hoping a random board happens to need it. `board.ts` keeps its
// real generation code: only the two exports playable.ts calls are swapped.
vi.mock("../board", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../board")>();
  return { ...actual, permuteBoard: vi.fn(actual.permuteBoard), fillWithoutRuns: vi.fn(actual.fillWithoutRuns) };
});

const permute = vi.mocked(boardModule.permuteBoard);
const fill = vi.mocked(boardModule.fillWithoutRuns);
const realPermute = permute.getMockImplementation()!;
const realFill = fill.getMockImplementation()!;

// Six colours on a diagonal: no swap makes three, yet plenty of permutations of these tiles do.
const DIAGONAL = Array.from({ length: 8 }, (_, r) =>
  Array.from({ length: 8 }, (_, c) => "abcdef"[(r + c) % 6]).join("")
);
const dead = (): Board => boardFrom(DIAGONAL, { "2,2": "wrapped" });
const playable = (board: Board) => !hasMatch(board) && hasValidMove(board);

/** A grid no swap can ever fix, so the re-roll tier fails every attempt. */
const deadGrid = (rows: number, cols: number) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => "abc"[(r + c) % 3]));

beforeEach(() => {
  permute.mockReset().mockImplementation(realPermute);
  fill.mockReset().mockImplementation(realFill);
});

describe("the repair ladder, rung by rung", () => {
  it("tier 1 (shuffle) is tried first and, when it works, nothing else runs", () => {
    const board = dead();
    expect(ensurePlayable(board, poolOf(7), createRng(1)).method).toBe("shuffle");
    expect(permute).toHaveBeenCalledTimes(1);
    expect(fill).not.toHaveBeenCalled();
    expect(playable(board)).toBe(true);
  });

  it("tier 2 (reroll) takes over when no permutation of the tiles works, and keeps uid + special", () => {
    permute.mockImplementation(() => false);
    const board = dead();
    const wrapped = board[2][2]!.uid;
    expect(ensurePlayable(board, poolOf(7), createRng(1)).method).toBe("reroll");
    expect(playable(board)).toBe(true);
    expect(board.flat().find((t) => t!.uid === wrapped)!.special).toBe("wrapped");
  });

  it("tier 3 (construct) takes over when re-rolling keeps failing, without touching the RNG", () => {
    permute.mockImplementation(() => false);
    fill.mockImplementation((rows, cols) => deadGrid(rows, cols));
    let draws = 0;
    const rng: Rng = () => {
      draws++;
      return 0.5;
    };
    const board = dead();
    const wrapped = board[2][2]!.uid;
    expect(ensurePlayable(board, poolOf(7), rng).method).toBe("construct");
    expect(fill).toHaveBeenCalledTimes(300); // exactly the re-roll budget, then it gave up
    expect(draws).toBe(0);
    expect(playable(board)).toBe(true);
    expect(board.flat().find((t) => t!.uid === wrapped)!.special).toBe("wrapped");
  });

  it("tier 4 (regenerate) is the last resort: with only three characters no motif exists", () => {
    permute.mockImplementation(() => false);
    fill.mockImplementation((rows, cols) => deadGrid(rows, cols));
    const board = dead();
    const old = new Set(board.flat().map((t) => t!.uid));
    expect(ensurePlayable(board, poolOf(3), createRng(4)).method).toBe("regenerate");
    expect(playable(board)).toBe(true);
    expect(board.flat().every((t) => !old.has(t!.uid))).toBe(true); // brand-new tiles
  });

  it("walks the whole ladder within a bounded amount of random work", () => {
    permute.mockImplementation(() => false);
    fill.mockImplementation((rows, cols) => deadGrid(rows, cols));
    let draws = 0;
    const inner = createRng(9);
    const rng: Rng = () => {
      draws++;
      return inner();
    };
    const board = dead();
    ensurePlayable(board, poolOf(3), rng);
    expect(draws).toBeLessThan(50_000); // regeneration only: <= 500 attempts of ~64 draws
    expect(playable(board)).toBe(true);
  });
});
