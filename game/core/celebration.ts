import { CELEBRATION_TIMINGS, type CelebrationTimings } from "../config/gameConfig";
import { computeStars } from "../config/levels";
import { getLevelBest, setLevelBest } from "../../lib/levelBestStorage";
import { findTileCellByUid } from "./board";
import { emitGameEvent, GameEvents, onGameEvent } from "./events";
import { nextComboIndex, resolveSpecialActivation, type ResolutionStep } from "./resolver";
import { pickRandom, randomInt } from "./rng";
import type { GameSession } from "./session";
import type { Board, CellRef, Rng, SpecialType } from "./types";

/**
 * Level-clear celebration sequencer. Fully decoupled from the match logic: it only reacts to
 * `level-objective-met`, drives its own beats through the event bus, and reuses the resolver's
 * activation queue (`resolveSpecialActivation`) for the bonus detonations.
 *
 * Every beat re-checks a cancellation token, so a Retry / route change / unmount can never let
 * a stale timer chain leak "LEVEL CLEAR!" or stars into the next session.
 */

/** Only these are ever produced by the bonus conversion; `super` stays earned-only. */
export const BONUS_SPECIAL_TYPES: readonly SpecialType[] = ["striped-row", "striped-col", "wrapped"];

export interface CelebrationHost {
  session: GameSession;
  getBoard(): Board;
  /** Plays resolution steps as animation (and applies their scores); resolves when finished. */
  playSteps(steps: ResolutionStep[]): Promise<void>;
}

export interface CelebrationOptions {
  timings?: CelebrationTimings;
  storage?: {
    getBest(levelId: string): number;
    setBest(levelId: string, score: number): void;
  };
}

export interface CelebrationToken {
  readonly sessionId: number;
  cancelled: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
  wake: ((completed: boolean) => void) | null;
}

const activeTokens = new Set<CelebrationToken>();

/** Flags the token AND clears its pending timer: belt and braces, not "checked eventually". */
export function cancelCelebration(token: CelebrationToken): void {
  token.cancelled = true;
  if (token.timerId !== null) clearTimeout(token.timerId);
  token.timerId = null;
  const wake = token.wake;
  token.wake = null;
  wake?.(false);
  activeTokens.delete(token);
}

/** For React-side unmount cleanup, where no token is at hand. */
export function cancelAllCelebrations(): void {
  for (const token of [...activeTokens]) cancelCelebration(token);
}

export function activeCelebrationCount(): number {
  return activeTokens.size;
}

/** Resolves true after `ms`, or false if the celebration was cancelled in the meantime. */
function wait(token: CelebrationToken, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (token.cancelled) {
      resolve(false);
      return;
    }
    token.wake = resolve;
    token.timerId = setTimeout(() => {
      token.timerId = null;
      token.wake = null;
      resolve(!token.cancelled);
    }, ms);
  });
}

/** A random tile that is not special yet, or `null` when every tile already is. */
export function pickBonusTarget(board: Board, rng: Rng): { cell: CellRef; uid: number } | null {
  const eligible: { cell: CellRef; uid: number }[] = [];
  board.forEach((line, row) =>
    line.forEach((tile, col) => {
      if (tile && tile.special === null) eligible.push({ cell: { row, col }, uid: tile.uid });
    })
  );
  return eligible.length === 0 ? null : eligible[randomInt(rng, eligible.length)];
}

export function runCelebration(host: CelebrationHost, options: CelebrationOptions = {}): CelebrationToken {
  const token: CelebrationToken = {
    sessionId: host.session.sessionId,
    cancelled: false,
    timerId: null,
    wake: null,
  };
  activeTokens.add(token);

  const timings = options.timings ?? CELEBRATION_TIMINGS;
  const storage = options.storage ?? { getBest: getLevelBest, setBest: setLevelBest };
  const { session } = host;
  const level = session.level;
  const sessionId = session.sessionId;

  const finish = () => activeTokens.delete(token);

  async function reportResult(): Promise<void> {
    if (!level) return;
    const finalScore = session.score;
    const stars = computeStars(finalScore, level.starThresholds);
    const previousBest = storage.getBest(level.id);
    const isNewBest = finalScore > previousBest;

    // 6. reveal stars, one at a time
    for (let i = 0; i < stars; i++) {
      emitGameEvent(GameEvents.CELEBRATION_STAR, { sessionId, index: i, total: stars });
      if (!(await wait(token, timings.starGap))) return;
    }

    // 7. new-best check
    if (isNewBest) {
      storage.setBest(level.id, finalScore);
      emitGameEvent(GameEvents.NEW_BEST, { sessionId, levelId: level.id, score: finalScore });
      if (!(await wait(token, timings.starGap))) return;
    }

    // 8. result panel, only after every beat above
    if (!(await wait(token, timings.beforeResult))) return;
    session.finishCelebration();
    emitGameEvent(GameEvents.CELEBRATION_RESULT, {
      sessionId,
      levelId: level.id,
      levelName: level.name,
      stars,
      starThresholds: level.starThresholds,
      finalScore,
      best: Math.max(previousBest, finalScore),
      isNewBest,
      maxCombo: session.maxCombo,
      bonusMoves: session.movesAtObjective ?? 0,
      bonusScore: finalScore - (session.objectiveScore ?? finalScore),
    });
  }

  async function sequence(): Promise<void> {
    if (!level) return;

    // 1. lock input (the scene reuses its single inputLocked flag)
    emitGameEvent(GameEvents.CELEBRATION_LOCK_INPUT, { sessionId });

    // 2. pause for pacing
    if (!(await wait(token, timings.pause))) return;

    // 3. LEVEL CLEAR banner (shake + flash are handled by whoever subscribes)
    emitGameEvent(GameEvents.CELEBRATION_LEVEL_CLEAR, { sessionId });
    if (!(await wait(token, timings.banner))) return;

    // 4. convert each remaining move into a bonus special, tracked by uid
    const bonusSpecialUids: number[] = [];
    const movesToConvert = session.movesRemaining ?? 0;
    for (let i = 0; i < movesToConvert; i++) {
      const target = pickBonusTarget(host.getBoard(), session.rng);
      if (!target) break; // nothing eligible left: the beat just ends early
      const tile = host.getBoard()[target.cell.row][target.cell.col]!;
      tile.special = pickRandom(BONUS_SPECIAL_TYPES, session.rng);
      bonusSpecialUids.push(tile.uid);
      session.consumeBonusMove();
      emitGameEvent(GameEvents.CELEBRATION_CONVERT, {
        sessionId,
        uid: tile.uid,
        special: tile.special,
        cell: target.cell,
      });
      if (!(await wait(token, timings.convertStagger))) return;
    }

    // 5. detonate one by one. Earlier detonations move and clear tiles, so every turn looks the
    //    tile up by uid and silently skips it if it has already been swept away.
    let comboIndex = 0;
    for (let i = 0; i < bonusSpecialUids.length; i++) {
      const uid = bonusSpecialUids[i];
      const cell = findTileCellByUid(host.getBoard(), uid);
      if (!cell) continue;
      emitGameEvent(GameEvents.CELEBRATION_DETONATE, {
        sessionId,
        uid,
        cell,
        index: i,
        total: bonusSpecialUids.length,
      });
      const steps = resolveSpecialActivation(host.getBoard(), cell, comboIndex, session.activePool, session.rng);
      comboIndex = nextComboIndex(steps, comboIndex);
      await host.playSteps(steps); // score ticks up live as each clear step plays
      if (token.cancelled) return;
      if (!(await wait(token, timings.detonateGap))) return;
    }

    // "Final Score: N" is simply the settled live score; there is no second count-up.
    emitGameEvent(GameEvents.CELEBRATION_FINAL_SCORE, { sessionId, score: session.score });
    if (!(await wait(token, timings.starGap))) return;

    await reportResult();
  }

  sequence()
    .catch(async (error) => {
      console.error("[celebration] sequence failed", error);
      // Never leave the player locked out with no result panel: settle with the live score.
      if (!token.cancelled) await reportResult().catch(() => undefined);
    })
    .finally(finish);

  return token;
}

/**
 * Starts a celebration whenever `level-objective-met` fires for the host's own session.
 * The returned disposer removes the listener AND cancels any celebration still running.
 */
export function startCelebrationListener(
  getHost: () => CelebrationHost | null,
  options?: CelebrationOptions
): () => void {
  let current: CelebrationToken | null = null;
  const off = onGameEvent(GameEvents.LEVEL_OBJECTIVE_MET, (detail) => {
    const host = getHost();
    if (!host || host.session.sessionId !== detail.sessionId) return;
    if (current) cancelCelebration(current);
    current = runCelebration(host, options);
  });

  return () => {
    off();
    if (current) cancelCelebration(current);
    current = null;
  };
}
