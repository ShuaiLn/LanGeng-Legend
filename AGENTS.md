<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Meme Match: notes for agents

A match-3 web game: Next.js 16 (App Router) + TypeScript + Tailwind 4 (no `tailwind.config`, the tokens live in
`app/globals.css`) + Phaser 4 for the board. [README.md](README.md) is the full reference (screens, game systems,
architecture rules, art pipeline, balance); this file is what to run and what is easy to break.

## Before you say it is done

| You touched | Run |
| --- | --- |
| anything | `npm test`, `npm run typecheck`, `npm run lint` |
| routes, `next.config.ts`, CSS, anything that only a bundler would catch | also `npm run build` |
| `levels.ts`, `difficulty.ts`, scoring, resolver, playable, celebration, the bots | also `BALANCE=1 npm test` (about 10 min) |
| `assets/` or `scripts/build-assets.mjs` | `npm run assets:build`, then bump `ASSET_VERSION` (`game/config/assetUrl.ts`) |
| behaviour or numbers the README describes | update the README in the same change |

Every test uses a fixed seed, so a red test is a real failure, not flakiness. A `next dev` server may already be running
on :3000 and serves the current code; `next build` is safe alongside it.

## Rules that are easy to break

- **`game/core/` is pure TypeScript**: no Phaser, no React, no `window`. Randomness is injected (`rng: () => number`);
  tests pass `createRng(seed)`. `BoardScene` renders and delegates every rule to `core/`.
- **React and Phaser talk only through the event bus** (`game/core/events.ts`). Give every listener a matching removal,
  and carry the `sessionId` so stale sessions are ignored.
- **Phaser is client-only.** Load it through `next/dynamic(..., { ssr: false })` from a Client Component
  (`PlayScreen`); `app/play/page.tsx` stays a Server Component.
- **The scene owns no copy.** Interface words live in `lib/i18n/messages/`: add a key to `en.ts` (the source of truth)
  and `zh.ts` (compiled against it). Meme phrases, the "Developed by Ning" credit and character names are content and
  stay verbatim in both languages.
- **Levels are authored once, at Normal** (`game/config/levels.ts`). Difficulty is a profile in `difficulty.ts`, on
  integer arithmetic, never a per-difficulty number. After touching a level's `gridSize`, `poolSize` or goals, re-tune it
  with the calibrate harness (README, Balance) and rerun `BALANCE=1`.
- **Stored data is versioned**: keys look like `meme-match:<name>:v1`. Changing a stored shape needs a new version and a
  one-off import from the old key (see how `progressStorage.ts` imports the old level best).
- **Look is enforced by tests.** Only the six radius tokens and no stray `rounded-full` (`lib/__tests__/radius.test.ts`);
  a tile is its art with no well, plate or selection fill (`game/scenes/__tests__/shapes.test.ts`,
  `game/config/__tests__/assets.test.ts`). A colour used on the canvas is mirrored in `game/config/theme.ts`: change both.
- **Never edit `assets/` in place or hand-edit `public/game/`.** Regenerate with `npm run assets:build`. `assets/images/`
  holds tiles only. `public/game/` is committed on purpose, since `npm run build` does not run the script.
- **Adding a character** is a multi-file change (art, sound, `CHARACTER_LIBRARY`, `char.<id>` keys, `ASSET_VERSION`, and
  the pinned count of 11 in `assets.test.ts`): follow README, "Adding or replacing a character".

## Environment (Windows)

- Set env vars PowerShell-style: `$env:BALANCE = "1"; npm test` (the `BALANCE=1 npm test` form is POSIX only).
- When you spawn vitest by absolute path, use an **uppercase drive letter** (`Z:/...`): a lowercase one loads vitest
  twice and dies with `Cannot read properties of undefined (reading 'config')`.
- After deleting a route, `.next/types/validator.ts` stays stale until the next `next build`, and `tsc` then complains
  about that one file only.
- Dev-only handles for browser-driven checks (absent in production): `window.__game` (the Phaser game;
  `.scene.getScene("BoardScene")`), `window.__memeMatchDebug` (`on` / `emit` / `events`) and `window.__memeMatchAudio`.
- A control clicked right after `goto` can land before hydration: wait about a second. The opening overlay must detach
  (`.op-intro-layer`) before the cover can be tapped. Chinese is the default language whatever the browser reports;
  pass `locale: "en-US"` to test English.

## Git hygiene

`next-env.d.ts`, `*.tsbuildinfo`, `.next/`, `.env*` (except `.env.example`) and `calibrate.*.json` are ignored; do not
commit them. Local Claude Code settings (`.claude/settings.local.json`) are ignored too. Keep the managed block at the
top of this file: `next dev` rewrites it, and only that block.
