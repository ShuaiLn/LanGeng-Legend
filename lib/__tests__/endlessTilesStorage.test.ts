import { describe, expect, it } from "vitest";
import { CHARACTER_LIBRARY } from "../../game/config/characters";
import { ENDLESS_MIN_TILES } from "../../game/config/gameConfig";
import {
  createEndlessTileSettingsStore,
  DEFAULT_ENDLESS_TILE_SETTINGS,
  endlessCharacterPool,
  ENDLESS_TILES_KEY,
  isEndlessTileEnabled,
  parseEndlessTileSettings,
} from "../endlessTilesStorage";
import type { StorageLike } from "../persistedStore";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("parseEndlessTileSettings", () => {
  it("defaults to every tile enabled", () => {
    expect(parseEndlessTileSettings(null)).toEqual(DEFAULT_ENDLESS_TILE_SETTINGS);
    expect(isEndlessTileEnabled(DEFAULT_ENDLESS_TILE_SETTINGS, "anything")).toBe(true);
  });

  it("survives corrupt JSON and wrong shapes", () => {
    expect(parseEndlessTileSettings("{not json")).toEqual(DEFAULT_ENDLESS_TILE_SETTINGS);
    expect(parseEndlessTileSettings("42")).toEqual(DEFAULT_ENDLESS_TILE_SETTINGS);
    expect(parseEndlessTileSettings("null")).toEqual(DEFAULT_ENDLESS_TILE_SETTINGS);
  });

  it("keeps only boolean entries", () => {
    const parsed = parseEndlessTileSettings(JSON.stringify({ enabled: { a: false, b: "no", c: true } }));
    expect(parsed).toEqual({ enabled: { a: false, c: true } });
  });
});

describe("endlessCharacterPool", () => {
  it("keeps the library order and drops disabled characters", () => {
    const [first, second, ...rest] = CHARACTER_LIBRARY;
    const settings = { enabled: { [second.id]: false } };
    const pool = endlessCharacterPool(settings);
    expect(pool[0]).toBe(first);
    expect(pool.some((c) => c.id === second.id)).toBe(false);
    expect(pool).toHaveLength(CHARACTER_LIBRARY.length - 1);
    expect(rest.length).toBeGreaterThan(0); // sanity: the library has more than 2 characters
  });

  it("falls back to the whole library once fewer than ENDLESS_MIN_TILES would remain", () => {
    const allOff = Object.fromEntries(CHARACTER_LIBRARY.map((c) => [c.id, false]));
    expect(endlessCharacterPool({ enabled: allOff })).toBe(CHARACTER_LIBRARY);

    const keepOne = { ...allOff, [CHARACTER_LIBRARY[0].id]: true };
    expect(endlessCharacterPool({ enabled: keepOne })).toBe(CHARACTER_LIBRARY);
  });

  it("keeps exactly ENDLESS_MIN_TILES when that many are enabled", () => {
    const keep = CHARACTER_LIBRARY.slice(0, ENDLESS_MIN_TILES).map((c) => c.id);
    const allOff = Object.fromEntries(CHARACTER_LIBRARY.map((c) => [c.id, keep.includes(c.id)]));
    const pool = endlessCharacterPool({ enabled: allOff });
    expect(pool).toHaveLength(ENDLESS_MIN_TILES);
    expect(pool.map((c) => c.id)).toEqual(keep);
  });
});

describe("endless tile settings store", () => {
  it("persists per-tile switches", () => {
    const storage = memoryStorage();
    const store = createEndlessTileSettingsStore(() => storage);
    store.setTileEnabled("laoda", false);
    expect(JSON.parse(storage.data[ENDLESS_TILES_KEY])).toEqual({ enabled: { laoda: false } });

    // a fresh store over the same storage models a page reload
    const reloaded = createEndlessTileSettingsStore(() => storage);
    expect(isEndlessTileEnabled(reloaded.get(), "laoda")).toBe(false);
    expect(isEndlessTileEnabled(reloaded.get(), "kunkun")).toBe(true);
  });

  it("hands out a stable snapshot until something changes", () => {
    const store = createEndlessTileSettingsStore(() => memoryStorage());
    const first = store.get();
    expect(store.get()).toBe(first);
    store.setTileEnabled("a", false);
    const second = store.get();
    expect(second).not.toBe(first);
    store.setTileEnabled("a", false); // no-op: same value, same reference
    expect(store.get()).toBe(second);
  });

  it("notifies subscribers, and stops after unsubscribe", () => {
    const store = createEndlessTileSettingsStore(() => memoryStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.setTileEnabled("a", false);
    expect(calls).toBe(1);
    off();
    store.setTileEnabled("b", false);
    expect(calls).toBe(1);
  });

  it("enables and disables many tiles at once", () => {
    const store = createEndlessTileSettingsStore(() => memoryStorage());
    store.setManyTilesEnabled(["a", "b", "c"], false);
    expect(store.get().enabled).toEqual({ a: false, b: false, c: false });
    store.setManyTilesEnabled(["a", "b"], true);
    expect(isEndlessTileEnabled(store.get(), "a")).toBe(true);
    expect(isEndlessTileEnabled(store.get(), "c")).toBe(false);
  });

  it("keeps working in memory when storage is missing or throws", () => {
    const none = createEndlessTileSettingsStore(() => null);
    none.setTileEnabled("x", false);
    expect(isEndlessTileEnabled(none.get(), "x")).toBe(false);

    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createEndlessTileSettingsStore(() => broken);
    expect(store.get()).toEqual(DEFAULT_ENDLESS_TILE_SETTINGS);
    store.setTileEnabled("x", false);
    expect(isEndlessTileEnabled(store.get(), "x")).toBe(false);
  });
});
