import { assetUrl } from "./assetUrl";
import { CHARACTER_LIBRARY, type CharacterConfig } from "./characters";

export { ASSET_VERSION, assetUrl } from "./assetUrl";

/** Key of the victory jingle in the audio manager (it is not a tile). */
export const VICTORY_SOUND_KEY = "victory";
export const VICTORY_SOUND_URL = assetUrl("audio/victory.mp3");

/**
 * Opening art. Not in the preload manifest: the opening renders before the gate opens, so these are
 * plain <img> tags that load themselves (about 45 KB together) while the manifest preloads behind them.
 */
export const BRAND_ICON_URL = assetUrl("brand/icon.webp");
export const BRAND_LOGO_URL = assetUrl("brand/logo.webp");

export type PreloadKind = "image" | "audio";

export interface PreloadItem {
  kind: PreloadKind;
  /** Character id (or `VICTORY_SOUND_KEY` for the jingle): what the loaded bytes are registered under. */
  key: string;
  url: string;
}

/** Everything fetched once at startup: tile art, tile sounds, the victory jingle, the custom tile. */
export function getPreloadManifest(customTile: CharacterConfig | null): PreloadItem[] {
  const items: PreloadItem[] = [];
  const characters = customTile ? [...CHARACTER_LIBRARY, customTile] : CHARACTER_LIBRARY;
  for (const character of characters) {
    if (character.assets.normal) items.push({ kind: "image", key: character.id, url: character.assets.normal });
    if (character.assets.sound) items.push({ kind: "audio", key: character.id, url: character.assets.sound });
  }
  items.push({ kind: "audio", key: VICTORY_SOUND_KEY, url: VICTORY_SOUND_URL });
  return items;
}

/** The library's elimination-sound URL for a character id, or `null` (custom tiles register theirs at runtime). */
export function soundUrlFor(id: string): string | null {
  return CHARACTER_LIBRARY.find((character) => character.id === id)?.assets.sound ?? null;
}
