import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import type { Difficulty } from "../../config/difficulty";
import { getLevelDef, resolveDefinition, type LevelDef } from "../../config/levels";
import { goalBot, playLevel, randomBot, seedsFor, type Bot } from "./bots";

/**
 * Balance calibration, opt-in: `CALIBRATE=1 CALIBRATE_JOBS=jobs.json CALIBRATE_OUT=out.json npx vitest run
 * game/core/__tests__/calibrate.test.ts`. Same pattern as `BALANCE=1` in levelBalance.test.ts, but for
 * *finding* the numbers instead of checking them.
 *
 * Every job plays one level at one difficulty over many seeds with a bot through the REAL session,
 * resolver and celebration, and reports the win rate, the percentiles of the winning final scores and
 * the share of wins on each star tier. A job may override parts of the authored (Normal) definition, so
 * a candidate can be tried without editing levels.ts: the difficulty is then derived from the
 * candidate by the real profile rules (`resolveDefinition`). Star lines never change how a bot plays, so
 * the raw winning scores in the output are enough to re-grade any set of lines offline.
 *
 * ```json
 * [{ "level": 5, "difficulty": "normal", "seeds": 60, "def": { "moves": 20, "goals": [{ "type": "collect", "slot": 0, "count": 12 }] } }]
 * ```
 */

interface Job {
  level: number;
  difficulty: Difficulty;
  /** Number of games (default 60). */
  seeds?: number;
  /** Offsets the seed sequence, so a check can use games the tuning never saw. */
  salt?: number;
  bot?: "goal" | "random";
  /** Overrides of the authored Normal definition (moves, goals, gridSize, poolSize, twoStar, threeStar). */
  def?: Partial<Omit<LevelDef, "number" | "chapter">>;
}

interface JobResult {
  job: Job;
  games: number;
  wins: number;
  /** Final score (after the celebration's bonus) of every win. */
  scores: number[];
  /** Score at the instant the goals were met, of every win. */
  objectiveScores: number[];
  /** Moves each win used. */
  movesUsed: number[];
  /** Wins that ended on exactly 1, 2 and 3 stars, against the lines the job resolved to. */
  stars: [number, number, number];
  starThresholds: [number, number, number];
  moveLimit: number;
}

const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

async function run(job: Job): Promise<JobResult> {
  const def: LevelDef = { ...getLevelDef(job.level), ...job.def };
  const level = resolveDefinition(def, job.difficulty);
  const bot: Bot = job.bot === "random" ? randomBot : goalBot;
  const out: JobResult = {
    job,
    games: 0,
    wins: 0,
    scores: [],
    objectiveScores: [],
    movesUsed: [],
    stars: [0, 0, 0],
    starThresholds: level.starThresholds,
    moveLimit: level.moveLimit,
  };
  for (const seed of seedsFor(job.seeds ?? 60, job.salt ?? 0)) {
    const game = await playLevel(level, seed, bot);
    out.games++;
    if (!game.result) continue;
    out.wins++;
    out.scores.push(game.result.finalScore);
    out.objectiveScores.push(game.objectiveScore ?? 0);
    out.movesUsed.push(game.movesUsed);
    out.stars[Math.min(3, Math.max(1, game.result.stars)) - 1]++;
  }
  return out;
}

describe.skipIf(process.env.CALIBRATE !== "1")("calibration (CALIBRATE=1)", () => {
  it("plays the jobs in CALIBRATE_JOBS and writes CALIBRATE_OUT", async () => {
    const jobs = JSON.parse(readFileSync(process.env.CALIBRATE_JOBS ?? "calibrate.jobs.json", "utf8")) as Job[];
    const results: JobResult[] = [];
    for (const job of jobs) {
      const started = Date.now();
      const result = await run(job);
      results.push(result);
      const sorted = [...result.scores].sort((a, b) => a - b);
      const share = (tier: 0 | 1 | 2) => (result.wins === 0 ? 0 : Math.round((100 * result.stars[tier]) / result.wins));
      console.log(
        [
          `L${job.level} ${job.difficulty}`,
          `win ${Math.round((100 * result.wins) / result.games)}% (${result.wins}/${result.games})`,
          `moves ${result.moveLimit}`,
          `score p10 ${percentile(sorted, 10)} p40 ${percentile(sorted, 40)} p50 ${percentile(sorted, 50)} p90 ${percentile(sorted, 90)}`,
          `tiers ${share(0)}/${share(1)}/${share(2)}% at ${result.starThresholds.join("/")}`,
          `${((Date.now() - started) / 1000).toFixed(1)}s`,
        ].join(" | ")
      );
    }
    writeFileSync(process.env.CALIBRATE_OUT ?? "calibrate.out.json", JSON.stringify(results));
  }, 6 * 3_600_000);
});
