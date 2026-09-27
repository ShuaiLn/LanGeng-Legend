import { describe, expect, it } from "vitest";
import { resolveLevel } from "../../config/levels";
import { goalBot, playLevel, seedsFor } from "./bots";

// Guards the claim "the upper star tiers are reachable, not decorative": a seeded bot plays the real
// level 1 through the real session, resolver and celebration. If scoring or the thresholds are
// retuned so that 2 and 3 stars stop being attainable, this fails. (Every level x difficulty is
// covered by levelBalance.test.ts; this one keeps the original bonus-phase argument for the warm-up.)

const LEVEL = resolveLevel(1, "normal");

describe("level 1 balance", () => {
  it("is winnable, and the 2nd/3rd stars are earned through the bonus phase", async () => {
    const games = [];
    for (const seed of seedsFor(16)) games.push(await playLevel(LEVEL, seed, goalBot));

    const wins = games.filter((g) => g.result);
    expect(wins.length).toBeGreaterThanOrEqual(13); // a decent player nearly always clears it

    const [, secondStar, thirdStar] = LEVEL.starThresholds;
    expect(wins.some((g) => g.result!.stars >= 2)).toBe(true);
    expect(wins.some((g) => g.result!.stars === 3)).toBe(true);

    // the bonus phase is what lifts a run over the 2nd-star line, not the base play alone
    const liftedBySecondStar = wins.filter(
      (g) => g.objectiveScore! < secondStar && g.result!.finalScore >= secondStar
    );
    expect(liftedBySecondStar.length).toBeGreaterThan(0);
    expect(wins.every((g) => g.result!.finalScore >= g.objectiveScore!)).toBe(true);
    expect(thirdStar).toBeGreaterThan(secondStar);
  }, 120_000);
});
