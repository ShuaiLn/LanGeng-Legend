import type { Goal, GoalType } from "../config/levels";
import type { CharacterId, PoolEntry } from "./types";

/**
 * Pure goal bookkeeping for one level session: no events, no Phaser, no React. The session owns a
 * `GoalState` and feeds it what the resolver's steps report; the HUD reads `goalViews`.
 *
 * Only what cannot be derived is stored (tiles collected, specials made). A score goal reads the
 * session score and a chain goal reads the best chain reached, both passed in by the caller.
 */

export interface GoalState {
  readonly goals: readonly Goal[];
  /** Per goal: the character to collect (`null` for goals that are not "collect"). */
  readonly collectIds: readonly (CharacterId | null)[];
  /** Per goal: tiles of the target character cleared so far (0 for other goal types). */
  readonly collected: number[];
  specialsMade: number;
}

export interface GoalContext {
  score: number;
  /** The longest chain reached so far (the HUD's `COMBO x N` at its peak). */
  maxCombo: number;
}

/** One goal as the UI sees it: a progress row. `current` is clamped to `target`. */
export interface GoalView {
  type: GoalType;
  current: number;
  target: number;
  done: boolean;
  /** The character a collect goal points at, for the tile art in the HUD. */
  characterId?: CharacterId;
}

export function createGoals(goals: readonly Goal[], pool: readonly PoolEntry[]): GoalState {
  return {
    goals,
    collectIds: goals.map((goal) => (goal.type === "collect" ? (pool[goal.slot]?.id ?? null) : null)),
    collected: goals.map(() => 0),
    specialsMade: 0,
  };
}

/** Counts cleared tiles toward collect goals (swept-up bystanders count too). True if anything moved. */
export function applyClear(state: GoalState, cleared: readonly { characterId: CharacterId }[]): boolean {
  let changed = false;
  state.goals.forEach((goal, index) => {
    const id = state.collectIds[index];
    if (goal.type !== "collect" || id === null) return;
    let hits = 0;
    for (const tile of cleared) if (tile.characterId === id) hits++;
    if (hits > 0) {
      state.collected[index] += hits;
      changed = true;
    }
  });
  return changed;
}

/** A special tile was created (only ever by a match, never by the celebration's own conversion). */
export function applySpecialSpawn(state: GoalState, count = 1): boolean {
  if (count <= 0 || !state.goals.some((goal) => goal.type === "specials")) return false;
  state.specialsMade += count;
  return true;
}

function currentFor(state: GoalState, index: number, context: GoalContext): number {
  const goal = state.goals[index];
  switch (goal.type) {
    case "score":
      return context.score;
    case "collect":
      return state.collected[index];
    case "specials":
      return state.specialsMade;
    case "chain":
      return context.maxCombo;
  }
}

function targetOf(goal: Goal): number {
  switch (goal.type) {
    case "score":
      return goal.target;
    case "collect":
    case "specials":
      return goal.count;
    case "chain":
      return goal.length;
  }
}

export function goalViews(state: GoalState, context: GoalContext): GoalView[] {
  return state.goals.map((goal, index) => {
    const target = targetOf(goal);
    const current = currentFor(state, index, context);
    const characterId = state.collectIds[index];
    return {
      type: goal.type,
      current: Math.min(current, target),
      target,
      done: current >= target,
      ...(characterId ? { characterId } : {}),
    };
  });
}

/** Every goal met. A level with no goals is never "met": that would clear it on the first settle. */
export function goalsMet(state: GoalState, context: GoalContext): boolean {
  if (state.goals.length === 0) return false;
  return state.goals.every((_, index) => {
    const goal = state.goals[index];
    return currentFor(state, index, context) >= targetOf(goal);
  });
}
