import { describe, expect, it } from "vitest";
import {
  AUDIO_SETTINGS_KEY,
  createAudioSettingsStore,
  DEFAULT_AUDIO_SETTINGS,
  isTileEnabled,
  parseAudioSettings,
  type StorageLike,
} from "../audioSettingsStorage";

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

describe("parseAudioSettings", () => {
  it("defaults to sound on with every tile enabled", () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(DEFAULT_AUDIO_SETTINGS.sfxEnabled).toBe(true);
    expect(isTileEnabled(DEFAULT_AUDIO_SETTINGS, "anything")).toBe(true);
  });

  it("survives corrupt JSON and wrong shapes", () => {
    expect(parseAudioSettings("{not json")).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings("42")).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings("null")).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings(JSON.stringify({ sfxEnabled: "yes", tiles: [1, 2] })).sfxEnabled).toBe(true);
  });

  it("keeps only boolean tile entries", () => {
    const parsed = parseAudioSettings(JSON.stringify({ sfxEnabled: false, tiles: { a: false, b: "no", c: true } }));
    expect(parsed).toEqual({ sfxEnabled: false, tiles: { a: false, c: true } });
  });
});

describe("audio settings store", () => {
  it("persists the master switch and per-tile switches", () => {
    const storage = memoryStorage();
    const store = createAudioSettingsStore(() => storage);
    store.setSfxEnabled(false);
    store.setTileEnabled("laoda", false);
    expect(JSON.parse(storage.data[AUDIO_SETTINGS_KEY])).toEqual({ sfxEnabled: false, tiles: { laoda: false } });

    // a fresh store over the same storage models a page reload
    const reloaded = createAudioSettingsStore(() => storage);
    expect(reloaded.get().sfxEnabled).toBe(false);
    expect(isTileEnabled(reloaded.get(), "laoda")).toBe(false);
    expect(isTileEnabled(reloaded.get(), "kunkun")).toBe(true);
  });

  it("hands out a stable snapshot until something changes", () => {
    const store = createAudioSettingsStore(() => memoryStorage());
    const first = store.get();
    expect(store.get()).toBe(first);
    store.setTileEnabled("a", false);
    const second = store.get();
    expect(second).not.toBe(first);
    expect(store.get()).toBe(second);
    store.setTileEnabled("a", false); // no-op: same value, same reference
    expect(store.get()).toBe(second);
  });

  it("notifies subscribers, and stops after unsubscribe", () => {
    const store = createAudioSettingsStore(() => memoryStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.setSfxEnabled(false);
    expect(calls).toBe(1);
    off();
    store.setSfxEnabled(true);
    expect(calls).toBe(1);
  });

  it("enables and mutes many tiles at once", () => {
    const store = createAudioSettingsStore(() => memoryStorage());
    store.setManyTilesEnabled(["a", "b", "c"], false);
    expect(store.get().tiles).toEqual({ a: false, b: false, c: false });
    store.setManyTilesEnabled(["a", "b"], true);
    expect(isTileEnabled(store.get(), "a")).toBe(true);
    expect(isTileEnabled(store.get(), "c")).toBe(false);
  });

  it("keeps working in memory when storage is missing or throws", () => {
    const none = createAudioSettingsStore(() => null);
    none.setSfxEnabled(false);
    expect(none.get().sfxEnabled).toBe(false);

    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createAudioSettingsStore(() => broken);
    expect(store.get()).toEqual(DEFAULT_AUDIO_SETTINGS);
    store.setTileEnabled("x", false);
    expect(isTileEnabled(store.get(), "x")).toBe(false);
  });
});
