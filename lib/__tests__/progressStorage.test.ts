import { describe, expect, it } from "vitest";
import { DIFFICULTIES } from "@/game/config/difficulty";
import { resolveLevel } from "@/game/config/levels";
import {
  applyVictory,
  bestStarsAcross,
  clearedCount,
  createProgressStore,
  EMPTY_PROGRESS,
  isUnlocked,
  parseProgress,
  progressFromLegacyBest,
  PROGRESS_KEY,
  recordFor,
  totalStars,
  totalStarsAll,
  unlockedUpTo,
  type Progress,
} from "../progressStorage";
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

const throwing: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

const win = (p: Progress, d: (typeof DIFFICULTIES)[number], n: number, score: number, stars = 1) =>
  applyVictory(p, d, n, score, stars).progress;

describe("unlocks are shared across difficulties", () => {
  it("opens only level 1 on a fresh profile", () => {
    expect(unlockedUpTo(EMPTY_PROGRESS)).toBe(1);
    expect(isUnlocked(EMPTY_PROGRESS, 1)).toBe(true);
    expect(isUnlocked(EMPTY_PROGRESS, 2)).toBe(false);
    expect(isUnlocked(EMPTY_PROGRESS, 0)).toBe(false);
    expect(isUnlocked(EMPTY_PROGRESS, 21)).toBe(false);
  });

  it("unlocks level N once N-1 has a star on ANY difficulty", () => {
    let p: Progress = EMPTY_PROGRESS;
    for (let n = 1; n <= 11; n++) p = win(p, "easy", n, 1000);
    expect(unlockedUpTo(p)).toBe(12);
    // Normal and Hard have cleared nothing, yet play L1-L12 like Easy does
    for (const d of ["normal", "hard"] as const) {
      expect(clearedCount(p, d)).toBe(0);
      expect(recordFor(p, d, 5)).toBeNull();
    }
    expect(isUnlocked(p, 12)).toBe(true);
    expect(isUnlocked(p, 13)).toBe(false);
  });

  it("takes the highest clear across difficulties", () => {
    let p = win(EMPTY_PROGRESS, "easy", 3, 500);
    p = win(p, "hard", 8, 500);
    expect(unlockedUpTo(p)).toBe(9);
  });

  it("caps at 20 once level 20 is cleared", () => {
    const p = win(EMPTY_PROGRESS, "hard", 20, 500);
    expect(unlockedUpTo(p)).toBe(20);
  });
});

describe("records are per difficulty and only ever improve", () => {
  it("keeps Easy, Normal and Hard results for the same level independent", () => {
    let p = win(EMPTY_PROGRESS, "easy", 8, 3200, 3);
    p = win(p, "normal", 8, 2100, 2);
    p = win(p, "hard", 8, 1500, 1);
    expect(recordFor(p, "easy", 8)).toEqual({ stars: 3, best: 3200 });
    expect(recordFor(p, "normal", 8)).toEqual({ stars: 2, best: 2100 });
    expect(recordFor(p, "hard", 8)).toEqual({ stars: 1, best: 1500 });
  });

  it("merges stars and best score independently: a worse replay lowers nothing", () => {
    let p = win(EMPTY_PROGRESS, "normal", 4, 2000, 3);
    p = win(p, "normal", 4, 900, 1);
    expect(recordFor(p, "normal", 4)).toEqual({ stars: 3, best: 2000 });
    p = win(p, "normal", 4, 2500, 2); // more score, fewer stars: each keeps its own maximum
    expect(recordFor(p, "normal", 4)).toEqual({ stars: 3, best: 2500 });
  });

  it("counts cleared levels and stars per difficulty", () => {
    let p = win(EMPTY_PROGRESS, "normal", 1, 100, 3);
    p = win(p, "normal", 2, 100, 2);
    p = win(p, "easy", 1, 100, 1);
    expect(clearedCount(p, "normal")).toBe(2);
    expect(totalStars(p, "normal")).toBe(5);
    expect(totalStars(p, "easy")).toBe(1);
    expect(totalStars(p, "hard")).toBe(0);
    expect(totalStarsAll(p)).toBe(6);
  });

  it("clamps a victory to 1-3 stars", () => {
    expect(recordFor(win(EMPTY_PROGRESS, "normal", 1, 10, 0), "normal", 1)?.stars).toBe(1);
    expect(recordFor(win(EMPTY_PROGRESS, "normal", 1, 10, 9), "normal", 1)?.stars).toBe(3);
  });
});

describe("victory outcome", () => {
  it("reports a new best, the unlock and the star total", () => {
    const first = applyVictory(EMPTY_PROGRESS, "normal", 1, 1500, 2);
    expect(first.outcome).toEqual({
      isNewBest: true,
      best: 1500,
      stars: 2,
      unlockedNext: true,
      totalStars: 2,
      hasNext: true,
    });
    const worse = applyVictory(first.progress, "normal", 1, 1400, 1);
    expect(worse.outcome).toMatchObject({ isNewBest: false, best: 1500, stars: 2, unlockedNext: false });
  });

  it("announces 'unlocked' only when the shared line actually moves", () => {
    let p = win(EMPTY_PROGRESS, "easy", 5, 800);
    expect(unlockedUpTo(p)).toBe(6);
    // clearing L5 on Hard later unlocks nothing new: Easy already opened L6
    const hard = applyVictory(p, "hard", 5, 800, 1);
    expect(hard.outcome.unlockedNext).toBe(false);
    expect(hard.outcome.isNewBest).toBe(true); // still a first record for Hard
    p = win(p, "hard", 6, 800);
    expect(unlockedUpTo(p)).toBe(7);
  });

  it("level 20 has no next level, and clearing it leaves 20 unlocked", () => {
    const { progress, outcome } = applyVictory(EMPTY_PROGRESS, "hard", 20, 3000, 3);
    expect(outcome.hasNext).toBe(false);
    expect(unlockedUpTo(progress)).toBe(20);
    expect(outcome.totalStars).toBe(3);
    // Easy L20 then adds nothing to the unlock line
    expect(applyVictory(progress, "easy", 20, 3000, 3).outcome.unlockedNext).toBe(false);
  });

  it("remembers the last difficulty played", () => {
    expect(win(EMPTY_PROGRESS, "hard", 1, 10).lastDifficulty).toBe("hard");
  });
});

describe("bestStarsAcross (what a level's cell in the grid shows)", () => {
  it("is 0 for a level that was never cleared, on any difficulty", () => {
    for (const n of [1, 2, 20]) expect(bestStarsAcross(EMPTY_PROGRESS, n)).toBe(0);
  });

  it("is the best of the three difficulties' own records", () => {
    let p = win(EMPTY_PROGRESS, "easy", 1, 10, 3);
    p = win(p, "normal", 1, 10, 2);
    p = win(p, "hard", 1, 10, 1);
    expect(bestStarsAcross(p, 1)).toBe(3);
    // and it is per level: level 2 is untouched
    expect(bestStarsAcross(p, 2)).toBe(0);
  });

  it("counts a difficulty that is the only one cleared, and never lowers on a worse replay", () => {
    let p = win(EMPTY_PROGRESS, "hard", 4, 10, 2);
    expect(bestStarsAcross(p, 4)).toBe(2);
    p = win(p, "hard", 4, 10, 1);
    expect(bestStarsAcross(p, 4)).toBe(2);
    p = win(p, "easy", 4, 10, 3);
    expect(bestStarsAcross(p, 4)).toBe(3);
  });
});

describe("the frontier (the grid's 'current' level is unlockedUpTo)", () => {
  it("is level 1 for a new player and follows a clear on any difficulty", () => {
    expect(unlockedUpTo(EMPTY_PROGRESS)).toBe(1);
    expect(unlockedUpTo(win(EMPTY_PROGRESS, "hard", 1, 10))).toBe(2);
    let p: Progress = EMPTY_PROGRESS;
    for (let n = 1; n <= 6; n++) p = win(p, "easy", n, 10); // L7 is open for everyone
    expect(unlockedUpTo(p)).toBe(7);
    expect(unlockedUpTo(win(p, "hard", 1, 10))).toBe(7); // a lower level on another difficulty adds nothing
  });

  it("stops at the last level", () => {
    let all: Progress = EMPTY_PROGRESS;
    for (let n = 1; n <= 20; n++) all = win(all, "normal", n, 10);
    expect(unlockedUpTo(all)).toBe(20);
  });
});

describe("parsing", () => {
  it("returns empty progress for missing, corrupt or foreign data, and never throws", () => {
    for (const raw of [null, "", "nope", "[]", "42", '{"v":2}', '{"v":1,"levels":7}']) {
      const p = parseProgress(raw);
      expect(unlockedUpTo(p)).toBe(1);
      expect(clearedCount(p, "normal")).toBe(0);
    }
  });

  it("drops entries it cannot trust and keeps the rest", () => {
    const raw = JSON.stringify({
      v: 1,
      lastDifficulty: "hard",
      levels: {
        normal: {
          "1": { stars: 3, best: 4000 },
          "2": { stars: 9, best: 1 }, // too many stars
          "3": { stars: 1, best: -5 }, // negative best
          "21": { stars: 1, best: 10 }, // no such level
          x: { stars: 1, best: 10 },
          "4": "junk",
        },
        nightmare: { "1": { stars: 3, best: 1 } },
      },
    });
    const p = parseProgress(raw);
    expect(Object.keys(p.levels.normal)).toEqual(["1"]);
    expect(recordFor(p, "normal", 1)).toEqual({ stars: 3, best: 4000 });
    expect(p.lastDifficulty).toBe("hard");
    expect(clearedCount(p, "easy")).toBe(0);
  });

  it("ignores an unknown lastDifficulty", () => {
    expect(parseProgress('{"v":1,"lastDifficulty":"nightmare","levels":{}}').lastDifficulty).toBeNull();
  });
});

describe("the store", () => {
  it("persists a victory and reloads it in a new store over the same storage", () => {
    const storage = fakeStorage();
    const store = createProgressStore(() => storage);
    const outcome = store.recordLevel("normal", 3, 2200, 2);
    expect(outcome.isNewBest).toBe(true);
    expect(storage.data.has(PROGRESS_KEY)).toBe(true);

    const reloaded = createProgressStore(() => storage);
    expect(recordFor(reloaded.get(), "normal", 3)).toEqual({ stars: 2, best: 2200 });
  });

  it("hands out a stable snapshot until something changes, and notifies subscribers", () => {
    const store = createProgressStore(() => fakeStorage());
    const a = store.get();
    expect(store.get()).toBe(a);
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.recordLevel("easy", 1, 100, 1);
    expect(calls).toBe(1);
    expect(store.get()).not.toBe(a);
    off();
    store.setLastDifficulty("hard");
    expect(calls).toBe(1);
  });

  it("does not notify when the last difficulty did not change", () => {
    const store = createProgressStore(() => fakeStorage());
    store.setLastDifficulty("easy");
    let calls = 0;
    store.subscribe(() => calls++);
    store.setLastDifficulty("easy");
    expect(calls).toBe(0);
    store.setLastDifficulty("hard");
    expect(calls).toBe(1);
    expect(store.get().lastDifficulty).toBe("hard");
  });

  it("keeps working in memory when storage throws or is missing", () => {
    for (const getStorage of [() => throwing, () => null]) {
      const store = createProgressStore(getStorage);
      expect(unlockedUpTo(store.get())).toBe(1);
      store.recordLevel("normal", 1, 300, 1);
      expect(unlockedUpTo(store.get())).toBe(2);
    }
  });

  it("survives corrupt stored JSON", () => {
    const store = createProgressStore(() => fakeStorage({ [PROGRESS_KEY]: "{{{" }));
    expect(unlockedUpTo(store.get())).toBe(1);
  });
});

describe("legacy demo-level best", () => {
  it("seeds Normal level 1 (and only that) from the old single best, with stars from today's Normal lines", () => {
    const [, two] = resolveLevel(1, "normal").starThresholds;
    const p = progressFromLegacyBest(two + 10);
    expect(recordFor(p, "normal", 1)).toEqual({ stars: 2, best: two + 10 });
    expect(clearedCount(p, "easy")).toBe(0);
    expect(clearedCount(p, "hard")).toBe(0);
    expect(clearedCount(p, "normal")).toBe(1);
    expect(unlockedUpTo(p)).toBe(2);
  });

  it("is worth at least one star and ignores a missing or zero best", () => {
    expect(recordFor(progressFromLegacyBest(5), "normal", 1)?.stars).toBe(1);
    expect(progressFromLegacyBest(0)).toBe(EMPTY_PROGRESS);
    expect(progressFromLegacyBest(Number.NaN)).toBe(EMPTY_PROGRESS);
  });

  it("imports once, writes it back, and leaves the legacy value alone", () => {
    const storage = fakeStorage({ "meme-match:level-best:demo-1": "1800" });
    let legacyReads = 0;
    const legacy = () => {
      legacyReads++;
      return Number(storage.getItem("meme-match:level-best:demo-1"));
    };
    const first = createProgressStore(() => storage, legacy);
    expect(recordFor(first.get(), "normal", 1)?.best).toBe(1800);
    expect(storage.data.has(PROGRESS_KEY)).toBe(true);
    expect(storage.getItem("meme-match:level-best:demo-1")).toBe("1800"); // never deleted

    // a second store finds progress:v1 and does not import again
    legacyReads = 0;
    const second = createProgressStore(() => storage, legacy);
    expect(recordFor(second.get(), "normal", 1)?.best).toBe(1800);
    expect(legacyReads).toBe(0);
    // and a later record on another difficulty does not lose it
    second.recordLevel("easy", 1, 50, 1);
    expect(recordFor(createProgressStore(() => storage, legacy).get(), "normal", 1)?.best).toBe(1800);
  });

  it("does not create the progress key when there is nothing to import", () => {
    const storage = fakeStorage();
    createProgressStore(() => storage, () => 0).get();
    expect(storage.data.has(PROGRESS_KEY)).toBe(false);
  });
});
