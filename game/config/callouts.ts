import { pickRandom } from "../core/rng";
import type { MatchKind, Rng } from "../core/types";

/** Meme callout phrase pools, keyed by the kind of clear that triggers them. */
export const MEME_CALLOUTS: Partial<Record<MatchKind, readonly string[]>> = {
  line4: ["哎哟，你干嘛！", "整活！", "有点东西", "666"],
  "lt-shape": ["十字大招！", "包住了！", "太强了！"],
  line5: ["直接爆炸！", "顶级操作！", "封神了！", "AWSL"],
};

/** Shown when a cascade chain reaches `COMBO_CALLOUT_MIN`; the running count lives in the HUD. */
export const COMBO_CALLOUTS = ["man！", "what can I say", "哞~！"] as const;

export const BOOM_CALLOUTS = ["BOOM!", "💥 BOOM!", "KABOOM!"] as const;

export function memeCalloutFor(kind: MatchKind, rng: Rng): string | null {
  const pool = MEME_CALLOUTS[kind];
  return pool ? pickRandom(pool, rng) : null;
}

export function comboCalloutText(rng: Rng): string {
  return pickRandom(COMBO_CALLOUTS, rng);
}
