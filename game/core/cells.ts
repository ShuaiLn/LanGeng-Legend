import type { Board, CellRef } from "./types";

export function boardRows(board: Board): number {
  return board.length;
}

export function boardCols(board: Board): number {
  return board.length === 0 ? 0 : board[0].length;
}

/** Stable numeric key for a cell; boards are far smaller than 1000 columns. */
export function cellKey(cell: CellRef): number {
  return cell.row * 1000 + cell.col;
}

export function cellFromKey(key: number): CellRef {
  return { row: Math.floor(key / 1000), col: key % 1000 };
}

export function sameCell(a: CellRef, b: CellRef): boolean {
  return a.row === b.row && a.col === b.col;
}

export function inBounds(board: Board, cell: CellRef): boolean {
  return (
    cell.row >= 0 &&
    cell.row < boardRows(board) &&
    cell.col >= 0 &&
    cell.col < boardCols(board)
  );
}

export function isAdjacent(a: CellRef, b: CellRef): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

/** Row-major ordering, used so cluster output never depends on scan order. */
export function compareCells(a: CellRef, b: CellRef): number {
  return a.row - b.row || a.col - b.col;
}
