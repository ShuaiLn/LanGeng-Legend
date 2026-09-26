export type CharacterId = string;

export interface CellRef {
  row: number; // 0 = top
  col: number; // 0 = left
}

export type SpecialType = "striped-row" | "striped-col" | "wrapped" | "super";

export interface Tile {
  uid: number;
  characterId: CharacterId;
  special: SpecialType | null;
}

export type Board = (Tile | null)[][];

export type MatchKind = "line3" | "line4" | "line5" | "lt-shape";

export interface MatchCluster {
  cells: CellRef[]; // cells that get cleared this pass (excludes spawnAt)
  kind: MatchKind;
  spawnAt: CellRef | null; // cell that turns into a special tile, or null for a plain line3
  spawnSpecial: SpecialType | null;
}

/** The player dragged the tile at `from` into `to`; after the swap it sits at `to`. */
export interface SwapContext {
  from: CellRef;
  to: CellRef;
}

/** Anything with an id can populate the board; `CharacterConfig` satisfies this. */
export interface PoolEntry {
  id: CharacterId;
}
export type CharacterPool = readonly PoolEntry[];

export type Rng = () => number;
