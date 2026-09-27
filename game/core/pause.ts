import type { SessionStatus } from "./session";

/**
 * The pure rules of pausing. The scene owns the actual pause (`scene.pause()`); React only asks
 * through events. Keeping the rules here makes them testable without Phaser or React.
 */

export type PauseAction = "pause" | "resume";

export interface PauseContext {
  paused: boolean;
  status: SessionStatus;
  /** The scene is shutting down or restarting: nothing may change. */
  inert: boolean;
}

/** Only a game in progress can be paused: not while celebrating a win, and not once it has ended. */
export function canPause(status: SessionStatus): boolean {
  return status === "playing";
}

/**
 * The next pause state for an action. Idempotent both ways: pausing twice is one pause, resuming
 * a game that is not paused does nothing, and a game that cannot be paused stays as it is.
 * `changed` is what the scene uses to decide whether to act (and to announce it).
 */
export function pauseTransition(context: PauseContext, action: PauseAction): { paused: boolean; changed: boolean } {
  if (context.inert) return { paused: context.paused, changed: false };
  if (action === "pause") {
    if (context.paused || !canPause(context.status)) return { paused: context.paused, changed: false };
    return { paused: true, changed: true };
  }
  if (!context.paused) return { paused: false, changed: false };
  return { paused: false, changed: true };
}
