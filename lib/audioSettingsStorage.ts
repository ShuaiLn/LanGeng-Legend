/**
 * Persistent sound preferences: a master switch plus one switch per tile. Same shape as the other
 * storage helpers (try/catch localStorage, listener set, cross-tab `storage` event), built as a
 * factory so tests can hand it a fake storage.
 */

export const AUDIO_SETTINGS_KEY = "meme-match:audio-settings:v1";

export interface AudioSettings {
  /** Master switch for every sound effect (tile sounds and the victory jingle). */
  sfxEnabled: boolean;
  /** Per-tile switch by character id; a missing entry means enabled. */
  tiles: Readonly<Record<string, boolean>>;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = Object.freeze({
  sfxEnabled: true,
  tiles: Object.freeze({}),
});

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Whether one tile's sound is switched on (ignores the master switch). */
export function isTileEnabled(settings: AudioSettings, id: string): boolean {
  return settings.tiles[id] !== false;
}

/** Corrupt or partial JSON never throws: unknown shapes fall back to the defaults. */
export function parseAudioSettings(raw: string | null): AudioSettings {
  if (!raw) return DEFAULT_AUDIO_SETTINGS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return DEFAULT_AUDIO_SETTINGS;
    const record = data as Record<string, unknown>;
    const tiles: Record<string, boolean> = {};
    if (typeof record.tiles === "object" && record.tiles !== null) {
      for (const [id, value] of Object.entries(record.tiles)) {
        if (typeof value === "boolean") tiles[id] = value;
      }
    }
    return { sfxEnabled: typeof record.sfxEnabled === "boolean" ? record.sfxEnabled : true, tiles };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export interface AudioSettingsStore {
  /** A stable reference until something changes, so it is a valid `useSyncExternalStore` snapshot. */
  get(): AudioSettings;
  subscribe(listener: () => void): () => void;
  setSfxEnabled(enabled: boolean): void;
  setTileEnabled(id: string, enabled: boolean): void;
  setManyTilesEnabled(ids: readonly string[], enabled: boolean): void;
}

export function createAudioSettingsStore(getStorage: () => StorageLike | null): AudioSettingsStore {
  const listeners = new Set<() => void>();
  let snapshot: AudioSettings | null = null;
  let storageListening = false;

  function storage(): StorageLike | null {
    try {
      return getStorage();
    } catch {
      return null;
    }
  }

  function read(): AudioSettings {
    let raw: string | null = null;
    try {
      raw = storage()?.getItem(AUDIO_SETTINGS_KEY) ?? null;
    } catch {
      raw = null;
    }
    return parseAudioSettings(raw);
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  /** Other tabs write the same key: drop the cached snapshot and tell subscribers. */
  function listenForOtherTabs(): void {
    if (storageListening || typeof window === "undefined") return;
    storageListening = true;
    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUDIO_SETTINGS_KEY) return;
      snapshot = null;
      notify();
    });
  }

  function get(): AudioSettings {
    listenForOtherTabs();
    if (!snapshot) snapshot = read();
    return snapshot;
  }

  function write(next: AudioSettings): void {
    snapshot = next; // in-memory state is authoritative even if persisting fails
    try {
      storage()?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // storage full or blocked: the preference just will not survive a reload
    }
    notify();
  }

  return {
    get,
    subscribe(listener) {
      listenForOtherTabs();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSfxEnabled(enabled) {
      const current = get();
      if (current.sfxEnabled === enabled) return;
      write({ ...current, sfxEnabled: enabled });
    },
    setTileEnabled(id, enabled) {
      const current = get();
      if (isTileEnabled(current, id) === enabled) return;
      write({ ...current, tiles: { ...current.tiles, [id]: enabled } });
    },
    setManyTilesEnabled(ids, enabled) {
      const current = get();
      const tiles = { ...current.tiles };
      let changed = false;
      for (const id of ids) {
        if (isTileEnabled(current, id) !== enabled) {
          tiles[id] = enabled;
          changed = true;
        }
      }
      if (changed) write({ ...current, tiles });
    },
  };
}

const defaultStore = createAudioSettingsStore(() => (typeof window === "undefined" ? null : window.localStorage));

export const getAudioSettings = defaultStore.get;
export const subscribeAudioSettings = defaultStore.subscribe;
export const setSfxEnabled = defaultStore.setSfxEnabled;
export const setTileEnabled = defaultStore.setTileEnabled;
export const setManyTilesEnabled = defaultStore.setManyTilesEnabled;
