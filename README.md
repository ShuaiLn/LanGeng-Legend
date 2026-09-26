# 烂梗传奇 · Meme Match

A match-3 web game starring Chinese internet meme characters. Swap, match, chain combos, and blow things up.

Next.js (App Router) + TypeScript + Tailwind CSS, with Phaser 4 for the board.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest (pure game logic, fixed seeds)
npm run typecheck
npm run lint
npm run build
```

## Modes

- **60-Second Endless** — score as much as you can. When the clock hits zero, input locks immediately but any
  cascade already animating plays out before the result screen appears.
- **Demo Level** — reach 1,200 points in 20 moves. Reaching the goal triggers the celebration: every leftover move
  becomes a striped/wrapped tile that auto-detonates for bonus score, then 1–3 stars are awarded against the *final*
  score (thresholds 1,200 / 2,000 / 3,000). Best score is kept in `localStorage`.

Every game rolls 7 of the 11 library characters and uses only those on the board (`ACTIVE_POOL_SIZE` in
`game/config/characters.ts`). Upload your own picture on the home page and it joins the board as a character (it takes
one of the 7 slots).

## How it is organised

```
game/core/     pure TS, no Phaser: matcher, board, resolver, scoring, session, celebration, events, rng
game/config/   characters, game constants, callouts, levels
game/scenes/   BootScene + BoardScene (rendering, input, animation) — delegates all logic to core/
components/    React UI (HUD, callouts, banner, star reveal, result screens, upload)
app/           routes: /  /play  /gallery
lib/           localStorage helpers
```

Design rules worth knowing before you change things:

- **Client/Server boundary.** Phaser touches `window`, so it is only loaded via `next/dynamic(..., { ssr: false })`
  from a Client Component (`PlayScreen`); `app/play/page.tsx` stays a Server Component.
- **One event bus** (`game/core/events.ts`) connects React and Phaser. Every listener has a matching removal (React
  `useEffect` cleanup, scene shutdown), and events carry a `sessionId` so stale sessions are ignored.
- **Randomness is injected** (`rng: () => number`); tests pass `createRng(seed)` so nothing flakes.
- **Celebration is cancellable.** Retry, navigation or unmount cancels its timers via a token, and bonus tiles are
  tracked by `uid`, never by board coordinates.

## Balance

`DEMO_LEVEL` in `game/config/levels.ts` was tuned against simulated play (`game/core/__tests__/balance.test.ts`):
base play scores roughly 55–80 points per move, so the numbers are deliberately modest. If you change scoring or the
thresholds and that test fails, the upper star tiers have probably become unreachable.

## Art

Everything is a text placeholder for now. See `public/assets/characters/README.md` for the asset spec.

## Disclaimer

本作品为粉丝同人，和原作公司无关，所有角色版权归各自原作者
