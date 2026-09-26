import { describe, expect, it } from "vitest";
import {
  cloneBoard,
  findTileCellByUid,
  findValidMove,
  generateBoard,
  hasValidMove,
  reshuffleBoard,
} from "../board";
import { hasMatch } from "../matcher";
import { createRng, shuffle } from "../rng";
import { boardFrom, TEST_POOL, tileAt } from "./helpers";

// Diagonal 3-colour pattern: no swap of neighbours can ever line up three.
const DEAD_BOARD = ["abca", "bcab", "cabc", "abca"];

describe("createRng / shuffle", () => {
  it("is reproducible for a given seed", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
  });

  it("differs across seeds and stays within [0, 1)", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toEqual(b());
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("shuffle returns a permutation and does not mutate its input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, createRng(7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});

describe("hasValidMove", () => {
  it("is false on a dead board", () => {
    expect(hasValidMove(boardFrom(DEAD_BOARD))).toBe(false);
    expect(findValidMove(boardFrom(DEAD_BOARD))).toBeNull();
  });

  it("is true when one swap completes a run, and reports that swap", () => {
    const board = boardFrom(["xaxx", "bcdb", "cabc", "abca"]);
    expect(hasValidMove(board)).toBe(true);
    const move = findValidMove(board)!;
    expect(move).toEqual({ a: { row: 0, col: 0 }, b: { row: 0, col: 1 } });
  });

  it("does not mutate the board it inspects", () => {
    const board = boardFrom(["xaxx", "bcdb", "cabc", "abca"]);
    const before = JSON.stringify(board);
    hasValidMove(board);
    expect(JSON.stringify(board)).toBe(before);
  });
});

describe("generateBoard", () => {
  it("produces full boards with no run and at least one valid move, across many seeds", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createRng(seed);
      const board = generateBoard(8, 8, TEST_POOL, rng);
      expect(board).toHaveLength(8);
      expect(board.every((row) => row.length === 8 && row.every((t) => t !== null))).toBe(true);
      expect(hasMatch(board)).toBe(false);
      expect(hasValidMove(board)).toBe(true);
    }
  });

  it("only uses characters from the pool", () => {
    const pool = TEST_POOL.slice(0, 4);
    const board = generateBoard(8, 8, pool, createRng(5));
    const allowed = new Set(pool.map((p) => p.id));
    expect(board.flat().every((t) => allowed.has(t!.characterId))).toBe(true);
  });

  it("rejects pools too small to avoid runs", () => {
    expect(() => generateBoard(8, 8, TEST_POOL.slice(0, 2), createRng(1))).toThrow();
  });
});

describe("reshuffleBoard", () => {
  it("turns a dead board into one with no run and a valid move, for many seeds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const board = generateBoard(8, 8, TEST_POOL.slice(0, 3), createRng(seed));
      // force a dead layout with the same tile objects: diagonal pattern
      const flat = board.flat();
      const ids = ["a", "b", "c"];
      flat.forEach((tile, i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        tile!.characterId = ids[(row + col) % 3];
      });
      expect(hasValidMove(board)).toBe(false);

      const ok = reshuffleBoard(board, createRng(seed + 1000));
      expect(ok).toBe(true);
      expect(hasMatch(board)).toBe(false);
      expect(hasValidMove(board)).toBe(true);
    }
  });

  it("keeps every tile (uid) and its special; tiles only move", () => {
    const board = boardFrom(["abca".repeat(2), "bcab".repeat(2), "cabc".repeat(2), "abca".repeat(2)], {
      "1,1": "wrapped",
    });
    const wrapped = tileAt(board, 1, 1);
    const before = board.flat().map((t) => t!.uid).sort((x, y) => x - y);
    const ok = reshuffleBoard(board, createRng(3));
    expect(ok).toBe(true);
    const after = board.flat().map((t) => t!.uid).sort((x, y) => x - y);
    expect(after).toEqual(before);
    const cell = findTileCellByUid(board, wrapped.uid);
    expect(cell).not.toBeNull();
    expect(board[cell!.row][cell!.col]!.special).toBe("wrapped");
  });

  it("is deterministic for a fixed seed", () => {
    const make = () => boardFrom(["abca".repeat(2), "bcab".repeat(2), "cabc".repeat(2), "abca".repeat(2)]);
    const a = make();
    const b = cloneBoard(a);
    reshuffleBoard(a, createRng(42));
    reshuffleBoard(b, createRng(42));
    expect(a.map((r) => r.map((t) => t!.characterId))).toEqual(
      b.map((r) => r.map((t) => t!.characterId))
    );
  });

  it("reports failure (rather than looping forever) when no arrangement can work", () => {
    const board = boardFrom(["ab", "ba"]);
    expect(reshuffleBoard(board, createRng(1))).toBe(false);
  });
});

describe("findTileCellByUid", () => {
  it("finds a tile by identity and returns null once it is gone", () => {
    const board = boardFrom(["abc", "def"]);
    const tile = tileAt(board, 1, 2);
    expect(findTileCellByUid(board, tile.uid)).toEqual({ row: 1, col: 2 });
    board[1][2] = null;
    expect(findTileCellByUid(board, tile.uid)).toBeNull();
  });
});
