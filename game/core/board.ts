import { boardCols, boardRows } from "./cells";
import { hasMatch } from "./matcher";
import { pickRandom, shuffle } from "./rng";
import type {
  Board,
  CellRef,
  CharacterId,
  CharacterPool,
  Rng,
  SpecialType,
  Tile,
} from "./types";

let uidCounter = 0;

export function createTile(characterId: CharacterId, special: SpecialType | null = null): Tile {
  return { uid: ++uidCounter, characterId, special };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((tile) => (tile ? { ...tile } : null)));
}

export function swapCells(board: Board, a: CellRef, b: CellRef): void {
  const tmp = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = tmp;
}

export function createEmptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => Array<Tile | null>(cols).fill(null));
}

/** Where is the tile with this uid right now? `null` if it has already been cleared. */
export function findTileCellByUid(board: Board, uid: number): CellRef | null {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col]?.uid === uid) return { row, col };
    }
  }
  return null;
}

/** A (swap-able) adjacent pair that would produce a match, or `null` on a dead board. */
export function findValidMove(board: Board): { a: CellRef; b: CellRef } | null {
  const rows = boardRows(board);
  const cols = boardCols(board);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!board[row][col]) continue;
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        const a = { row, col };
        const b = { row: row + dr, col: col + dc };
        if (b.row >= rows || b.col >= cols || !board[b.row][b.col]) continue;
        swapCells(board, a, b);
        const matched = hasMatch(board);
        swapCells(board, a, b);
        if (matched) return { a, b };
      }
    }
  }
  return null;
}

export function hasValidMove(board: Board): boolean {
  return findValidMove(board) !== null;
}

/** Fill a rows x cols grid with characterIds such that no 3-run exists anywhere. */
export function fillWithoutRuns(
  rows: number,
  cols: number,
  ids: readonly CharacterId[],
  rng: Rng
): CharacterId[][] {
  const grid: CharacterId[][] = Array.from({ length: rows }, () => Array<CharacterId>(cols));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const banned = new Set<CharacterId>();
      if (col >= 2 && grid[row][col - 1] === grid[row][col - 2]) banned.add(grid[row][col - 1]);
      if (row >= 2 && grid[row - 1][col] === grid[row - 2][col]) banned.add(grid[row - 1][col]);
      grid[row][col] = pickRandom(
        ids.filter((id) => !banned.has(id)),
        rng
      );
    }
  }
  return grid;
}

const MAX_GENERATION_ATTEMPTS = 500;

/** Random board with no pre-existing match and at least one valid move. */
export function generateBoard(rows: number, cols: number, pool: CharacterPool, rng: Rng): Board {
  const ids = pool.map((entry) => entry.id);
  if (new Set(ids).size < 3) throw new Error("generateBoard needs at least 3 distinct characters");

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const grid = fillWithoutRuns(rows, cols, ids, rng);
    const board = grid.map((line) => line.map((id) => createTile(id)));
    if (hasValidMove(board)) return board;
  }
  throw new Error("generateBoard could not find a playable layout");
}

export const MAX_RESHUFFLE_ATTEMPTS = 300;

/**
 * Tier one of the repair ladder: permutes the tiles already on the board (uids and specials travel
 * with their tile) until there is no immediate 3-run and at least one valid move. Mutates `board`;
 * false when no permutation of these tiles works. A failed attempt leaves the last permutation in
 * place, so a caller must go on to rebuild the board rather than trust it.
 */
export function permuteBoard(board: Board, rng: Rng): boolean {
  const cols = boardCols(board);
  const tiles = board.flat().filter((tile): tile is Tile => tile !== null);

  for (let attempt = 0; attempt < MAX_RESHUFFLE_ATTEMPTS; attempt++) {
    shuffle(tiles, rng).forEach((tile, index) => {
      board[Math.floor(index / cols)][index % cols] = tile;
    });
    if (!hasMatch(board) && hasValidMove(board)) return true;
  }
  return false;
}

/**
 * Rearranges the tiles already on the board until there is no immediate 3-run and at least one
 * valid move. Mutates `board`; returns false only in the degenerate case where no arrangement of
 * the current tiles can work and re-rolling the characters present failed too. The game itself
 * uses `ensurePlayable` (playable.ts), which re-rolls from the whole pool and never gives up.
 */
export function reshuffleBoard(board: Board, rng: Rng): boolean {
  if (permuteBoard(board, rng)) return true;

  const rows = boardRows(board);
  const cols = boardCols(board);
  const tiles = board.flat().filter((tile): tile is Tile => tile !== null);
  // Pathological multiset (e.g. too few of every character): re-roll characterIds among the
  // ones present, keeping each tile's uid and special.
  const ids = [...new Set(tiles.map((t) => t.characterId))];
  if (ids.length < 3) return false;
  for (let attempt = 0; attempt < MAX_RESHUFFLE_ATTEMPTS; attempt++) {
    const grid = fillWithoutRuns(rows, cols, ids, rng);
    tiles.forEach((tile, index) => {
      board[Math.floor(index / cols)][index % cols] = {
        ...tile,
        characterId: grid[Math.floor(index / cols)][index % cols],
      };
    });
    if (hasValidMove(board)) return true;
  }
  return false;
}
