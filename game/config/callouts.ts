import { pickRandom } from "../core/rng";
import type { MatchKind, Rng } from "../core/types";

/**
 * Every callout string lives here, verbatim: memes are the same in every language, so none of these
 * goes through the i18n dictionaries.
 */

/** Meme callout phrase pools, keyed by the kind of clear that triggers them. */
export const MEME_CALLOUTS: Partial<Record<MatchKind, readonly string[]>> = {
  line4: ["哎哟，你干嘛！", "有点东西", "666"],
  "lt-shape": ["十字大招！", "包住了！", "太强了！"],
  line5: ["直接爆炸！", "顶级操作！", "封神了！", "AWSL"],
};

export const BOOM_CALLOUTS = ["BOOM!", "💥 BOOM!", "KABOOM!"] as const;

export function memeCalloutFor(kind: MatchKind, rng: Rng): string | null {
  const pool = MEME_CALLOUTS[kind];
  return pool ? pickRandom(pool, rng) : null;
}

/** What a chain (combo) shouts, chosen at random. `Clear！！` is deliberately not here: it is the level's. */
export const COMBO_MEME_POOL = [
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
] as const;

/** Shown when a level is completed (the banner and the result card), in both languages. */
export const LEVEL_CLEAR_CALLOUT = "Clear！！";

/** A random phrase from the combo pool, never the same one twice in a row. */
export function pickComboCallout(rng: Rng, previous: string | null): string {
  return pickRandom(
    COMBO_MEME_POOL.filter((phrase) => phrase !== previous),
    rng
  );
}
