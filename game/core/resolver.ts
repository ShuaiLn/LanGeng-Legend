import {
  cloneBoard,
  createTile,
  findTileCellByUid,
  hasValidMove,
  reshuffleBoard,
  swapCells,
} from "./board";
import { boardCols, boardRows, cellKey, inBounds, isAdjacent } from "./cells";
import { findMatches } from "./matcher";
import { pickRandom } from "./rng";
import { scorePass } from "./scoring";
import type {
  Board,
  CellRef,
  CharacterId,
  CharacterPool,
  MatchCluster,
  MatchKind,
  Rng,
  SpecialType,
  SwapContext,
  Tile,
} from "./types";

export { findTileCellByUid };

// --- step model ----------------------------------------------------------
// `resolveLoop` mutates the board straight to its final state and returns these steps so the
// renderer can replay what happened. Steps carry uids/cells and never read the live board.

export interface ClearedTile {
  uid: number;
  cell: CellRef;
  characterId: CharacterId;
  special: SpecialType | null;
}

export interface ActivatedSpecial {
  uid: number;
  cell: CellRef;
  special: SpecialType;
  characterId: CharacterId;
}

export interface ClearStep {
  type: "clear";
  cleared: ClearedTile[];
  activated: ActivatedSpecial[];
  kinds: MatchKind[];
  comboIndex: number;
  scoreDelta: number;
}

export interface SpawnSpecialStep {
  type: "spawnSpecial";
  uid: number;
  cell: CellRef;
  special: SpecialType;
}

export interface FallMove {
  uid: number;
  from: CellRef;
  to: CellRef;
}

export interface FallStep {
  type: "fall";
  moves: FallMove[];
}

export interface RefillSpawn {
  tile: Tile;
  cell: CellRef;
  /** Row the tile starts from; negative rows sit above the board. */
  startRow: number;
}

export interface RefillStep {
  type: "refill";
  spawns: RefillSpawn[];
}

export interface ReshuffleStep {
  type: "reshuffle";
  board: Board;
}

export type ResolutionStep =
  | ClearStep
  | SpawnSpecialStep
  | FallStep
  | RefillStep
  | ReshuffleStep;

// --- special activation ----------------------------------------------------

function effectCells(board: Board, cell: CellRef, tile: Tile): CellRef[] {
  const rows = boardRows(board);
  const cols = boardCols(board);
  const cells: CellRef[] = [];
  switch (tile.special) {
    case "striped-row":
      for (let col = 0; col < cols; col++) cells.push({ row: cell.row, col });
      break;
    case "striped-col":
      for (let row = 0; row < rows; row++) cells.push({ row, col: cell.col });
      break;
    case "wrapped":
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const target = { row: cell.row + dr, col: cell.col + dc };
          if (inBounds(board, target)) cells.push(target);
        }
      }
      break;
    case "super":
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (board[row][col]?.characterId === tile.characterId) cells.push({ row, col });
        }
      }
      break;
    default:
      break;
  }
  return cells;
}

/**
 * Worklist expansion: every special that ends up in the clear set (matched or swept up as a
 * bystander) fires its own effect, which may pull in further specials, and so on.
 */
function expandActivations(
  board: Board,
  initial: readonly CellRef[]
): { cells: CellRef[]; activated: ActivatedSpecial[] } {
  const queued = new Set<number>();
  const queue: CellRef[] = [];
  const enqueue = (cell: CellRef) => {
    const key = cellKey(cell);
    if (queued.has(key) || !board[cell.row][cell.col]) return;
    queued.add(key);
    queue.push(cell);
  };

  initial.forEach(enqueue);
  const activated: ActivatedSpecial[] = [];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    const tile = board[cell.row][cell.col]!;
    if (!tile.special) continue;
    activated.push({ uid: tile.uid, cell, special: tile.special, characterId: tile.characterId });
    effectCells(board, cell, tile).forEach(enqueue);
  }
  return { cells: queue, activated };
}

// --- one pass ---------------------------------------------------------------

interface Pass {
  initialCells: CellRef[];
  matches: MatchCluster[];
}

function resolveOnce(board: Board, pass: Pass, comboIndex: number): ResolutionStep[] {
  const spawnKeys = new Set<number>();
  for (const match of pass.matches) if (match.spawnAt) spawnKeys.add(cellKey(match.spawnAt));

  const expansion = expandActivations(board, pass.initialCells);
  // A spawn cell only has its `special` flipped; it is never cleared in the pass that creates it.
  const clearedCells = expansion.cells.filter((cell) => !spawnKeys.has(cellKey(cell)));
  const clearedKeys = new Set(clearedCells.map(cellKey));

  const cleared: ClearedTile[] = clearedCells.map((cell) => {
    const tile = board[cell.row][cell.col]!;
    return { uid: tile.uid, cell, characterId: tile.characterId, special: tile.special };
  });
  const scoreDelta = scorePass(pass.matches, clearedKeys, comboIndex);
  for (const cell of clearedCells) board[cell.row][cell.col] = null;

  const steps: ResolutionStep[] = [
    {
      type: "clear",
      cleared,
      activated: expansion.activated,
      kinds: pass.matches.map((m) => m.kind),
      comboIndex,
      scoreDelta,
    },
  ];

  for (const match of pass.matches) {
    if (!match.spawnAt || !match.spawnSpecial) continue;
    const tile = board[match.spawnAt.row][match.spawnAt.col]!;
    tile.special = match.spawnSpecial;
    steps.push({ type: "spawnSpecial", uid: tile.uid, cell: match.spawnAt, special: match.spawnSpecial });
  }
  return steps;
}

/** Drops every tile as far down as it can go. Only tiles that actually move are reported. */
export function applyGravity(board: Board): FallMove[] {
  const rows = boardRows(board);
  const cols = boardCols(board);
  const moves: FallMove[] = [];
  for (let col = 0; col < cols; col++) {
    let write = rows - 1;
    for (let row = rows - 1; row >= 0; row--) {
      const tile = board[row][col];
      if (!tile) continue;
      if (row !== write) {
        board[write][col] = tile;
        board[row][col] = null;
        moves.push({ uid: tile.uid, from: { row, col }, to: { row: write, col } });
      }
      write--;
    }
  }
  return moves;
}

/** Fills every empty cell with a fresh tile drawn from the (session-locked) pool. */
export function refillFromPool(board: Board, pool: CharacterPool, rng: Rng): RefillSpawn[] {
  const rows = boardRows(board);
  const cols = boardCols(board);
  const ids = pool.map((entry) => entry.id);
  const spawns: RefillSpawn[] = [];
  for (let col = 0; col < cols; col++) {
    let empties = 0;
    while (empties < rows && board[empties][col] === null) empties++;
    for (let row = empties - 1; row >= 0; row--) {
      const tile = createTile(pickRandom(ids, rng));
      board[row][col] = tile;
      spawns.push({ tile: { ...tile }, cell: { row, col }, startRow: row - empties });
    }
  }
  return spawns;
}

// --- the loop ---------------------------------------------------------------

const MAX_PASSES = 200; // pure safety net; real cascades end within a handful of passes

function runResolution(
  board: Board,
  first: Pass,
  comboIndexStart: number,
  pool: CharacterPool,
  rng: Rng
): ResolutionStep[] {
  const steps: ResolutionStep[] = [];
  let pass: Pass = first;
  let comboIndex = comboIndexStart;

  for (let i = 0; i < MAX_PASSES; i++) {
    steps.push(...resolveOnce(board, pass, comboIndex));
    const moves = applyGravity(board);
    if (moves.length > 0) steps.push({ type: "fall", moves });
    steps.push({ type: "refill", spawns: refillFromPool(board, pool, rng) });

    const next = findMatches(board); // cascades have no swap context
    if (next.length === 0) break;
    pass = { initialCells: next.flatMap((m) => m.cells), matches: next };
    comboIndex++;
  }

  if (!hasValidMove(board) && reshuffleBoard(board, rng)) {
    steps.push({ type: "reshuffle", board: cloneBoard(board) });
  }
  return steps;
}

/** Clear -> fall -> refill -> cascade until the board is quiet, then guard against deadlock. */
export function resolveLoop(
  board: Board,
  matches: MatchCluster[],
  pool: CharacterPool,
  rng: Rng,
  comboIndexStart = 0
): ResolutionStep[] {
  if (matches.length === 0) return [];
  return runResolution(
    board,
    { initialCells: matches.flatMap((m) => m.cells), matches },
    comboIndexStart,
    pool,
    rng
  );
}

/**
 * Manually detonates the special at `cell` through the same activation queue a match would use
 * (it does not need to be part of a 3+ match). Used by the level-clear bonus phase.
 */
export function resolveSpecialActivation(
  board: Board,
  cell: CellRef,
  comboIndexStart: number,
  pool: CharacterPool,
  rng: Rng
): ResolutionStep[] {
  if (!board[cell.row]?.[cell.col]) return [];
  return runResolution(board, { initialCells: [cell], matches: [] }, comboIndexStart, pool, rng);
}

/** The combo index the next chain should start from, given the steps just resolved. */
export function nextComboIndex(steps: readonly ResolutionStep[], fallback: number): number {
  let next = fallback;
  for (const step of steps) if (step.type === "clear") next = Math.max(next, step.comboIndex + 1);
  return next;
}

// --- player swap ------------------------------------------------------------

export type SwapResult =
  | { valid: false; reason: "not-adjacent" | "empty-cell" | "no-match" }
  | { valid: true; steps: ResolutionStep[] };

/**
 * Trial-swaps on a cloned board first. A swap that would not clear anything is rejected and
 * leaves `board` untouched (so it must not cost the player a move).
 */
export function attemptSwap(
  board: Board,
  from: CellRef,
  to: CellRef,
  pool: CharacterPool,
  rng: Rng
): SwapResult {
  if (!inBounds(board, from) || !inBounds(board, to) || !isAdjacent(from, to)) {
    return { valid: false, reason: "not-adjacent" };
  }
  if (!board[from.row][from.col] || !board[to.row][to.col]) {
    return { valid: false, reason: "empty-cell" };
  }

  const swapCtx: SwapContext = { from, to };
  const trial = cloneBoard(board);
  swapCells(trial, from, to);
  if (findMatches(trial, swapCtx).length === 0) return { valid: false, reason: "no-match" };

  swapCells(board, from, to);
  const matches = findMatches(board, swapCtx);
  return { valid: true, steps: resolveLoop(board, matches, pool, rng) };
}
