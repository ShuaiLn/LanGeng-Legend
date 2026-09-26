import { describe, expect, it } from "vitest";
import { getActivePool } from "../../config/characters";
import type { CelebrationTimings } from "../../config/gameConfig";
import { DEMO_LEVEL } from "../../config/levels";
import { cloneBoard, generateBoard } from "../board";
import { runCelebration, type CelebrationHost } from "../celebration";
import { GameEvents, onGameEvent, type LevelResultPayload } from "../events";
import { attemptSwap } from "../resolver";
import { createRng } from "../rng";
import { GameSession } from "../session";
import type { Board, CellRef } from "../types";

// Guards the claim "the upper star tiers are reachable, not decorative": a seeded bot plays the
// real demo level through the real resolver and celebration. If scoring or thresholds are
// retuned so that 2/3 stars stop being attainable, this fails.

const ZERO: CelebrationTimings = { pause: 0, banner: 0, convertStagger: 0, detonateGap: 0, starGap: 0, beforeResult: 0 };
type Pool = ReturnType<typeof getActivePool>;

function bestGreedyMove(board: Board, pool: Pool): { a: CellRef; b: CellRef } | null {
  let best = -1;
  let pick: { a: CellRef; b: CellRef } | null = null;
  const consider = (a: CellRef, b: CellRef) => {
    const trial = attemptSwap(cloneBoard(board), a, b, pool, createRng(999));
    if (!trial.valid) return;
    const score = trial.steps.reduce((sum, step) => sum + (step.type === "clear" ? step.scoreDelta : 0), 0);
    if (score > best) {
      best = score;
      pick = { a, b };
    }
  };
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (col + 1 < board[row].length) consider({ row, col }, { row, col: col + 1 });
      if (row + 1 < board.length) consider({ row, col }, { row: row + 1, col });
    }
  }
  return pick;
}

async function playDemoLevel(seed: number): Promise<{ result: LevelResultPayload | null; objectiveScore: number | null }> {
  const rng = createRng(seed);
  const pool = getActivePool(null, rng);
  const session = new GameSession({ mode: "level", level: DEMO_LEVEL }, pool, rng);
  session.start();
  const board = generateBoard(8, 8, pool, rng);
  const applyScores = (steps: { type: string; scoreDelta?: number; comboIndex?: number }[]) => {
    for (const step of steps) {
      if (step.type !== "clear") continue;
      session.addScore(step.scoreDelta!);
      session.registerCombo(step.comboIndex!);
    }
  };
  const host: CelebrationHost = {
    session,
    getBoard: () => board,
    playSteps: async (steps) => applyScores(steps),
  };

  while ((session.movesRemaining ?? 0) > 0) {
    const move = bestGreedyMove(board, pool);
    if (!move) break;
    const swap = attemptSwap(board, move.a, move.b, pool, rng);
    if (!swap.valid) break;
    session.consumeMove();
    applyScores(swap.steps);
    const outcome = session.evaluateSettled();
    if (outcome === "objective-met") {
      const result = await new Promise<LevelResultPayload>((resolve) => {
        const off = onGameEvent(GameEvents.CELEBRATION_RESULT, (detail) => {
          if (detail.sessionId !== session.sessionId) return;
          off();
          resolve(detail);
        });
        runCelebration(host, { timings: ZERO, storage: { getBest: () => 0, setBest: () => undefined } });
      });
      return { result, objectiveScore: session.objectiveScore };
    }
    if (outcome === "game-over") break;
  }
  return { result: null, objectiveScore: null };
}

describe("demo level balance", () => {
  it("is winnable, and 2nd/3rd stars are earned through the bonus phase", async () => {
    const games = [];
    for (let seed = 1; seed <= 30; seed++) games.push(await playDemoLevel(seed * 7919));

    const wins = games.filter((g) => g.result);
    expect(wins.length).toBeGreaterThanOrEqual(15); // a decent player usually clears it

    const [, secondStar, thirdStar] = DEMO_LEVEL.starThresholds;
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
