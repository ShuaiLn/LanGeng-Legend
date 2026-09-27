import { createTile } from "../board";
import type { Board, CellRef, SpecialType } from "../types";

/** Each character in a row string becomes a tile whose characterId is that character. */
export function boardFrom(rows: string[], specials: Record<string, SpecialType> = {}): Board {
  return rows.map((line, row) =>
    [...line].map((ch, col) => createTile(ch, specials[`${row},${col}`] ?? null))
  );
}

export function cell(row: number, col: number): CellRef {
  return { row, col };
}

export function keys(cells: CellRef[]): string[] {
  return cells.map((c) => `${c.row},${c.col}`).sort();
}

export const TEST_POOL = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }));

/** A pool of `size` synthetic characters: a, b, c, ... */
export function poolOf(size: number) {
  return Array.from({ length: size }, (_, i) => ({ id: String.fromCharCode(97 + i) }));
}

export function boardIsFull(board: Board): boolean {
  return board.every((row) => row.every((tile) => tile !== null));
}

export function tileAt(board: Board, row: number, col: number) {
  const tile = board[row][col];
  if (!tile) throw new Error(`no tile at ${row},${col}`);
  return tile;
}
