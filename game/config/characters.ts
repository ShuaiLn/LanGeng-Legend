import { shuffle } from "../core/rng";
import type { CharacterId, Rng } from "../core/types";
import { assetUrl } from "./assetUrl";

export interface CharacterAssetSet {
  /** Tile art. `null` -> BoardScene falls back to a text placeholder. */
  normal: string | null;
  /** A 128px copy of the art, for decoration only (the menu's falling tiles). Library characters only. */
  thumb?: string | null;
  /** Elimination sound. `null` -> the tile is silent (the Gallery shows "No sound"). */
  sound: string | null;
  special: string | null;
  explode: string | null;
}

export interface CharacterConfig {
  id: CharacterId;
  label: string; // shown in Settings / Gallery, and rendered as-is by the text placeholder
  color: number; // text-placeholder background and this tile's particle colour
  assets: CharacterAssetSet;
}

/**
 * Art + sound for one library character. `stem` is the lower-cased file name that
 * `npm run assets:build` publishes (`tiles/<stem>.webp`, `audio/<stem>.mp3`). It is spelled out
 * per character on purpose: ids and file names differ (kunkun -> kun, mj -> spider, sixseven -> 67).
 */
const libraryAssets = (stem: string): CharacterAssetSet => ({
  normal: assetUrl(`tiles/${stem}.webp`),
  thumb: assetUrl(`tiles-sm/${stem}.webp`),
  sound: assetUrl(`audio/${stem}.mp3`),
  special: null,
  explode: null,
});

/** The 11 fixed characters. Never modified or trimmed; the gallery always shows all of them. */
export const CHARACTER_LIBRARY: readonly CharacterConfig[] = [
  { id: "nailong", label: "奶龙", color: 0xf2b632, assets: libraryAssets("nailong") },
  { id: "kunkun", label: "蔡徐坤", color: 0x3f7fd6, assets: libraryAssets("kun") },
  { id: "laoda", label: "劳大", color: 0xd6503f, assets: libraryAssets("laoda") },
  { id: "jiahao", label: "嘉豪", color: 0x2fa37a, assets: libraryAssets("jiahao") },
  { id: "niulai", label: "牛来", color: 0x8a5a3c, assets: libraryAssets("niulai") },
  { id: "mj", label: "mj", color: 0x4a5568, assets: libraryAssets("spider") }, // art + sound are Spider-Man
  { id: "xiongda", label: "熊大", color: 0xc98a3a, assets: libraryAssets("xiongda") },
  { id: "meituan", label: "美团袋鼠", color: 0xe0a800, assets: libraryAssets("meituan") },
  { id: "miaocui", label: "妙脆角小猫", color: 0xe0669a, assets: libraryAssets("miaocui") },
  { id: "manbo", label: "曼波", color: 0x2ab3c9, assets: libraryAssets("manbo") },
  { id: "sixseven", label: "67", color: 0x6f9a1c, assets: libraryAssets("67") },
];

/**
 * How many distinct characters share a session's board by default (Endless). Level Mode passes its
 * own size (6, 7 or 8, by chapter) to `getActivePool`; difficulty never changes it, because the
 * pool size swings points per move about 3x and would make goals incomparable.
 */
export const ACTIVE_POOL_SIZE = 7; // tunable 6-8

export const CUSTOM_CHARACTER_ID = "custom";

export function textureKeyFor(id: CharacterId): string {
  return `character:${id}`;
}

/**
 * The characters used for one session. A custom tile takes one of the `size` slots (so 5-7 library
 * characters + 1 custom), it does not add one, and it is always LAST: collect goals only ever
 * point at the first three slots, so the custom tile is never a collect target.
 * Call this exactly once per session and reuse the result for every refill/reshuffle.
 */
export function getActivePool(
  customTile: CharacterConfig | null,
  rng: Rng,
  size: number = ACTIVE_POOL_SIZE
): CharacterConfig[] {
  const slotsForLibrary = customTile ? size - 1 : size;
  const chosen = shuffle(CHARACTER_LIBRARY, rng).slice(0, slotsForLibrary);
  return customTile ? [...chosen, customTile] : chosen;
}

export function findCharacter(pool: readonly CharacterConfig[], id: CharacterId): CharacterConfig | undefined {
  return pool.find((c) => c.id === id);
}
