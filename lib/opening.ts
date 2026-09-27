/**
 * Timeline of the opening (white intro, then the cover) and the once-per-page-load flag.
 *
 * The timeline is CSS-driven: these numbers are the single source, handed to the stylesheet as
 * custom properties (`openingCssVars`) so nothing re-renders while it plays. All times are ms from
 * the first paint of the server HTML, which is when the CSS animations start.
 */
export interface OpeningTimeline {
  /** The icon and the credit line fade in together. */
  inAt: number;
  inMs: number;
  /** The intro fades out, revealing the cover that has been sitting underneath. */
  outAt: number;
  outMs: number;
  /** The mark and the credit clear faster than the white behind them, so they never sit on the logo. */
  contentOutMs: number;
  /** The logo, the cover's only visual. */
  logoAt: number;
  logoMs: number;
  /** "Tap to start". */
  hintAt: number;
  hintMs: number;
  /** The cover fading away over the menu after a tap. */
  exitMs: number;
}

/** 0.2s of white, 0.9s fade in, 1s hold, 0.8s crossfade (content gone by 2.4s), logo settles from 2.3s, hint at 3.3s. */
export const OPENING_FULL: OpeningTimeline = {
  inAt: 200,
  inMs: 900,
  outAt: 2100,
  outMs: 800,
  contentOutMs: 300,
  logoAt: 2300,
  logoMs: 900,
  hintAt: 3300,
  hintMs: 500,
  exitMs: 400,
};

/** `prefers-reduced-motion`: the same order of events, opacity only, and much shorter. */
export const OPENING_REDUCED: OpeningTimeline = {
  inAt: 100,
  inMs: 300,
  outAt: 1000,
  outMs: 300,
  contentOutMs: 200,
  logoAt: 1000,
  logoMs: 300,
  hintAt: 1300,
  hintMs: 300,
  exitMs: 300,
};

const kebab = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * `--op-in-at: 200ms` and so on for the full timeline, `--opr-*` for the reduced one. The stylesheet
 * picks between the two with one `prefers-reduced-motion` block (see `.op-root` in globals.css).
 */
export function openingCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [prefix, timeline] of [
    ["--op", OPENING_FULL],
    ["--opr", OPENING_REDUCED],
  ] as const) {
    for (const [key, ms] of Object.entries(timeline)) vars[`${prefix}-${kebab(key)}`] = `${ms}ms`;
  }
  return vars;
}

// Module state, not React state: the opening plays once per page load, so menu -> play -> home
// (client-side navigation, nothing reloads) never replays it.
let seen = false;

export function openingSeen(): boolean {
  return seen;
}

export function markOpeningSeen(): void {
  seen = true;
}
