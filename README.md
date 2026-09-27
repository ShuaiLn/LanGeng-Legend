# 烂梗传奇 · Meme Match

A match-3 web game starring Chinese internet meme characters. Swap, match, chain combos and blow things up, in
60-second Endless runs or 20 goal-driven levels on three difficulties. Chinese and English, no accounts, everything
saved in the browser.

Next.js (App Router) + TypeScript + Tailwind CSS for the app, Phaser 4 for the board.

## Quick start

Needs Node 22.12+ and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Vitest: game logic, storage, i18n, audio policy, config, layout maths. Fixed seeds, so nothing flakes |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / ESLint |
| `npm run assets:build` | Regenerate `public/game/` from `assets/`, only when art or audio changes ([Art and audio](#art-and-audio)) |
| `BALANCE=1 npm test` | Also runs the full balance bands: 20 levels × 3 difficulties of simulated play, about 10 min |
| `CALIBRATE=1 npx vitest run game/core/__tests__/calibrate.test.ts` | Plays candidate levels to find balance numbers ([Balance](#balance)) |

`BALANCE=1` and `CALIBRATE=1` are POSIX syntax; in PowerShell write `$env:BALANCE = "1"; npm test`.

## Screens

The flow is **Home → Play → Mode picker → (Level Mode → Level grid → level popup → Game | Endless → Game)**.

| Route | What is there |
| --- | --- |
| `/` | On a fresh load: a white intro (studio mark, "Developed by Ning"), a fade to the cover (the logo, and "Tap to start" once the assets are loaded), then the start screen: logo, Play / Settings / How to Play, the 中文 \| English switch, and character art falling gently behind everything. Play opens the mode picker. The opening plays once per page load and only on `/`; other entry points get the plain loading screen. |
| `/levels` | Level Select: a 4-column (5 from 640px) grid of the 20 levels. A cell shows the best stars the level has on any difficulty, a lock, or a tint for the next one to beat. Tapping an open level opens a **popup** (a bottom sheet on phones): the chapter, the **difficulty selector** (Easy / Normal / Hard, starting on the last one played), that difficulty's stars and best score, goals, moves and star lines, and **Start level**. A locked level only explains what unlocks it. Esc or a tap outside closes. |
| `/play?mode=endless`<br>`/play?mode=level&level=N&difficulty=D` | The game. No site header: on a wide screen one centred **strip** above the board (Pause, title, score / moves / combo, the goals or the Endless best), on a phone the same parts stacked around it. There is no Home button in gameplay. A level link without a valid level, or to a locked level, goes to `/levels`. |
| `/settings` | Language, master sound switch, one switch per tile, and "Your Tile" (custom picture upload). |
| `/how-to-play` | The rules, and the fan-work disclaimer. |
| `/gallery` | All 11 characters; tap a tile to hear its sound. |

## Game systems

### Modes

- **60-Second Endless.** Score as much as you can. When the clock hits zero, input locks at once but a cascade that is
  already animating plays out before the result screen. The best score is saved (only when a run *ends* and beats it)
  and shown at the right end of the top bar, or as a chip in the strip above the board on wide screens.
- **Level Mode.** 20 levels in four chapters (warm-up, chains, precision, mastery). Each level has one to three goals
  and a move limit, and is cleared when **all** goals are met at the next settle. Goal kinds: reach a **score**,
  **collect** N tiles of a highlighted character (a different one every attempt, never the custom tile), **make** N
  special tiles, or reach a **chain** of ×N in one move. Clearing triggers the celebration: every leftover move becomes
  a striped/wrapped tile that auto-detonates for bonus score, then 1–3 stars are awarded against the _final_ score.
  Completing a level always says **`Clear！！`** (banner and result card, in both languages), then the result card
  plays the victory jingle once.

Every Endless game rolls 7 of the 11 library characters (`ACTIVE_POOL_SIZE` in `game/config/characters.ts`) on an 8x8
board. A level chooses both its **board size** (8x8 or 9x9, `gridSize`, capped by `MAX_GRID_SIZE`) and its **number of
characters** (6, 7 or 8, `poolSize`); the two vary independently, neither climbs steadily, and neither is ever changed
by the difficulty. A custom tile uploaded in Settings joins the board, takes one of those slots and always sits in the
last one.

### Difficulty

A level is authored once, at Normal; a difficulty is a small modifier profile (`game/config/difficulty.ts`) applied by
the pure `resolveLevel(number, difficulty)`.

|        | Moves | Goals | 2★ / 3★ lines |
| ------ | ----- | ----- | ------------- |
| Easy   | ×1.2  | ×0.8  | ×0.65         |
| Normal | ×1    | ×1    | ×1            |
| Hard   | ×0.92 | ×1.1  | ×1.10         |

The star lines move further than the goals on purpose: an Easy player meets a lower goal with moves to spare, and the
bonus those moves turn into is worth less than playing them, so their final score ends up below a Normal player's; a
mild multiplier would make Easy stars _harder_ than Normal's. Each line is also kept at least one 50-point step above
the one before it (a lowered goal can never swallow a lowered 2★ line). Scoring, matching, cascades, special
generation, the RNG, the board size and the pool size are untouched. All arithmetic is on integers, so no float drift
moves a boundary. The chosen difficulty rides in the URL (`…&difficulty=D`), so it stays active through Start, Replay
and Next Level.

### Progress

`meme-match:progress:v1` in `localStorage` (no accounts). **Unlocks are shared across difficulties** (level N opens
once N−1 has a star on *any* difficulty; derived, never stored). **Stars and best scores are per difficulty** (Easy L8
★★★, Normal L8 ★★ and Hard L8 ★ are independent records; a worse replay never lowers one). The old single best score
(`meme-match:level-best:demo-1`) is imported once as Normal level 1 and left in place.

### Pause

The Pause button, **Esc**, the phone's **Back** button, or the tab going to the background opens the Pause menu:
**Resume** or **Return to Home**. The scene owns the pause (`scene.pause()` stops its update, which drives tweens and
the Endless clock); React only asks for it through events, so Resume continues the very same animation with the same
session, board, score, moves, time and selection. It is not offered once a level is won (the celebration runs on
wall-clock timers) or a game has ended. In Endless the board is covered while paused, so a stopped clock is not free
thinking time. `useBackToPause` keeps one sentinel history entry while a game is in progress, so Back pauses instead of
leaving; when a game ends the sentinel is spent and the next Back leaves.

### Always a move to make

`ensurePlayable` (`game/core/playable.ts`) is the one call that guarantees a board with no 3-run and at least one valid
move, walking four bounded tiers: shuffle the tiles (uids and specials travel) → re-roll the characters from the whole
pool → a deterministic lattice plus one `X X Y X` motif → a fresh board. The resolver calls it after every settled loop
(a reshuffle step reports which tier fixed the board), and `BoardScene.settle` looks once more as a safety net. The
celebration's bonus blasts do not reshuffle, since the level is already won.

### Elimination effects

A normal clear (the pass your swap triggers) flashes each tile **red**; every chained pass (combo) flashes **gold**,
with a gold glow, sparkles and a random meme shout (`COMBO_MEME_POOL` in `game/config/callouts.ts`: the same in both
languages, never the same one twice in a row; the HUD's Combo box keeps the count, and the chain length only sizes the
pop). The flash is a flat-colour silhouette copy of the sprite (`setTint(...).setTintMode(FILL)`), so it follows the
art's own transparency and works on yellow and red sprites where a multiply tint would vanish. Gold is reserved for
combos (and stars); sky blue is for everything interactive.

### Language

中文 and English, with a typed dictionary per language (`lib/i18n/messages/`; `en.ts` is the source of truth and `zh.ts`
is compiled against it). Chinese is the default (the browser language is not consulted, so server and client agree),
the choice is stored in `meme-match:language:v1` the moment it changes, and `<html lang>` follows it. The scene owns no
copy: callouts that carry words of the interface ship a key and a count, and React renders them. Meme phrases, the
"Developed by Ning" credit and the characters' display names are content and stay verbatim in both languages; the
character names are still dictionary keys (`char.<id>`), so translating them later is a one-file edit.

### Custom tile

Settings → Your Tile stores one picture (centre-cropped to 256×256 WebP) in `localStorage`, so it lives in this browser
only. `CharacterAssetSet.sound` already exists for a future custom sound; until then the tile is silent and the Gallery
shows "No sound" for it.

## Project layout

```
app/            routes and the design tokens (globals.css)
components/     React UI: ui/ primitives, menu, levels/, settings, gallery, results/, play screen (top bar, stats,
                goals, pause), callouts, loading gate, opening/
game/core/      pure TS, no Phaser: matcher, board, playable, resolver, scoring, goals, session, pause, celebration,
                events, rng
game/config/    characters, assets/manifest, game constants, callouts, levels + difficulty, canvas theme
game/scenes/    BootScene + BoardScene (rendering, input, animation, pause); all logic is delegated to core/
lib/            localStorage stores (progress, Endless best, language, audio settings, custom tile), startup asset
                preloader, menu falling-tile specs, opening timeline
lib/audio/      AudioManager (Web Audio) + soundPolicy (pure rules: top 3 per clear, 5-voice cap, mute logic, victory once)
lib/i18n/       typed en / zh dictionaries, t()
assets/         raw art and audio (never modified): images/ (tiles only), audio/, brand/ (studio mark, cover logo)
public/game/    generated by `npm run assets:build`; committed, because `npm run build` does not run it
scripts/        build-assets.mjs
```

## Architecture rules

Worth knowing before you change things. Tests enforce the ones marked (test).

- **Client/server boundary.** Phaser touches `window`, so it is only loaded via `next/dynamic(..., { ssr: false })` from
  a Client Component (`PlayScreen`); `app/play/page.tsx` stays a Server Component.
- **One event bus** (`game/core/events.ts`) connects React and Phaser. Every listener has a matching removal (React
  `useEffect` cleanup, scene shutdown), and events carry a `sessionId` so stale sessions are ignored.
- **Audio lives outside Phaser.** `lib/audio/audioManager.ts` is a module singleton that survives route changes (Phaser
  is destroyed on every exit from `/play`). One clear event plays at most 3 sounds, one per character; at most 5 tile
  voices overlap and the newest 5 win. The victory jingle is deduped per session. The Gallery uses the same manager and
  policy. The knobs are `AUDIO` in `game/config/gameConfig.ts`.
- **Startup preload.** `AssetGate` (in the root layout) fetches every tile and sound once, behind a loading screen; a
  failure degrades to a text tile / silence with a notice instead of blocking. On a fresh load of `/` that cover is the
  opening (`components/opening/`): its timeline is CSS, with every delay and duration coming from `lib/opening.ts`, and
  under `prefers-reduced-motion` it is shorter and opacity-only.
- **Randomness is injected** (`rng: () => number`); tests pass `createRng(seed)` so nothing flakes.
- **Celebration is cancellable.** Retry, navigation or unmount cancels its timers via a token, and bonus tiles are
  tracked by `uid`, never by board coordinates.
- **A tile is its art and nothing else.** No wells, no cell structure, no special-tile plate, no selection fill: the
  art sits straight on the white board card, a special tile adds sky-blue markers over it, and a selected tile gets an
  outline ring only. (test: `assets.test.ts` checks every published tile has transparent corners and a transparent
  share inside its bounding box; `shapes.test.ts` fails if any of those layers comes back.)
- **Radius, size and shadow.** Six radii only (6 / 7 / 9 / 14 / 16 / 18px, `rounded-chip` … `rounded-board` in
  `globals.css`; buttons are the sharpest: 9px large, 7px compact). Pills are for progress bars, the Switch and the
  equalizer bars. Large buttons are 52px, compact 44px. (test: `radius.test.ts` fails on a stray `rounded-full` or an
  undefined `rounded-*` class.)
- **Design tokens** are in `app/globals.css` (light, white + sky blue); `game/config/theme.ts` mirrors the few values
  the canvas needs. Text colours are checked for WCAG AA against the surfaces they sit on.
- **Play layout.** One component tree, two CSS compositions (`.play-root` in `globals.css`, no JS measuring). Portrait
  stacks top bar / stats / board / goals inside `100dvh` (the board is `min(100cqw, 100cqh)` of its slot). A viewport of
  5:4 or wider wraps top bar, stats and goals in one centred `.play-strip` above the board (in portrait the strip is
  `display: contents`); the board's row is `minmax(220px, 700px)`, so it is whatever square is left under the strip, at
  most 700px, and the strip + board pair is centred in the viewport (`align-content: safe center`). Goals and the
  Endless best become 44px chips there; the first-attempt hint is left out (dismissing it would resize the board), and a
  phone on its side (`tight`) drops the title and Pause's label to stay on one row. The board is square for both grid
  sizes (cells are `floor(min(width, height) / gridSize)`: 36px on a 9x9 board at 360x640, 32px at 320x568). Safe areas
  are respected on all four sides and the page never scrolls during play.
- **Device-resolution canvas.** The Phaser canvas backing store is `CSS size × devicePixelRatio` (capped at 3), sized in
  `game/index.ts` because Phaser's RESIZE mode is CSS-pixel only. Inside the game everything is in game pixels;
  `registry.get("dpr")` converts the few CSS-pixel quantities (swipe distance, particle physics, callout positions).
- **Menu background.** `FallingTiles` draws fourteen (nine on phones) 128px character images at 46–80px
  (`public/game/tiles-sm/`) falling behind the UI: transform-only, no filters, non-interactive, `aria-hidden`, hidden
  under `prefers-reduced-motion`. With only 11 characters one can appear twice (React keys are `id-lane`). Positions
  come from the seeded, pure `lib/menuFall.ts`, so server and client markup match.

## Art and audio

Raw files live in `assets/` and are never modified. `npm run assets:build` publishes them under `public/game/`:

```
assets/images/*.png   ->  public/game/tiles/<stem>.webp      transparent margins trimmed, contain-fit on a 512x512
                                                             transparent square, lossless WebP
(each tile above)     ->  public/game/tiles-sm/<stem>.webp   128x128 copy, lossless, alpha kept: the menu's falling
                                                             tiles (decoration only, not preloaded)
assets/audio/*.mp3    ->  public/game/audio/<stem>.mp3       copied, lower-cased (Victory.mp3 -> victory.mp3)
assets/brand/icon.png ->  public/game/brand/icon.webp        the studio mark, 256px, alpha kept
assets/brand/logo.jpg ->  public/game/brand/logo.webp        the cover art, 720px, cut out of its margin (see below)
```

The script is idempotent (unchanged files are not rewritten). Tiles are square powers of two on purpose: Phaser 4 runs
WebGL1, which can only build mipmaps for power-of-two textures, and mipmaps keep the sprites from shimmering.

`assets/images/` holds tiles only: every PNG there must be a character, and `assets.test.ts` enforces it. The two brand
files live in `assets/brand/` so they can never be published as a tile.

`logo.jpg` has no alpha, and its card sits in a full-bleed margin (white to sky blue) that would show as a hard-edged
rectangle on any other background. The build step therefore crops to the card and applies a rounded-rectangle alpha
mask (`LOGO_SHAPES` in `scripts/build-assets.mjs`, in pixels of the source). If the source is replaced, re-measure those
numbers and look at `public/game/brand/logo.webp` on both white and `#EAF4FF`.

### Adding or replacing a character

`game/config/characters.ts` is the single id → art → sound mapping. File names and ids differ (`kunkun` → `Kun`, `mj` →
`Spider`, `sixseven` → `67`), so the stem is spelled out per character.

1. Drop `<Stem>.png` in `assets/images/` and `<Stem>.mp3` in `assets/audio/`.
2. Add an entry to `CHARACTER_LIBRARY` with `libraryAssets("<stem lower-cased>")`, and a `char.<id>` key in both
   `lib/i18n/messages/en.ts` and `zh.ts`.
3. `npm run assets:build`, then **bump `ASSET_VERSION`** in `game/config/assetUrl.ts`.
4. `npm test`. `assets.test.ts` fails if a referenced file is missing or a source file is not referenced, and it pins
   the library size (11), so update that number on purpose.

### Caching

Files under `/public` are served with `max-age=0` by default, so `next.config.ts` sends
`Cache-Control: public, max-age=31536000, immutable` for `/game/*` in production, and every URL carries
`?v=<ASSET_VERSION>` (`game/config/assetUrl.ts`). **Bump `ASSET_VERSION` whenever you regenerate the art or audio.**
Dev keeps the default headers, so art edits show at once.

## Balance

The 20 levels in `game/config/levels.ts` were tuned against simulated play: bots drive the real session, resolver and
celebration (`game/core/__tests__/bots.ts`). The *goal bot* is a one-ply optimiser that scores every valid swap by how
much it advances the goals still open; the *random bot* taps a random valid move (the floor of "a player who does not
think"). `levelBalance.test.ts` runs a smoke test by default and the full bands with `BALANCE=1`:

- Normal goes from about 100% for the goal bot on level 1 down to about 50–60% on level 20 (L1–4 ≥ 90%, L5–12 ≥ 70%,
  L13–20 ≥ 45%).
- Easy stays above 85%.
- Hard is a real step up (a few percent for random tapping).

Real players sit between the two bots, so a human playtest pass is still worth doing before release.

**Stars are generous.** On Normal the 2★ line is the 10th percentile of a level's winning scores (about 90% of wins
earn it, never less than one 50-point step over the score goal) and the 3★ line the 40th (about 60% of wins). The
difficulties are ordered per attempt (P(≥2★) and P(≥3★) = wins ending on that many stars or more, over games played):
per level Easy ≥ Normal ≥ Hard, and averaged over the 20 levels each step is at least 8 points at both tiers (about
99 / 79 / 53 for ≥2★ and 95 / 51 / 26 for ≥3★ by the goal bot). Hard's 3★ stays reachable (at least 5% of attempts).

**Changing a level.** The board size and the number of characters change how a level plays (a 9x9 board and fewer
characters both score more per move and make matches and collects easier), so re-tune the goal after touching either.
`calibrate.test.ts` plays a JSON list of jobs from `calibrate.jobs.json` and writes `calibrate.out.json` (both are
gitignored; `CALIBRATE_JOBS` and `CALIBRATE_OUT` override the names):

```json
[{ "level": 5, "difficulty": "normal", "seeds": 200, "def": { "moves": 20, "goals": [{ "type": "collect", "slot": 0, "count": 12 }] } }]
```

A job plays `seeds` games (default 60; `salt` offsets the seed sequence, so a check can use games the tuning never
saw) with `bot` `"goal"` (default) or `"random"`. `def` overrides parts of the authored Normal definition (`moves`,
`goals`, `gridSize`, `poolSize`, `twoStar`, `threeStar`), and the difficulty is derived from it by the real profile
rules. Each job's win rate and every winning final score are written out. Star lines never change how a bot plays, so
those scores are enough to re-grade any lines offline. The current goals were tuned by keeping each changed level at the
win rate it had before its board or character count changed, then setting the lines from two independent 200-game
samples per level.

## Disclaimer

本作品为粉丝同人，和原作公司无关，所有角色版权归各自原作者
