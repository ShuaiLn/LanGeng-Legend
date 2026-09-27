import { getActivePool, type CharacterConfig } from "../../config/characters";
import type { CelebrationTimings } from "../../config/gameConfig";
import type { LevelConfig } from "../../config/levels";
import { cloneBoard, generateBoard, swapCells } from "../board";
import { runCelebration, type CelebrationHost } from "../celebration";
import { GameEvents, onGameEvent, type LevelResultPayload } from "../events";
import { hasMatch } from "../matcher";
import { attemptSwap } from "../resolver";
import { createRng, pickRandom } from "../rng";
import { GameSession } from "../session";
import type { Board, CellRef, Rng } from "../types";

/**
 * Headless players for the balance tests. They drive the REAL session, resolver and celebration
 * (the same `applyStep` the scene calls), so a level is judged exactly as the game judges it:
 *
 *  - `randomBot`  taps a uniformly random valid move: the floor of "a player who does not think".
 *  - `goalBot`    a one-ply optimiser: scores every valid swap by how much it advances the goals
 *                 that are still unmet (using the real resolver), then plays the best one.
 *
 * Real players sit between the two; the numbers in game/config/levels.ts were tuned against them.
 */

export const ZERO_TIMINGS: CelebrationTimings = {
  pause: 0,
  banner: 0,
  convertStagger: 0,
  detonateGap: 0,
  starGap: 0,
  beforeResult: 0,
};

export interface Move {
  a: CellRef;
  b: CellRef;
}

export interface BotContext {
  board: Board;
  pool: CharacterConfig[];
  session: GameSession;
  rng: Rng;
}

export type Bot = (context: BotContext) => Move | null;

/** Every adjacent swap that would clear something. */
export function listValidMoves(board: Board): Move[] {
  const moves: Move[] = [];
  const rows = board.length;
  const cols = board[0].length;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        const a = { row, col };
        const b = { row: row + dr, col: col + dc };
        if (b.row >= rows || b.col >= cols) continue;
        swapCells(board, a, b);
        const matched = hasMatch(board);
        swapCells(board, a, b);
        if (matched) moves.push({ a, b });
      }
    }
  }
  return moves;
}

export const randomBot: Bot = ({ board, rng }) => {
  const moves = listValidMoves(board);
  return moves.length === 0 ? null : pickRandom(moves, rng);
};

/** How much one candidate move advances the goals that are still open, as a share of what they need. */
function valueOfMove(context: BotContext, move: Move): number {
  const { board, pool, session } = context;
  const trial = attemptSwap(cloneBoard(board), move.a, move.b, pool, createRng(999));
  if (!trial.valid) return -Infinity;

  let points = 0;
  let specials = 0;
  let chain = 0;
  const collected = new Map<string, number>();
  for (const step of trial.steps) {
    if (step.type === "clear") {
      points += step.scoreDelta;
      chain = Math.max(chain, step.comboIndex + 1);
      for (const tile of step.cleared) collected.set(tile.characterId, (collected.get(tile.characterId) ?? 0) + 1);
    } else if (step.type === "spawnSpecial") {
      specials++;
    }
  }

  let value = points / 100_000; // tie-break: more points is never worse
  for (const goal of session.goalViews()) {
    if (goal.done) continue;
    const remaining = goal.target - goal.current;
    let gain = 0;
    switch (goal.type) {
      case "score":
        gain = Math.min(points, remaining);
        break;
      case "collect":
        gain = Math.min(collected.get(goal.characterId ?? "") ?? 0, remaining);
        break;
      case "specials":
        gain = Math.min(specials, remaining);
        break;
      case "chain":
        gain = Math.max(0, Math.min(chain, goal.target) - goal.current);
        break;
    }
    value += gain / goal.target;
  }
  return value;
}

export const goalBot: Bot = (context) => {
  let best = -Infinity;
  let pick: Move | null = null;
  for (const move of listValidMoves(context.board)) {
    const value = valueOfMove(context, move);
    if (value > best) {
      best = value;
      pick = move;
    }
  }
  return pick;
};

export interface PlayResult {
  won: boolean;
  /** The victory payload; `null` when the level was lost. */
  result: LevelResultPayload | null;
  /** Score at the instant the goals were met (before the bonus phase). */
  objectiveScore: number | null;
  movesUsed: number;
  finalScore: number;
}

/** Plays one level to its end with `bot`, all randomness from `seed`. */
export async function playLevel(level: LevelConfig, seed: number, bot: Bot): Promise<PlayResult> {
  const rng = createRng(seed);
  const pool = getActivePool(null, rng, level.poolSize);
  const session = new GameSession({ mode: "level", level }, pool, rng);
  session.start();
  const board = generateBoard(level.gridSize, level.gridSize, pool, rng);
  const host: CelebrationHost = {
    session,
    getBoard: () => board,
    playSteps: async (steps) => {
      for (const step of steps) session.applyStep(step);
    },
  };

  let movesUsed = 0;
  while ((session.movesRemaining ?? 0) > 0) {
    const move = bot({ board, pool, session, rng });
    if (!move) break;
    const swap = attemptSwap(board, move.a, move.b, pool, rng);
    if (!swap.valid) break;
    session.consumeMove();
    movesUsed++;
    for (const step of swap.steps) session.applyStep(step);
    session.resetCombo();

    const outcome = session.evaluateSettled();
    if (outcome === "objective-met") {
      const result = await new Promise<LevelResultPayload>((resolve) => {
        const off = onGameEvent(GameEvents.CELEBRATION_RESULT, (detail) => {
          if (detail.sessionId !== session.sessionId) return;
          off();
          resolve(detail);
        });
        runCelebration(host, {
          timings: ZERO_TIMINGS,
          storage: {
            record: (lvl, score, stars) => ({
              isNewBest: true,
              best: score,
              stars,
              unlockedNext: false,
              totalStars: stars,
              hasNext: lvl.number < 20,
            }),
          },
        });
      });
      return { won: true, result, objectiveScore: session.objectiveScore, movesUsed, finalScore: session.score };
    }
    if (outcome === "game-over") break;
  }
  return { won: false, result: null, objectiveScore: null, movesUsed, finalScore: session.score };
}

export interface Tally {
  games: number;
  wins: number;
  /** Wins that ended on 1, 2 and 3 stars. */
  stars: [number, number, number];
}

export async function tally(level: LevelConfig, bot: Bot, seeds: readonly number[]): Promise<Tally> {
  const out: Tally = { games: 0, wins: 0, stars: [0, 0, 0] };
  for (const seed of seeds) {
    const game = await playLevel(level, seed, bot);
    out.games++;
    if (game.result) {
      out.wins++;
      out.stars[Math.min(3, Math.max(1, game.result.stars)) - 1]++;
    }
  }
  return out;
}

/** The first `count` seeds of a fixed, well-spread sequence (the same games on every run). */
export const seedsFor = (count: number, salt = 0): number[] =>
  Array.from({ length: count }, (_, i) => (i + 1) * 7919 + salt);
