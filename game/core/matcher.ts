import { boardCols, boardRows, cellKey, compareCells, sameCell } from "./cells";
import type {
  Board,
  CellRef,
  MatchCluster,
  MatchKind,
  SpecialType,
  SwapContext,
} from "./types";

interface Run {
  horizontal: boolean;
  cells: CellRef[]; // ordered along the run
}

/** Maximal runs of >= 3 equal characterIds, scanned along every row and column. */
export function findRuns(board: Board): Run[] {
  const rows = boardRows(board);
  const cols = boardCols(board);
  const runs: Run[] = [];

  const scan = (
    length: number,
    crossLength: number,
    horizontal: boolean,
    at: (line: number, i: number) => CellRef
  ) => {
    for (let line = 0; line < crossLength; line++) {
      let start = 0;
      while (start < length) {
        const first = at(line, start);
        const tile = board[first.row][first.col];
        let end = start + 1;
        if (tile) {
          while (end < length) {
            const next = at(line, end);
            if (board[next.row][next.col]?.characterId !== tile.characterId) break;
            end++;
          }
          if (end - start >= 3) {
            const cells: CellRef[] = [];
            for (let i = start; i < end; i++) cells.push(at(line, i));
            runs.push({ horizontal, cells });
          }
        }
        start = end;
      }
    }
  };

  scan(cols, rows, true, (row, col) => ({ row, col }));
  scan(rows, cols, false, (col, row) => ({ row, col }));
  return runs;
}

/** Cheap early-exit check: is there any run of 3+ on the board at all? */
export function hasMatch(board: Board): boolean {
  const rows = boardRows(board);
  const cols = boardCols(board);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = board[r][c]?.characterId;
      if (id === undefined) continue;
      if (c + 2 < cols && board[r][c + 1]?.characterId === id && board[r][c + 2]?.characterId === id) {
        return true;
      }
      if (r + 2 < rows && board[r + 1][c]?.characterId === id && board[r + 2][c]?.characterId === id) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Horizontal 4-run -> row clearer, vertical 4-run -> column clearer
 * (the special "matches the run's orientation").
 */
function stripedFor(run: Run): SpecialType {
  return run.horizontal ? "striped-row" : "striped-col";
}

/** Middle cell of a run; even lengths tie-break toward the earlier cell. */
function runCenter(run: Run): CellRef {
  return run.cells[Math.floor((run.cells.length - 1) / 2)];
}

function classify(runs: Run[]): { kind: MatchKind; anchorRun: Run } {
  const longest = runs.reduce((best, run) => (run.cells.length > best.cells.length ? run : best));
  if (longest.cells.length >= 5) return { kind: "line5", anchorRun: longest };
  const hasH = runs.some((r) => r.horizontal);
  const hasV = runs.some((r) => !r.horizontal);
  if (hasH && hasV) return { kind: "lt-shape", anchorRun: longest };
  if (longest.cells.length === 4) return { kind: "line4", anchorRun: longest };
  return { kind: "line3", anchorRun: longest };
}

/** First (row-major) cell that lies on both a horizontal and a vertical run. */
function intersectionCell(runs: Run[]): CellRef | null {
  const horizontalKeys = new Set<number>();
  for (const run of runs) if (run.horizontal) for (const c of run.cells) horizontalKeys.add(cellKey(c));
  const shared: CellRef[] = [];
  for (const run of runs) {
    if (run.horizontal) continue;
    for (const c of run.cells) if (horizontalKeys.has(cellKey(c))) shared.push(c);
  }
  shared.sort(compareCells);
  return shared[0] ?? null;
}

const SPAWN_FOR_KIND: Partial<Record<MatchKind, SpecialType>> = {
  line5: "super",
  "lt-shape": "wrapped",
};

/**
 * Detects every match on the board.
 *
 * Runs merge into one cluster only when they share an actual cell. Each cluster is
 * classified by fixed priority (5+ > L/T > 4 > 3) and yields at most one special spawn.
 * `swapCtx` (player-initiated first pass only) steers where the special appears.
 */
export function findMatches(board: Board, swapCtx?: SwapContext): MatchCluster[] {
  const runs = findRuns(board);
  if (runs.length === 0) return [];

  // union-find over runs, joined through shared cells
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const owner = new Map<number, number>();
  runs.forEach((run, index) => {
    for (const cell of run.cells) {
      const key = cellKey(cell);
      const other = owner.get(key);
      if (other === undefined) owner.set(key, index);
      else parent[find(index)] = find(other);
    }
  });

  const groups = new Map<number, Run[]>();
  runs.forEach((run, index) => {
    const root = find(index);
    const list = groups.get(root);
    if (list) list.push(run);
    else groups.set(root, [run]);
  });

  const ordered: { first: CellRef; cluster: MatchCluster }[] = [];
  for (const groupRuns of groups.values()) {
    const seen = new Map<number, CellRef>();
    for (const run of groupRuns) for (const cell of run.cells) seen.set(cellKey(cell), cell);
    const allCells = [...seen.values()].sort(compareCells);

    const { kind, anchorRun } = classify(groupRuns);
    let spawnAt: CellRef | null = null;
    let spawnSpecial: SpecialType | null = null;

    if (kind !== "line3") {
      const candidates: CellRef[] = [];
      if (swapCtx) {
        if (seen.has(cellKey(swapCtx.to))) candidates.push(swapCtx.to);
        if (seen.has(cellKey(swapCtx.from))) candidates.push(swapCtx.from);
      }
      if (kind === "lt-shape") {
        const hit = intersectionCell(groupRuns);
        if (hit) candidates.push(hit);
      } else {
        candidates.push(runCenter(anchorRun));
      }
      candidates.push(...allCells);

      // A tile that is already special gets activated by the match, so it cannot host the new one.
      spawnAt = candidates.find((c) => board[c.row][c.col]?.special === null) ?? null;
      if (spawnAt) spawnSpecial = kind === "line4" ? stripedFor(anchorRun) : SPAWN_FOR_KIND[kind]!;
    }

    const chosen = spawnAt;
    ordered.push({
      first: allCells[0],
      cluster: {
        cells: chosen ? allCells.filter((c) => !sameCell(c, chosen)) : allCells,
        kind,
        spawnAt,
        spawnSpecial,
      },
    });
  }

  ordered.sort((a, b) => compareCells(a.first, b.first));
  return ordered.map((entry) => entry.cluster);
}
