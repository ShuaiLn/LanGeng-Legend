import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRng } from "../../core/rng";
import { BOOM_CALLOUTS, COMBO_MEME_POOL, LEVEL_CLEAR_CALLOUT, MEME_CALLOUTS, pickComboCallout } from "../callouts";

// Spelled with code points so a repo-wide grep for the removed phrase stays empty.
const REMOVED_PHRASE = String.fromCodePoint(0x6574, 0x6d3b);

describe("callouts", () => {
  it("no longer contains the removed 4-in-a-row phrase anywhere", () => {
    const all = [...Object.values(MEME_CALLOUTS).flat(), ...BOOM_CALLOUTS, ...COMBO_MEME_POOL];
    expect(all.some((text) => text.includes(REMOVED_PHRASE))).toBe(false);
    const source = readFileSync(path.resolve(__dirname, "../callouts.ts"), "utf8");
    expect(source).not.toContain(REMOVED_PHRASE);
  });

  it("keeps the per-shape meme phrases", () => {
    expect(MEME_CALLOUTS.line4).toEqual(["哎哟，你干嘛！", "有点东西", "666"]);
    expect(MEME_CALLOUTS.line5).toContain("AWSL");
  });
});

describe("combo callouts", () => {
  it("the pool is exactly the eleven phrases, spelled as given", () => {
    expect([...COMBO_MEME_POOL]).toEqual([
      "What Can I Say!",
      "Man!!!",
      "有点东西！",
      "赢麻了！",
      "逆天",
      "不是哥们",
      "BRO COOKED",
      "秀麻了！",
      "666",
      "这么牛逼",
      "PEAK!",
    ]);
    expect(new Set(COMBO_MEME_POOL).size).toBe(COMBO_MEME_POOL.length);
  });

  it("Clear！！ is the level's shout and is not in the combo pool", () => {
    expect(LEVEL_CLEAR_CALLOUT).toBe("Clear！！");
    expect(COMBO_MEME_POOL).not.toContain(LEVEL_CLEAR_CALLOUT as never);
  });

  it("only ever returns a pool member, and never the phrase it was told was shown last", () => {
    const rng = createRng(7);
    let previous: string | null = null;
    for (let i = 0; i < 500; i++) {
      const next: string = pickComboCallout(rng, previous);
      expect(COMBO_MEME_POOL).toContain(next as never);
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it("never repeats the previous phrase whatever the random number is", () => {
    for (const phrase of COMBO_MEME_POOL) {
      for (const roll of [0, 0.001, 0.25, 0.5, 0.75, 0.999999]) {
        expect(pickComboCallout(() => roll, phrase), `${phrase} @ ${roll}`).not.toBe(phrase);
      }
    }
  });

  it("is deterministic for a seeded rng, and reaches every phrase", () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      const out: string[] = [];
      let previous: string | null = null;
      for (let i = 0; i < 400; i++) out.push((previous = pickComboCallout(rng, previous)));
      return out;
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
    expect(new Set(run(3))).toEqual(new Set(COMBO_MEME_POOL));
  });

  it("works for the first combo of a game (no previous phrase)", () => {
    expect(COMBO_MEME_POOL).toContain(pickComboCallout(createRng(1), null) as never);
  });
});
