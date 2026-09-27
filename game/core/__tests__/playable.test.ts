import { describe, expect, it } from "vitest";
import { cloneBoard, generateBoard, hasValidMove } from "../board";
import { hasMatch } from "../matcher";
import { constructPlayable, ensurePlayable, regenerateInPlace, rerollCharacters } from "../playable";
import { attemptSwap } from "../resolver";
import { createRng } from "../rng";
import type { Board, Rng } from "../types";
import { boardFrom, boardIsFull, poolOf } from "./helpers";

/** The diagonal 3-colour pattern: no swap of neighbours can ever line up three. */
function diagonalDead(rows = 8, cols = 8): string[] {
  const ids = ["a", "b", "c"];
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => ids[(r + c) % 3]).join(""));
}

/** A dead board of two colours in a checkerboard: nothing can ever make three. */
function checkerDead(): string[] {
  return Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r + c) % 2 ? "a" : "b")).join(""));
}

const playable = (board: Board) => !hasMatch(board) && hasValidMove(board);
const uids = (board: Board) => board.flat().map((t) => t!.uid).sort((a, b) => a - b);

describe("ensurePlayable", () => {
  it("does nothing to a board that already has a move", () => {
    const board = generateBoard(8, 8, poolOf(7), createRng(1));
    const before = JSON.stringify(board);
    expect(ensurePlayable(board, poolOf(7), createRng(2))).toEqual({ method: "none" });
    expect(JSON.stringify(board)).toBe(before);
  });

  it("repairs dead boards of several sizes, and tier 1 keeps every tile and its special", () => {
    for (const [rows, cols] of [
      [4, 4],
      [6, 6],
      [7, 7],
      [8, 8],
    ]) {
      for (let seed = 1; seed <= 10; seed++) {
        const board = boardFrom(diagonalDead(rows, cols), { "1,1": "wrapped", "2,3": "super" });
        expect(hasValidMove(board)).toBe(false);
        const before = uids(board);
        const wrapped = board[1][1]!.uid;

        const { method } = ensurePlayable(board, poolOf(7), createRng(seed));
        expect(method, `${rows}x${cols} seed ${seed}`).not.toBe("none");
        expect(playable(board), `${rows}x${cols} seed ${seed}`).toBe(true);
        expect(boardIsFull(board)).toBe(true);
        if (method === "shuffle") {
          expect(uids(board)).toEqual(before);
          const at = board.flat().find((t) => t!.uid === wrapped)!;
          expect(at.special).toBe("wrapped");
        }
      }
    }
  });

  it("is deterministic for a fixed seed: same method, same board", () => {
    const run = () => {
      const board = boardFrom(diagonalDead());
      const { method } = ensurePlayable(board, poolOf(7), createRng(99));
      return { method, ids: board.map((r) => r.map((t) => t!.characterId)) };
    };
    expect(run()).toEqual(run());
  });

  it("is bounded: even a degenerate RNG that always returns 0 ends on a playable board", () => {
    const zero: Rng = () => 0;
    for (const size of [6, 7, 8]) {
      const board = boardFrom(diagonalDead());
      ensurePlayable(board, poolOf(size), zero);
      expect(playable(board), `pool ${size}`).toBe(true);
    }
  });
});

describe("rerollCharacters", () => {
  it("keeps uid and special, redraws characters from the pool", () => {
    const board = boardFrom(checkerDead(), { "0,0": "striped-row" });
    const first = board[0][0]!.uid;
    const before = uids(board);
    expect(rerollCharacters(board, poolOf(7), createRng(4))).toBe(true);
    expect(uids(board)).toEqual(before);
    expect(board.flat().find((t) => t!.uid === first)!.special).toBe("striped-row");
    expect(playable(board)).toBe(true);
  });

  it("refuses a pool with fewer than three characters", () => {
    expect(rerollCharacters(boardFrom(checkerDead()), poolOf(2), createRng(1))).toBe(false);
  });
});

describe("constructPlayable", () => {
  it("needs no randomness: identical output every time", () => {
    const make = () => {
      const board = boardFrom(diagonalDead());
      expect(constructPlayable(board, poolOf(7))).toBe(true);
      return board.map((r) => r.map((t) => t!.characterId));
    };
    expect(make()).toEqual(make());
  });

  it("succeeds for pools of 4 to 8 and keeps uid + special", () => {
    for (const size of [4, 5, 6, 7, 8]) {
      const board = boardFrom(diagonalDead(), { "3,3": "wrapped" });
      const before = uids(board);
      expect(constructPlayable(board, poolOf(size)), `pool ${size}`).toBe(true);
      expect(playable(board), `pool ${size}`).toBe(true);
      expect(uids(board)).toEqual(before);
      expect(board[3][3]!.special).toBe("wrapped");
    }
  });

  it("returns false with only three characters (no fourth for the motif)", () => {
    expect(constructPlayable(boardFrom(diagonalDead()), poolOf(3))).toBe(false);
  });

  it("returns false when no line of four cells exists", () => {
    expect(constructPlayable(boardFrom(["abc", "cab", "bca"]), poolOf(7))).toBe(false);
  });

  it("also works on a tall narrow board (vertical motif)", () => {
    const board = boardFrom(["abc", "bca", "cab", "abc", "bca", "cab"]);
    expect(constructPlayable(board, poolOf(7))).toBe(true);
    expect(playable(board)).toBe(true);
  });
});

describe("regenerateInPlace", () => {
  it("replaces the layout with a fresh playable one", () => {
    const board = boardFrom(diagonalDead());
    const old = new Set(uids(board));
    regenerateInPlace(board, poolOf(7), createRng(8));
    expect(playable(board)).toBe(true);
    expect(uids(board).every((uid) => !old.has(uid))).toBe(true);
  });
});

describe("generation guarantees a move for every pool size", () => {
  it("is playable for pools of 6, 7 and 8 over 200 seeds", () => {
    for (const size of [6, 7, 8]) {
      for (let seed = 1; seed <= 200; seed++) {
        const board = generateBoard(8, 8, poolOf(size), createRng(seed));
        expect(playable(board), `pool ${size} seed ${seed}`).toBe(true);
      }
    }
  });
});

describe("fuzz: random play on every pool size keeps the board playable", () => {
  const SPECIALS = ["striped-row", "striped-col", "wrapped", "super"] as const;

  it("stays full, run-free, with a valid move and unique uids, even with specials everywhere", () => {
    for (const size of [6, 7, 8]) {
      for (let seed = 1; seed <= 6; seed++) {
        const rng = createRng(seed * 31 + size);
        const pool = poolOf(size);
        const board = generateBoard(8, 8, pool, rng);
        // a special-heavy board: every fourth tile is a special of some kind
        board.flat().forEach((tile, i) => {
          if (i % 4 === 0) tile!.special = SPECIALS[(i / 4) % 4];
        });
        for (let move = 0; move < 60; move++) {
          expect(hasValidMove(cloneBoard(board))).toBe(true);
          let played = false;
          for (let row = 0; row < 8 && !played; row++) {
            for (let col = 0; col < 8 && !played; col++) {
              for (const to of [
                { row, col: col + 1 },
                { row: row + 1, col },
              ]) {
                if (played) break;
                played = attemptSwap(board, { row, col }, to, pool, rng).valid;
              }
            }
          }
          expect(played, `pool ${size} seed ${seed} move ${move}`).toBe(true);
          expect(boardIsFull(board)).toBe(true);
          expect(hasMatch(board)).toBe(false);
          expect(hasValidMove(board)).toBe(true);
          expect(new Set(uids(board)).size).toBe(64);
        }
      }
    }
  });
});
