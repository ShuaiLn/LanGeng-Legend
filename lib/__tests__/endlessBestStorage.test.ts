import { describe, expect, it } from "vitest";
import { createEndlessBestStore, ENDLESS_BEST_KEY, parseEndlessBest } from "../endlessBestStorage";
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

describe("endless best", () => {
  it("starts at 0", () => {
    expect(createEndlessBestStore(() => fakeStorage()).get()).toBe(0);
  });

  it("saves the first score and any higher one", () => {
    const store = createEndlessBestStore(() => fakeStorage());
    expect(store.record(1200)).toEqual({ best: 1200, isNewBest: true });
    expect(store.record(1800)).toEqual({ best: 1800, isNewBest: true });
    expect(store.get()).toBe(1800);
  });

  it("does not overwrite with a lower or equal score", () => {
    const store = createEndlessBestStore(() => fakeStorage());
    store.record(2000);
    expect(store.record(1999)).toEqual({ best: 2000, isNewBest: false });
    expect(store.record(2000)).toEqual({ best: 2000, isNewBest: false });
    expect(store.get()).toBe(2000);
  });

  it("does not treat a zero score as a best", () => {
    const store = createEndlessBestStore(() => fakeStorage());
    expect(store.record(0)).toEqual({ best: 0, isNewBest: false });
    expect(store.get()).toBe(0);
  });

  it("persists across a reload (a new store over the same storage)", () => {
    const storage = fakeStorage();
    createEndlessBestStore(() => storage).record(3456);
    expect(storage.getItem(ENDLESS_BEST_KEY)).toBe("3456");
    expect(createEndlessBestStore(() => storage).get()).toBe(3456);
  });

  it("reads corrupt, negative or non-finite values as 0", () => {
    for (const raw of ["abc", "-5", "NaN", "Infinity", "", "0", "-Infinity"]) {
      expect(createEndlessBestStore(() => fakeStorage({ [ENDLESS_BEST_KEY]: raw })).get(), raw).toBe(0);
    }
    expect(parseEndlessBest(null)).toBe(0);
    expect(parseEndlessBest("12.6")).toBe(13);
  });

  it("ignores a NaN score and keeps working when storage throws", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createEndlessBestStore(() => throwing);
    expect(store.record(Number.NaN).isNewBest).toBe(false);
    expect(store.record(500)).toEqual({ best: 500, isNewBest: true });
    expect(store.get()).toBe(500); // in memory, even though it could not be persisted
  });

  it("notifies subscribers only when the best changes", () => {
    const store = createEndlessBestStore(() => fakeStorage());
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.record(100);
    store.record(50);
    expect(calls).toBe(1);
    off();
    store.record(200);
    expect(calls).toBe(1);
  });
});
