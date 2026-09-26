import { describe, expect, it } from "vitest";
import { cloneBoard, findTileCellByUid, findValidMove, generateBoard, hasValidMove } from "../board";
import { findMatches, hasMatch } from "../matcher";
import {
  applyGravity,
  attemptSwap,
  nextComboIndex,
  refillFromPool,
  resolveLoop,
  resolveSpecialActivation,
  type ClearStep,
  type ResolutionStep,
} from "../resolver";
import { createRng } from "../rng";
import { comboMultiplier, scorePass } from "../scoring";
import { boardFrom, boardIsFull, cell, keys, TEST_POOL, tileAt } from "./helpers";

function clearSteps(steps: ResolutionStep[]): ClearStep[] {
  return steps.filter((s): s is ClearStep => s.type === "clear");
}

describe("scoring", () => {
  it("scores a plain 3-match at 10 per tile", () => {
    const [cluster] = findMatches(boardFrom(["abcde", "fghij", "xxxlm", "nopqr", "stuvw"]));
    const cleared = new Set(cluster.cells.map((c) => c.row * 1000 + c.col));
    expect(scorePass([cluster], cleared, 0)).toBe(30);
  });

  it("applies the tier multiplier (line4 x1.5) and counts the surviving spawn tile as matched", () => {
    const [cluster] = findMatches(boardFrom(["xxxxa", "bcdef", "ghijk", "lmnop", "qrstu"]));
    const cleared = new Set(cluster.cells.map((c) => c.row * 1000 + c.col));
    expect(scorePass([cluster], cleared, 0)).toBe(60); // 4 tiles * 10 * 1.5
  });

  it("applies combo multiplier 1 + 0.5 * comboIndex", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(2);
    const [cluster] = findMatches(boardFrom(["abcde", "fghij", "xxxlm", "nopqr", "stuvw"]));
    const cleared = new Set(cluster.cells.map((c) => c.row * 1000 + c.col));
    expect(scorePass([cluster], cleared, 1)).toBe(45);
  });

  it("scores bystanders at a flat rate", () => {
    expect(scorePass([], new Set([1, 2, 3, 4]), 0)).toBe(40);
  });
});

describe("applyGravity / refillFromPool", () => {
  it("compacts each column downward and only reports tiles that moved", () => {
    const board = boardFrom(["abc", "def", "ghi"]);
    const a = tileAt(board, 0, 0);
    const d = tileAt(board, 1, 0);
    board[2][0] = null;
    const moves = applyGravity(board);
    expect(moves).toHaveLength(2);
    expect(board[2][0]).toBe(d);
    expect(board[1][0]).toBe(a);
    expect(board[0][0]).toBeNull();
    expect(moves.map((m) => m.uid).sort()).toEqual([a.uid, d.uid].sort());
  });

  it("refills every gap from the pool and stacks spawns above the board", () => {
    const board = boardFrom(["abc", "def", "ghi"]);
    board[0][1] = null;
    board[1][1] = null;
    const spawns = refillFromPool(board, TEST_POOL, createRng(1));
    expect(boardIsFull(board)).toBe(true);
    expect(spawns).toHaveLength(2);
    expect(spawns.map((s) => s.startRow).sort((a, b) => a - b)).toEqual([-2, -1]);
    const allowed = new Set(TEST_POOL.map((p) => p.id));
    expect(spawns.every((s) => allowed.has(s.tile.characterId))).toBe(true);
  });
});

describe("resolveLoop: special spawning", () => {
  it("a 4-in-a-row clears three tiles and leaves one striped tile (not swept up in the same pass)", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "xxxxu"]);
    const [cluster] = findMatches(board);
    const spawnTile = tileAt(board, cluster.spawnAt!.row, cluster.spawnAt!.col);
    const steps = resolveLoop(board, [cluster], TEST_POOL, createRng(11));

    const first = clearSteps(steps)[0];
    expect(first.cleared).toHaveLength(3);
    expect(first.cleared.map((c) => c.uid)).not.toContain(spawnTile.uid);
    expect(steps[1]).toMatchObject({
      type: "spawnSpecial",
      uid: spawnTile.uid,
      special: "striped-row",
    });
    expect(spawnTile.special).toBe("striped-row");
    expect(spawnTile.characterId).toBe("x"); // spawn keeps its character
  });

  it("a 5-in-a-row spawns a super that keeps the matched characterId", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "xxxxx"]);
    const [cluster] = findMatches(board);
    const steps = resolveLoop(board, [cluster], TEST_POOL, createRng(12));
    const first = clearSteps(steps)[0];
    expect(first.cleared).toHaveLength(4);
    expect(steps[1]).toMatchObject({ type: "spawnSpecial", special: "super" });
    expect(first.scoreDelta).toBe(100); // 5 tiles * 10 * 2
  });

  it("an L/T cluster spawns wrapped and clears the other tiles", () => {
    const board = boardFrom(["abcde", "fghij", "xklmn", "xopqr", "xxxst"]);
    const [cluster] = findMatches(board);
    const steps = resolveLoop(board, [cluster], TEST_POOL, createRng(13));
    expect(clearSteps(steps)[0].cleared).toHaveLength(4);
    expect(steps[1]).toMatchObject({ type: "spawnSpecial", special: "wrapped" });
  });
});

describe("resolveSpecialActivation", () => {
  it("striped-row clears its entire row", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "2,1": "striped-row" });
    const target = tileAt(board, 2, 1);
    const steps = resolveSpecialActivation(board, cell(2, 1), 0, TEST_POOL, createRng(1));
    const first = clearSteps(steps)[0];
    expect(keys(first.cleared.map((c) => c.cell))).toEqual(["2,0", "2,1", "2,2", "2,3", "2,4"]);
    expect(first.activated.map((a) => a.uid)).toEqual([target.uid]);
    expect(first.comboIndex).toBe(0);
    expect(first.scoreDelta).toBe(50); // 5 bystander-rate tiles
  });

  it("striped-col clears its entire column", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "1,3": "striped-col" });
    const steps = resolveSpecialActivation(board, cell(1, 3), 0, TEST_POOL, createRng(1));
    expect(keys(clearSteps(steps)[0].cleared.map((c) => c.cell))).toEqual([
      "0,3",
      "1,3",
      "2,3",
      "3,3",
      "4,3",
    ]);
  });

  it("wrapped clears the 3x3 around it, clipped at the board edge", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "2,2": "wrapped", "0,0": "wrapped" });
    const middle = resolveSpecialActivation(cloneBoard(board), cell(2, 2), 0, TEST_POOL, createRng(1));
    expect(clearSteps(middle)[0].cleared).toHaveLength(9);
    const corner = resolveSpecialActivation(board, cell(0, 0), 0, TEST_POOL, createRng(1));
    expect(clearSteps(corner)[0].cleared).toHaveLength(4);
  });

  it("super removes every tile of its own character (normal and special) and nothing else", () => {
    const board = boardFrom(["xabcd", "efxgh", "ijklx", "mnopq", "xrstu"], {
      "0,0": "super",
      "2,4": "striped-col", // an x tile that is special: it must chain
    });
    const steps = resolveSpecialActivation(board, cell(0, 0), 0, TEST_POOL, createRng(1));
    const first = clearSteps(steps)[0];
    const xCells = ["0,0", "1,2", "2,4", "4,0"];
    // the striped-col at (2,4) chains and sweeps column 4 too
    const expected = new Set([...xCells, "0,4", "1,4", "3,4", "4,4"]);
    expect(new Set(keys(first.cleared.map((c) => c.cell)))).toEqual(expected);
    expect(first.activated.map((a) => a.special).sort()).toEqual(["striped-col", "super"]);
  });

  it("chains through specials swept up as bystanders", () => {
    // striped-row on row 0 sweeps a wrapped tile at (0,3), which then clears its 3x3.
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], {
      "0,0": "striped-row",
      "0,3": "wrapped",
    });
    const steps = resolveSpecialActivation(board, cell(0, 0), 0, TEST_POOL, createRng(1));
    const first = clearSteps(steps)[0];
    // row 0 (5) + row 1 cols 2..4 (3) = 8
    expect(first.cleared).toHaveLength(8);
    expect(first.activated).toHaveLength(2);
  });

  it("never clears a cell twice even when effects overlap", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], {
      "2,2": "striped-row",
      "2,4": "striped-col",
    });
    const steps = resolveSpecialActivation(board, cell(2, 2), 0, TEST_POOL, createRng(1));
    const cleared = clearSteps(steps)[0].cleared;
    expect(new Set(keys(cleared.map((c) => c.cell))).size).toBe(cleared.length);
  });

  it("returns nothing for an empty cell and leaves the board unchanged", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"]);
    board[0][0] = null;
    const snapshot = JSON.stringify(board);
    expect(resolveSpecialActivation(board, cell(0, 0), 0, TEST_POOL, createRng(1))).toEqual([]);
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("refills the board completely after detonating", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "2,2": "wrapped" });
    resolveSpecialActivation(board, cell(2, 2), 0, TEST_POOL, createRng(1));
    expect(boardIsFull(board)).toBe(true);
  });

  it("continues the combo index it is given and can report the next one", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"], { "2,1": "striped-row" });
    const steps = resolveSpecialActivation(board, cell(2, 1), 3, TEST_POOL, createRng(1));
    const clears = clearSteps(steps);
    expect(clears[0].comboIndex).toBe(3);
    expect(clears[0].scoreDelta).toBe(Math.round(50 * (1 + 0.5 * 3)));
    expect(nextComboIndex(steps, 3)).toBe(clears[clears.length - 1].comboIndex + 1);
  });

  it("leaves a full, match-free board with a valid move once everything has settled", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed);
      const board = generateBoard(8, 8, TEST_POOL, rng);
      const target = tileAt(board, 3, 3);
      target.special = "wrapped";
      resolveSpecialActivation(board, cell(3, 3), 0, TEST_POOL, rng);
      expect(boardIsFull(board)).toBe(true);
      expect(hasMatch(board)).toBe(false);
      expect(hasValidMove(board)).toBe(true);
    }
  });
});

describe("attemptSwap", () => {
  it("rejects a swap that clears nothing and leaves the board untouched", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"]);
    const snapshot = JSON.stringify(board);
    const result = attemptSwap(board, cell(0, 0), cell(0, 1), TEST_POOL, createRng(1));
    expect(result).toEqual({ valid: false, reason: "no-match" });
    expect(JSON.stringify(board)).toBe(snapshot);
  });

  it("rejects non-adjacent swaps", () => {
    const board = boardFrom(["abcde", "fghij", "klmno", "pqrst", "uvwxy"]);
    expect(attemptSwap(board, cell(0, 0), cell(1, 1), TEST_POOL, createRng(1))).toMatchObject({
      valid: false,
      reason: "not-adjacent",
    });
  });

  it("accepts a swap that forms a match and resolves it", () => {
    // swapping the x at (1,1) up with the `a` at (0,1) completes xxx on row 0
    const board = boardFrom(["xaxbc", "dxfgh", "ijklm", "nopqr", "stuvw"]);
    const result = attemptSwap(board, cell(0, 1), cell(1, 1), TEST_POOL, createRng(5));
    expect(result.valid).toBe(true);
    if (result.valid) {
      const first = clearSteps(result.steps)[0];
      expect(first.kinds).toEqual(["line3"]);
      expect(first.comboIndex).toBe(0);
      expect(first.scoreDelta).toBe(30);
    }
  });

  it("places the special where the player dragged the tile", () => {
    // dragging the x at (1,3) up to (0,3) completes xxxx on row 0
    const board = boardFrom(["xxxab", "cdexf", "ghijk", "lmnop", "qrstu"]);
    const result = attemptSwap(board, cell(1, 3), cell(0, 3), TEST_POOL, createRng(2));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.steps[1]).toMatchObject({ type: "spawnSpecial", cell: cell(0, 3), special: "striped-row" });
    }
  });
});

describe("fuzz: random play keeps the board healthy", () => {
  it("every settled board is full, match-free, has a valid move, and uids stay unique", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const rng = createRng(seed);
      const board = generateBoard(8, 8, TEST_POOL, rng);
      for (let move = 0; move < 120; move++) {
        const found = findValidMove(board);
        expect(found).not.toBeNull();
        const { a, b } = found!;
        const result = attemptSwap(board, a, b, TEST_POOL, rng);
        expect(result.valid).toBe(true);

        expect(boardIsFull(board)).toBe(true);
        expect(hasMatch(board)).toBe(false);
        expect(hasValidMove(board)).toBe(true);
        const uids = board.flat().map((t) => t!.uid);
        expect(new Set(uids).size).toBe(uids.length);
      }
    }
  });

  it("findTileCellByUid agrees with the board after every move", () => {
    const rng = createRng(77);
    const board = generateBoard(8, 8, TEST_POOL, rng);
    for (let move = 0; move < 30; move++) {
      const { a, b } = findValidMove(board)!;
      attemptSwap(board, a, b, TEST_POOL, rng);
      board.forEach((row, r) =>
        row.forEach((tile, c) => expect(findTileCellByUid(board, tile!.uid)).toEqual({ row: r, col: c }))
      );
    }
  });
});
