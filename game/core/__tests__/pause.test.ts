import { describe, expect, it } from "vitest";
import { canPause, pauseTransition, type PauseContext } from "../pause";
import type { SessionStatus } from "../session";

const ctx = (overrides: Partial<PauseContext> = {}): PauseContext => ({
  paused: false,
  status: "playing",
  inert: false,
  ...overrides,
});

describe("canPause", () => {
  it("is true only while a game is in progress", () => {
    const answers: Record<SessionStatus, boolean> = { playing: true, celebrating: false, ended: false };
    for (const [status, expected] of Object.entries(answers)) {
      expect(canPause(status as SessionStatus), status).toBe(expected);
    }
  });
});

describe("pauseTransition", () => {
  it("pauses a running game", () => {
    expect(pauseTransition(ctx(), "pause")).toEqual({ paused: true, changed: true });
  });

  it("resumes a paused game", () => {
    expect(pauseTransition(ctx({ paused: true }), "resume")).toEqual({ paused: false, changed: true });
  });

  it("is idempotent: pausing twice is one pause, resuming twice is one resume", () => {
    const once = pauseTransition(ctx(), "pause");
    expect(pauseTransition(ctx({ paused: once.paused }), "pause")).toEqual({ paused: true, changed: false });
    const resumed = pauseTransition(ctx({ paused: true }), "resume");
    expect(pauseTransition(ctx({ paused: resumed.paused }), "resume")).toEqual({ paused: false, changed: false });
  });

  it("ignores a resume when the game is not paused", () => {
    expect(pauseTransition(ctx(), "resume")).toEqual({ paused: false, changed: false });
  });

  it("cannot pause a level that is being celebrated or has ended", () => {
    for (const status of ["celebrating", "ended"] as const) {
      expect(pauseTransition(ctx({ status }), "pause"), status).toEqual({ paused: false, changed: false });
    }
  });

  it("still resumes a paused game whose session moved on (nothing can leave it stuck paused)", () => {
    expect(pauseTransition(ctx({ paused: true, status: "ended" }), "resume")).toEqual({ paused: false, changed: true });
  });

  it("changes nothing while the scene is shutting down or restarting", () => {
    expect(pauseTransition(ctx({ inert: true }), "pause")).toEqual({ paused: false, changed: false });
    expect(pauseTransition(ctx({ inert: true, paused: true }), "resume")).toEqual({ paused: true, changed: false });
  });
});
