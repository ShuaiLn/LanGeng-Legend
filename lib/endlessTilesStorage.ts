/**
 * Which library characters share the board in 60-Second Endless (`meme-match:endless-tiles:v1`).
 * A missing entry means enabled, so a new library character defaults to on and old saves never need
 * migrating (same shape as `audioSettingsStorage`'s per-tile switches). Chosen from the small "choose
 * tiles" icon next to the Endless card in the mode picker.
 */
import { CHARACTER_LIBRARY, type CharacterConfig } from "@/game/config/characters";
import { ENDLESS_MIN_TILES } from "@/game/config/gameConfig";
import { browserStorage, createPersistedStore, type StorageLike } from "./persistedStore";

export const ENDLESS_TILES_KEY = "meme-match:endless-tiles:v1";

export interface EndlessTileSettings {
  /** Per-character switch by id; a missing entry means enabled. */
  enabled: Readonly<Record<string, boolean>>;
}

export const DEFAULT_ENDLESS_TILE_SETTINGS: EndlessTileSettings = Object.freeze({ enabled: Object.freeze({}) });

/** Whether one library character is switched on for Endless (ignores `ENDLESS_MIN_TILES`). */
export function isEndlessTileEnabled(settings: EndlessTileSettings, id: string): boolean {
  return settings.enabled[id] !== false;
}

/** Corrupt or partial JSON never throws: unknown shapes fall back to every tile enabled. */
export function parseEndlessTileSettings(raw: string | null): EndlessTileSettings {
  if (!raw) return DEFAULT_ENDLESS_TILE_SETTINGS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return DEFAULT_ENDLESS_TILE_SETTINGS;
    const record = data as Record<string, unknown>;
    const enabled: Record<string, boolean> = {};
    if (typeof record.enabled === "object" && record.enabled !== null) {
      for (const [id, value] of Object.entries(record.enabled)) {
        if (typeof value === "boolean") enabled[id] = value;
      }
    }
    return { enabled };
  } catch {
    return DEFAULT_ENDLESS_TILE_SETTINGS;
  }
}

/**
 * The enabled subset of the library, in library order, for `getActivePool` to draw from. Falls back
 * to the full library if fewer than `ENDLESS_MIN_TILES` would remain (every tile switched off, or
 * corrupted storage), so a session can never start unplayable.
 */
export function endlessCharacterPool(settings: EndlessTileSettings): readonly CharacterConfig[] {
  const enabled = CHARACTER_LIBRARY.filter((c) => isEndlessTileEnabled(settings, c.id));
  return enabled.length >= ENDLESS_MIN_TILES ? enabled : CHARACTER_LIBRARY;
}

export interface EndlessTileSettingsStore {
  /** A stable reference until something changes, so it is a valid `useSyncExternalStore` snapshot. */
  get(): EndlessTileSettings;
  subscribe(listener: () => void): () => void;
  setTileEnabled(id: string, enabled: boolean): void;
  setManyTilesEnabled(ids: readonly string[], enabled: boolean): void;
}

export function createEndlessTileSettingsStore(getStorage: () => StorageLike | null): EndlessTileSettingsStore {
  const store = createPersistedStore<EndlessTileSettings>({
    key: ENDLESS_TILES_KEY,
    getStorage,
    load: (raw) => ({ value: parseEndlessTileSettings(raw) }),
    serialize: (value) => JSON.stringify(value),
  });

  return {
    get: store.get,
    subscribe: store.subscribe,
    setTileEnabled(id, enabled) {
      const current = store.get();
      if (isEndlessTileEnabled(current, id) === enabled) return;
      store.set({ enabled: { ...current.enabled, [id]: enabled } });
    },
    setManyTilesEnabled(ids, enabled) {
      const current = store.get();
      const next = { ...current.enabled };
      let changed = false;
      for (const id of ids) {
        if (isEndlessTileEnabled(current, id) !== enabled) {
          next[id] = enabled;
          changed = true;
        }
      }
      if (changed) store.set({ enabled: next });
    },
  };
}

const defaultStore = createEndlessTileSettingsStore(browserStorage);

export const getEndlessTileSettings = defaultStore.get;
export const subscribeEndlessTileSettings = defaultStore.subscribe;
export const setEndlessTileEnabled = defaultStore.setTileEnabled;
export const setManyEndlessTilesEnabled = defaultStore.setManyTilesEnabled;
