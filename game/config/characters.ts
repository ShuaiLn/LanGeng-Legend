import { shuffle } from "../core/rng";
import type { CharacterId, Rng } from "../core/types";

export interface CharacterAssetSet {
  normal: string | null;
  special: string | null;
  explode: string | null;
}

export interface CharacterConfig {
  id: CharacterId;
  label: string; // rendered as-is while using text placeholders
  color: number; // tile background for the text placeholder
  assets: CharacterAssetSet; // all null for now -> BoardScene falls back to text rendering
}

const noAssets = (): CharacterAssetSet => ({ normal: null, special: null, explode: null });

/** The 11 fixed characters. Never modified or trimmed; the gallery always shows all of them. */
export const CHARACTER_LIBRARY: readonly CharacterConfig[] = [
  { id: "nailong", label: "奶龙", color: 0xf2b632, assets: noAssets() },
  { id: "kunkun", label: "蔡徐坤", color: 0x3f7fd6, assets: noAssets() },
  { id: "laoda", label: "劳大", color: 0xd6503f, assets: noAssets() },
  { id: "jiahao", label: "嘉豪", color: 0x2fa37a, assets: noAssets() },
  { id: "niulai", label: "牛来", color: 0x8a5a3c, assets: noAssets() },
  { id: "mj", label: "mj", color: 0x4a5568, assets: noAssets() },
  { id: "xiongda", label: "熊大", color: 0xc98a3a, assets: noAssets() },
  { id: "meituan", label: "美团袋鼠", color: 0xe0a800, assets: noAssets() },
  { id: "miaocui", label: "妙脆角小猫", color: 0xe0669a, assets: noAssets() },
  { id: "manbo", label: "曼波", color: 0x2ab3c9, assets: noAssets() },
  { id: "sixseven", label: "67", color: 0x6f9a1c, assets: noAssets() },
];

/**
 * The single knob for match difficulty: how many distinct characters share a session's board.
 * Every game rolls exactly this many out of the library, so most of the roster sits each one out.
 */
export const ACTIVE_POOL_SIZE = 7; // tunable 6-8

export const CUSTOM_CHARACTER_ID = "custom";

export function textureKeyFor(id: CharacterId): string {
  return `character:${id}`;
}

/**
 * The characters used for one session. A custom tile takes one of the `ACTIVE_POOL_SIZE`
 * slots (so 6 library characters + 1 custom), it does not add an eighth.
 * Call this exactly once per session and reuse the result for every refill/reshuffle.
 */
export function getActivePool(customTile: CharacterConfig | null, rng: Rng): CharacterConfig[] {
  const slotsForLibrary = customTile ? ACTIVE_POOL_SIZE - 1 : ACTIVE_POOL_SIZE;
  const chosen = shuffle(CHARACTER_LIBRARY, rng).slice(0, slotsForLibrary);
  return customTile ? [...chosen, customTile] : chosen;
}

export function findCharacter(pool: readonly CharacterConfig[], id: CharacterId): CharacterConfig | undefined {
  return pool.find((c) => c.id === id);
}
