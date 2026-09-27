import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPENING_FULL, OPENING_REDUCED, openingCssVars, type OpeningTimeline } from "../opening";

describe("opening timeline", () => {
  for (const [name, t] of [
    ["full", OPENING_FULL],
    ["reduced", OPENING_REDUCED],
  ] as [string, OpeningTimeline][]) {
    it(`${name}: fades in, holds, then crossfades to the cover, logo before hint`, () => {
      expect(t.inAt + t.inMs, "intro is fully visible before it starts to leave").toBeLessThan(t.outAt);
      expect(t.logoAt, "the logo starts while the intro is still leaving").toBeGreaterThanOrEqual(t.outAt);
      expect(t.logoAt).toBeLessThan(t.outAt + t.outMs);
      expect(t.contentOutMs, "the intro content clears no slower than the white behind it").toBeLessThanOrEqual(t.outMs);
      expect(t.hintAt, "the hint waits for the logo").toBeGreaterThanOrEqual(t.logoAt + t.logoMs);
      for (const ms of Object.values(t)) expect(Number.isInteger(ms) && ms >= 0).toBe(true);
    });
  }

  it("matches the brief: icon and credit in at 0.2-1.1s, crossfade 2.1-2.9s, logo 2.3-3.2s", () => {
    expect([OPENING_FULL.inAt, OPENING_FULL.inAt + OPENING_FULL.inMs]).toEqual([200, 1100]);
    expect([OPENING_FULL.outAt, OPENING_FULL.outAt + OPENING_FULL.outMs]).toEqual([2100, 2900]);
    expect([OPENING_FULL.logoAt, OPENING_FULL.logoAt + OPENING_FULL.logoMs]).toEqual([2300, 3200]);
  });

  it("reduced motion is strictly shorter than the full timeline", () => {
    expect(OPENING_REDUCED.hintAt + OPENING_REDUCED.hintMs).toBeLessThan(OPENING_FULL.hintAt + OPENING_FULL.hintMs);
    expect(OPENING_REDUCED.outAt).toBeLessThan(OPENING_FULL.outAt);
  });

  it("exposes every field of both timelines as a kebab-cased ms custom property", () => {
    const vars = openingCssVars();
    expect(vars["--op-in-at"]).toBe("200ms");
    expect(vars["--op-logo-ms"]).toBe("900ms");
    expect(vars["--opr-hint-at"]).toBe("1300ms");
    expect(vars["--opr-exit-ms"]).toBe("300ms");
    expect(vars["--op-content-out-ms"]).toBe("300ms");
    expect(Object.keys(vars)).toHaveLength(Object.keys(OPENING_FULL).length * 2);
    for (const [name, value] of Object.entries(vars)) {
      expect(name).toMatch(/^--opr?-[a-z-]+$/);
      expect(value).toMatch(/^\d+ms$/);
    }
  });
});

describe("opening seen flag", () => {
  beforeEach(() => {
    vi.resetModules(); // the flag is module state: each test gets a fresh page load
  });

  it("starts unseen and stays seen for the rest of the page load", async () => {
    const opening = await import("../opening");
    expect(opening.openingSeen()).toBe(false);
    opening.markOpeningSeen();
    expect(opening.openingSeen()).toBe(true);
    opening.markOpeningSeen();
    expect(opening.openingSeen()).toBe(true);
  });

  it("does not leak between page loads", async () => {
    const first = await import("../opening");
    first.markOpeningSeen();
    vi.resetModules();
    const second = await import("../opening");
    expect(second.openingSeen()).toBe(false);
  });
});
