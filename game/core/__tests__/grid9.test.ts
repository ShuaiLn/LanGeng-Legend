import { describe, expect, it } from "vitest";
import { boardCols, boardRows } from "../cells";
import { generateBoard, hasValidMove } from "../board";
import { findRuns, hasMatch } from "../matcher";
import { ensurePlayable } from "../playable";
import { attemptSwap, resolveSpecialActivation, type ResolutionStep } from "../resolver";
import { createRng, pickRandom } from "../rng";
import type { Board } from "../types";
import { listValidMoves } from "./bots";
import { boardFrom, boardIsFull, cell, keys, poolOf } from "./helpers";

/**
 * The engine takes `rows` / `cols` everywhere; levels now choose 8 or 9 (`gridSize`), so the 9x9 board
 * gets the same guarantees the 8x8 one has always had: it starts clean and playable, a move resolves
 * and refills it, and a dead board is always repaired.
 */

const SIZE = 9;
const playable = (board: Board) => !hasMatch(board) && hasValidMove(board);
const uidsOf = (board: Board) => board.flat().map((tile) => tile!.uid);

/** The diagonal 3-colour pattern: no swap of neighbours can ever line up three. */
function diagonalDead(size = SIZE): string[] {
  const ids = ["a", "b", "c"];
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ids[(r + c) % 3]).join(""));
}

describe("a 9x9 board", () => {
  it("is generated square, full, without a starting match and with a move to make (every pool size, many seeds)", () => {
    for (const kinds of [6, 7, 8]) {
      for (let seed = 1; seed <= 60; seed++) {
        const board = generateBoard(SIZE, SIZE, poolOf(kinds), createRng(seed));
        const where = `${kinds} kinds, seed ${seed}`;
        expect(boardRows(board), where).toBe(SIZE);
        expect(boardCols(board), where).toBe(SIZE);
        expect(board.every((row) => row.length === SIZE), where).toBe(true);
        expect(boardIsFull(board), where).toBe(true);
        expect(findRuns(board), where).toEqual([]);
        expect(hasValidMove(board), where).toBe(true);
        expect(new Set(uidsOf(board)).size, where).toBe(SIZE * SIZE);
      }
    }
  });

  it("uses every character of the pool somewhere on the board", () => {
    for (const kinds of [6, 7, 8]) {
      const board = generateBoard(SIZE, SIZE, poolOf(kinds), createRng(kinds));
      expect(new Set(board.flat().map((tile) => tile!.characterId)).size, `${kinds} kinds`).toBe(kinds);
    }
  });

  it("is repaired by ensurePlayable when dead, for a spread of seeds and pool sizes (uids and specials travel on a shuffle)", () => {
    for (const kinds of [6, 7, 8]) {
      for (let seed = 1; seed <= 25; seed++) {
        const board = boardFrom(diagonalDead(), { "1,1": "wrapped", "4,5": "super" });
        expect(hasValidMove(board)).toBe(false);
        const before = uidsOf(board).sort((a, b) => a - b);
        const { method } = ensurePlayable(board, poolOf(kinds), createRng(seed));
        const where = `${kinds} kinds, seed ${seed}, ${method}`;
        expect(method, where).not.toBe("none");
        expect(playable(board), where).toBe(true);
        expect(boardIsFull(board), where).toBe(true);
        expect(board.length, where).toBe(SIZE);
        if (method === "shuffle") expect(uidsOf(board).sort((a, b) => a - b), where).toEqual(before);
      }
    }
  });

  it("leaves a healthy 9x9 board alone", () => {
    const board = generateBoard(SIZE, SIZE, poolOf(7), createRng(3));
    const before = JSON.stringify(board);
    expect(ensurePlayable(board, poolOf(7), createRng(4))).toEqual({ method: "none" });
    expect(JSON.stringify(board)).toBe(before);
  });

  it("plays a whole game of random moves: every move clears, falls and refills, the board is always full, clean and playable", () => {
    for (const kinds of [6, 7, 8]) {
      const pool = poolOf(kinds);
      const rng = createRng(100 + kinds);
      const board = generateBoard(SIZE, SIZE, pool, rng);
      const seen = new Set<ResolutionStep["type"]>();
      let deepestChain = 0;
      let refilled = 0;
      let moves = 0;

      for (; moves < 120; moves++) {
        const options = listValidMoves(board);
        expect(options.length, `${kinds} kinds, move ${moves}`).toBeGreaterThan(0);
        const move = pickRandom(options, rng);
        const swap = attemptSwap(board, move.a, move.b, pool, rng);
        expect(swap.valid).toBe(true);
        if (!swap.valid) return;
        for (const step of swap.steps) {
          seen.add(step.type);
          if (step.type === "clear") deepestChain = Math.max(deepestChain, step.comboIndex + 1);
          if (step.type === "refill") refilled += step.spawns.length;
        }
        const where = `${kinds} kinds, move ${moves}`;
        expect(boardIsFull(board), where).toBe(true);
        expect(board.length, where).toBe(SIZE);
        expect(board.every((row) => row.length === SIZE), where).toBe(true);
        expect(playable(board), where).toBe(true);
        expect(new Set(uidsOf(board)).size, where).toBe(SIZE * SIZE); // a refilled tile never reuses a uid
      }

      expect(seen, `${kinds} kinds`).toContain("clear");
      expect(seen, `${kinds} kinds`).toContain("fall");
      expect(seen, `${kinds} kinds`).toContain("refill");
      expect(refilled, `${kinds} kinds`).toBeGreaterThan(moves * 3); // every clear of 3+ is refilled
      expect(deepestChain, `${kinds} kinds`).toBeGreaterThanOrEqual(2); // cascades happen on a 9x9 board too
    }
  });

  it("special tiles sweep the board's own size: a striped tile clears nine tiles, a wrapped one a 3x3 block, a super one every tile of its character", () => {
    const pool = poolOf(7);
    const ids = "abcdefg";
    const grid = Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => ids[(r * 2 + c) % 7]).join(""));
    const at = (row: number, col: number) => `${row},${col}`;

    const row = boardFrom(grid, { [at(4, 4)]: "striped-row" });
    const rowStep = resolveSpecialActivation(row, cell(4, 4), 0, pool, createRng(1), false).find((step) => step.type === "clear");
    expect(rowStep?.type === "clear" && rowStep.cleared.map((c) => c.cell.row)).toEqual(Array(SIZE).fill(4));
    expect(rowStep?.type === "clear" && rowStep.cleared).toHaveLength(SIZE);

    const col = boardFrom(grid, { [at(4, 8)]: "striped-col" }); // the last column: nothing is left over past it
    const colStep = resolveSpecialActivation(col, cell(4, 8), 0, pool, createRng(1), false).find((step) => step.type === "clear");
    expect(colStep?.type === "clear" && keys(colStep.cleared.map((c) => c.cell))).toEqual(
      Array.from({ length: SIZE }, (_, r) => at(r, 8)).sort()
    );

    const wrapped = boardFrom(grid, { [at(8, 8)]: "wrapped" }); // a corner: the block is cut to 2x2
    const wrappedStep = resolveSpecialActivation(wrapped, cell(8, 8), 0, pool, createRng(1), false).find((step) => step.type === "clear");
    expect(wrappedStep?.type === "clear" && keys(wrappedStep.cleared.map((c) => c.cell))).toEqual(["7,7", "7,8", "8,7", "8,8"]);

    const sup = boardFrom(grid, { [at(0, 0)]: "super" });
    const characterId = sup[0][0]!.characterId;
    const expected = sup.flat().filter((tile) => tile!.characterId === characterId).length;
    const supStep = resolveSpecialActivation(sup, cell(0, 0), 0, pool, createRng(1), false).find((step) => step.type === "clear");
    expect(supStep?.type === "clear" && supStep.cleared).toHaveLength(expected);
  });

  it("every step of a resolution keeps to the 9x9 grid (cells inside 0..8, refills start above the board)", () => {
    const pool = poolOf(7);
    const rng = createRng(77);
    const board = generateBoard(SIZE, SIZE, pool, rng);
    for (let n = 0; n < 60; n++) {
      const move = pickRandom(listValidMoves(board), rng);
      const swap = attemptSwap(board, move.a, move.b, pool, rng);
      if (!swap.valid) throw new Error("a listed move must be valid");
      const inside = (c: { row: number; col: number }) => c.row >= 0 && c.row < SIZE && c.col >= 0 && c.col < SIZE;
      for (const step of swap.steps) {
        if (step.type === "clear") expect(step.cleared.every((c) => inside(c.cell))).toBe(true);
        if (step.type === "fall") expect(step.moves.every((m) => inside(m.from) && inside(m.to) && m.to.row > m.from.row)).toBe(true);
        if (step.type === "refill") expect(step.spawns.every((sp) => inside(sp.cell) && sp.startRow < 0 && sp.startRow <= sp.cell.row)).toBe(true);
      }
    }
  });
});
