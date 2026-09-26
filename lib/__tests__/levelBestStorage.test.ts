import { afterEach, describe, expect, it, vi } from "vitest";
import { getLevelBest, setLevelBest } from "../levelBestStorage";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("levelBestStorage", () => {
  it("returns 0 when there is no window (server render)", () => {
    expect(getLevelBest("demo-1")).toBe(0);
    expect(() => setLevelBest("demo-1", 500)).not.toThrow();
  });

  it("round-trips a best score per level", () => {
    const storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    expect(getLevelBest("demo-1")).toBe(0);
    setLevelBest("demo-1", 2450.6);
    expect(getLevelBest("demo-1")).toBe(2451);
    expect(getLevelBest("another-level")).toBe(0);
  });

  it("ignores garbage values", () => {
    vi.stubGlobal("window", { localStorage: memoryStorage({ "meme-match:level-best:demo-1": "not a number" }) });
    expect(getLevelBest("demo-1")).toBe(0);
  });

  it("never throws when storage is blocked or full", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    expect(getLevelBest("demo-1")).toBe(0);
    expect(() => setLevelBest("demo-1", 100)).not.toThrow();
  });
});
