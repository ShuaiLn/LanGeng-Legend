import {
  fillWithoutRuns,
  generateBoard,
  hasValidMove,
  MAX_RESHUFFLE_ATTEMPTS,
  permuteBoard,
} from "./board";
import { boardCols, boardRows } from "./cells";
import { hasMatch } from "./matcher";
import type { Board, CharacterPool, Rng } from "./types";

/**
 * The guaranteed-playable board. `ensurePlayable` is the one call every code path makes when a
 * board might be dead: it walks a repair ladder of four tiers, each tried only if the one before it
 * failed, and it ALWAYS ends on a board with no 3-run and at least one valid move.
 *
 * It never throws (for a pool of at least 3 characters) and never loops: the worst case is bounded
 * by constants (<= 300 + 300 + 80 + 500 attempts), and realistic cases finish in one to three.
 *
 *   1. shuffle     permute the tiles already on the board: every uid and special travels
 *   2. reroll      keep uid + special, redraw the characters from the WHOLE POOL (not just the ids left)
 *   3. construct   deterministic lattice plus one "X X Y X" motif: no RNG, keeps uid + special
 *   4. regenerate  a brand-new board (specials are lost; only reachable if 1-3 all failed)
 */

export type RepairMethod = "none" | "shuffle" | "reroll" | "construct" | "regenerate";

export interface EnsureResult {
  method: RepairMethod;
}

const isPlayable = (board: Board): boolean => !hasMatch(board) && hasValidMove(board);

/** Writes `ids[row][col]` onto the tile at that cell, keeping its uid and special. */
function assignCharacters(board: Board, ids: readonly (readonly string[])[]): void {
  board.forEach((line, row) =>
    line.forEach((tile, col) => {
      if (tile) board[row][col] = { ...tile, characterId: ids[row][col] };
    })
  );
}

/** Tier 2: same tiles (uid + special), new characters drawn from the pool with no runs. */
export function rerollCharacters(board: Board, pool: CharacterPool, rng: Rng): boolean {
  const ids = [...new Set(pool.map((entry) => entry.id))];
  if (ids.length < 3) return false;
  const rows = boardRows(board);
  const cols = boardCols(board);
  for (let attempt = 0; attempt < MAX_RESHUFFLE_ATTEMPTS; attempt++) {
    assignCharacters(board, fillWithoutRuns(rows, cols, ids, rng));
    if (isPlayable(board)) return true;
  }
  return false;
}

/**
 * Tier 3, no randomness: characters follow the lattice `ids[(2 * row + col) mod 3]` (a neighbour is
 * never equal, so no run exists), then one motif `X X Y X` is dropped in with X a fourth character:
 * swapping the last two cells makes `X X X`. Every placement is tried in order until one holds.
 * Needs at least four distinct characters and a line of four cells; false otherwise.
 */
export function constructPlayable(board: Board, pool: CharacterPool): boolean {
  const ids = [...new Set(pool.map((entry) => entry.id))];
  if (ids.length < 4) return false;
  const rows = boardRows(board);
  const cols = boardCols(board);
  const motif = ids[3];
  const lattice = (row: number, col: number) => ids[(2 * row + col) % 3];

  const attempt = (row: number, col: number, horizontal: boolean): boolean => {
    const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => lattice(r, c)));
    for (const offset of [0, 1, 3]) {
      const r = horizontal ? row : row + offset;
      const c = horizontal ? col + offset : col;
      grid[r][c] = motif;
    }
    assignCharacters(board, grid);
    return isPlayable(board);
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col + 3 < cols; col++) if (attempt(row, col, true)) return true;
  }
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row + 3 < rows; row++) if (attempt(row, col, false)) return true;
  }
  return false;
}

/** Tier 4: replaces every tile with a fresh, playable layout (specials are lost). */
export function regenerateInPlace(board: Board, pool: CharacterPool, rng: Rng): void {
  const fresh = generateBoard(boardRows(board), boardCols(board), pool, rng);
  fresh.forEach((line, row) => line.forEach((tile, col) => (board[row][col] = tile)));
}

export function ensurePlayable(board: Board, pool: CharacterPool, rng: Rng): EnsureResult {
  if (hasValidMove(board)) return { method: "none" };
  if (permuteBoard(board, rng)) return { method: "shuffle" };
  if (rerollCharacters(board, pool, rng)) return { method: "reroll" };
  if (constructPlayable(board, pool)) return { method: "construct" };
  regenerateInPlace(board, pool, rng);
  return { method: "regenerate" };
}
