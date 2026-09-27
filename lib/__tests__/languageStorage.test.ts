import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LANG } from "../i18n";
import { createLanguageStore, getServerLanguage, LANGUAGE_KEY } from "../languageStorage";
import type { StorageLike } from "../persistedStore";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike & { data: Map<string, string> } = {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
  return storage;
}

describe("language store", () => {
  it("is Chinese by default, for the server too, and writes nothing until the player chooses", () => {
    const storage = fakeStorage();
    expect(DEFAULT_LANG).toBe("zh");
    expect(getServerLanguage()).toBe("zh");
    expect(createLanguageStore(() => storage).get()).toBe("zh");
    expect(storage.data.size).toBe(0);
  });

  it("never consults the browser language (a player who never chose still gets Chinese)", () => {
    const source = readFileSync(path.resolve(__dirname, "../languageStorage.ts"), "utf8");
    expect(source.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/navigator|detectLanguage/);
  });

  it("persists a choice, and it wins over the default from then on (round trip)", () => {
    const storage = fakeStorage();
    createLanguageStore(() => storage).set("en");
    expect(storage.getItem(LANGUAGE_KEY)).toBe("en");
    expect(createLanguageStore(() => storage).get()).toBe("en");
  });

  it("ignores a corrupt or unknown stored value", () => {
    for (const raw of ["fr", "", "{}", "ZH", "null"]) {
      const store = createLanguageStore(() => fakeStorage({ [LANGUAGE_KEY]: raw }));
      expect(store.get(), raw).toBe("zh");
    }
  });

  it("notifies subscribers on a change and hands out a stable value in between", () => {
    const store = createLanguageStore(() => fakeStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    expect(store.get()).toBe(store.get());
    store.set("en");
    expect(calls).toBe(1);
    expect(store.get()).toBe("en");
    off();
    store.set("zh");
    expect(calls).toBe(1);
  });

  it("keeps the choice in memory when storage is missing or throws", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    for (const getStorage of [() => null, () => throwing]) {
      const store = createLanguageStore(getStorage);
      expect(store.get()).toBe("zh");
      store.set("en");
      expect(store.get()).toBe("en");
    }
  });
});
