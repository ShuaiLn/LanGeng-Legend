import {
  BASE_TILE_SCORE,
  BYSTANDER_MULTIPLIER,
  COMBO_STEP,
  TIER_MULTIPLIER,
} from "../config/gameConfig";
import { cellKey } from "./cells";
import type { MatchCluster } from "./types";

/** Pass N of a chain (0-based) is worth `1 + COMBO_STEP * N` times the base score. */
export function comboMultiplier(comboIndex: number): number {
  return 1 + COMBO_STEP * comboIndex;
}

/**
 * Score for one resolved pass.
 *
 * Tiles matched in a cluster score at that cluster's tier (a cluster's spawn tile took part
 * in the match, so it counts even though it survives). Any other cleared tile is a bystander
 * caught by a special's effect and scores flat. `clearedKeys` are the cells actually cleared.
 */
export function scorePass(
  clusters: readonly MatchCluster[],
  clearedKeys: ReadonlySet<number>,
  comboIndex: number
): number {
  let base = 0;
  const clusterKeys = new Set<number>();

  for (const cluster of clusters) {
    const matchedTiles = cluster.cells.length + (cluster.spawnAt ? 1 : 0);
    base += matchedTiles * BASE_TILE_SCORE * TIER_MULTIPLIER[cluster.kind];
    for (const cell of cluster.cells) clusterKeys.add(cellKey(cell));
  }

  for (const key of clearedKeys) {
    if (!clusterKeys.has(key)) base += BASE_TILE_SCORE * BYSTANDER_MULTIPLIER;
  }

  return Math.round(base * comboMultiplier(comboIndex));
}
