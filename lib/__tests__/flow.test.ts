import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { zh } from "../i18n/messages/zh";
import { FALL_LIMITS } from "../menuFall";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** Source without comments, so prose is not read as code. */
const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(?<![:"'`])\/\/[^\n]*/g, "");

describe("Home -> Play -> Mode Picker -> Level Grid -> Level Popup (difficulty) -> Game", () => {
  it("the Mode Picker sends Level Mode to the level grid and Endless straight into the game", () => {
    const picker = code("components/ModePicker.tsx");
    expect(picker).toMatch(/href="\/levels"[\s\S]*?t\("mode\.level\.title"\)/);
    expect(picker).toMatch(/href="\/play\?mode=endless"[\s\S]*?t\("mode\.endless\.title"/);
    expect(picker).not.toContain("/play?mode=level");
  });

  it("the level grid is the first Level Mode screen: no difficulty page, no per-difficulty route", () => {
    expect(existsSync(path.join(root, "app/levels/[difficulty]"))).toBe(false);
    for (const gone of ["DifficultySelect", "DifficultyRow", "LevelDetail"]) {
      expect(existsSync(path.join(root, `components/levels/${gone}.tsx`)), gone).toBe(false);
    }
    const page = code("app/levels/page.tsx");
    expect(page).toContain("<LevelSelect />"); // no difficulty prop
    expect(page).not.toContain("width="); // the standard column: the header and the grid share one left edge
    const select = code("components/levels/LevelSelect.tsx");
    expect(select).toContain('backHref="/"'); // Back from the grid is the main menu
    expect(select).not.toMatch(/DifficultySelect|difficulty: Difficulty|Segmented|setLastDifficulty/);
  });

  it("tapping an open level opens the popup; a locked level only explains itself", () => {
    const select = code("components/levels/LevelSelect.tsx");
    expect(select).toContain("<LevelDialog");
    expect(select).toContain("setChosen(level)");
    expect(select).toMatch(/isUnlocked\(progress, level\)[\s\S]*?levels\.lockedHint[\s\S]*?return;/);
    expect(select).toContain("bestStarsAcross"); // a cell shows the best stars over the three difficulties
    expect(select).toContain("unlockedUpTo"); // the "current" level is the unlock frontier
    expect(select).toContain("MAX_STARS");
    const cell = code("components/levels/LevelCell.tsx");
    expect(cell).toContain("aria-disabled");
    expect(cell).not.toMatch(/aria-pressed|selected/);
  });

  it("the popup is a native modal dialog with the difficulty on top, stars, goals and Start at the bottom", () => {
    const dialog = code("components/levels/LevelDialog.tsx");
    expect(dialog).toContain("<dialog");
    expect(dialog).toContain("showModal()");
    expect(dialog).toContain("onClose={onClose}"); // Esc
    expect(dialog).toContain("event.target === ref.current"); // a click on the scrim
    expect(dialog).toContain("max-sm:mt-auto"); // a bottom sheet on phones
    expect(dialog).toContain("rounded-card");
    expect(dialog).toContain('t("common.close")');
    // top to bottom: header, difficulty selector, stars, the facts, Start
    const order = ["levels.levelN", "<Segmented", "<Stars", "<LevelFacts", "levels.startLevel"].map((needle) =>
      dialog.indexOf(needle, dialog.indexOf("export default function LevelDialog"))
    );
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(dialog).toContain('t("levels.difficultyLabel")');
    expect(dialog).toContain('progress.lastDifficulty ?? "normal"'); // the initial difficulty
    expect(dialog).toContain("key={`${level}-${difficulty}`}"); // stars pop again when the difficulty changes
    expect(dialog).toContain("recordFor(progress, difficulty, level)");
    expect(dialog).toContain("size={48}");
  });

  it("Start carries the level AND the difficulty into the game, and remembers the difficulty", () => {
    const dialog = code("components/levels/LevelDialog.tsx");
    expect(dialog).toContain("/play?mode=level&level=${level}&difficulty=${difficulty}");
    expect(dialog).toContain("onClick={() => setLastDifficulty(difficulty)}");
    expect(dialog).toContain('buttonClasses("primary", "large", true)');
  });

  it("the play page sends a level link without a valid level back to the grid, and keys the game by level and difficulty", () => {
    const page = code("app/play/page.tsx");
    expect(page).toContain('redirect("/levels")');
    expect(page).toMatch(/key=\{`level-\$\{chosen\}-\$\{levelNumber\}`\}/);
  });

  it("a locked level deep link bounces to the grid before any game starts", () => {
    const screen = code("components/PlayScreen.tsx");
    expect(screen).toContain('router.replace("/levels")');
    expect(screen).toContain("isUnlocked(progress, level.number)");
    expect(screen).toMatch(/canStart = [^;]*!locked/);
  });
});

describe("the difficulty stays active through Next Level and Replay", () => {
  const victory = code("components/results/VictoryCard.tsx");

  it("Next Level is a link to the next level on the SAME difficulty, and cuts the jingle first", () => {
    expect(victory).toContain("level=${result.levelNumber + 1}&difficulty=${result.difficulty}");
    expect(victory).toMatch(/replace[\s\S]{0,120}NEXT_LEVEL_REQUESTED/);
  });

  it("after level 20 the primary button is the level grid, with no Next", () => {
    expect(victory).toContain('href="/levels"');
    expect(victory).not.toContain("/levels/${");
    expect(victory).not.toContain("changeDifficulty"); // the grid already leads to the difficulty choice
    expect(victory).toContain("result.hasNext ?");
  });

  it("Replay restarts in place (the scene keeps the level and difficulty in the registry)", () => {
    expect(victory).toContain("RESTART_REQUESTED");
    const scene = code("game/scenes/BoardScene.ts");
    expect(scene).toContain('this.registry.get("level")');
    expect(scene).toContain("onGameEvent(GameEvents.RESTART_REQUESTED, this.handleRestart)");
  });

  it("the scene does not restart on NEXT_LEVEL_REQUESTED (that is a route change now)", () => {
    expect(code("game/scenes/BoardScene.ts")).not.toMatch(/onGameEvent\(GameEvents\.NEXT_LEVEL_REQUESTED/);
  });
});

describe("level completion says Clear！！, in both languages", () => {
  const OVERLAY_FILES = [
    "components/LevelClearBanner.tsx",
    "components/StarReveal.tsx",
    "components/CalloutLayer.tsx",
    "components/HudStats.tsx",
    "components/GoalPanel.tsx",
    "components/PlayScreen.tsx",
    "components/GameOverScreen.tsx",
    "components/LevelResultPanel.tsx",
    ...sourceFiles("components/results"),
  ];

  it("the banner and the victory card both render the one constant", () => {
    for (const file of ["components/LevelClearBanner.tsx", "components/results/VictoryCard.tsx"]) {
      expect(code(file), file).toContain("LEVEL_CLEAR_CALLOUT");
      expect(code(file), file).toContain('from "@/game/config/callouts"');
    }
    expect(code("components/LevelClearBanner.tsx")).not.toMatch(/\bt\("banner\./);
    expect(code("components/results/VictoryCard.tsx")).not.toContain("result.clear.title");
  });

  it("no in-game overlay spells out Level Clear! / 过关 / 通关 itself", () => {
    for (const file of OVERLAY_FILES) expect(code(file), file).not.toMatch(/Level Clear!|过关|通关/);
  });

  it("the banner.* / result.* / reveal.* messages do not say it either (Level Select's 尚未通关 is a different screen)", () => {
    for (const dictionary of [en, zh] as Record<string, string>[]) {
      for (const [key, value] of Object.entries(dictionary)) {
        if (/^(banner|result|reveal)\./.test(key)) expect(value, key).not.toMatch(/Level Clear!|过关|通关|cleared/i);
      }
    }
  });
});

describe("no demo level is left", () => {
  it("nothing refers to DEMO_LEVEL or getLevelById any more", () => {
    for (const file of [...sourceFiles("components"), ...sourceFiles("app"), ...sourceFiles("game"), ...sourceFiles("lib")]) {
      expect(code(file), file).not.toMatch(/\bDEMO_LEVEL\b|getLevelById|DemoLevel/); // (LEGACY_DEMO_LEVEL_ID, the old storage key, is fine)
    }
  });
});

describe("gameplay has Pause, not Home", () => {
  it("the play screen and its top bar have no link home and no Home copy", () => {
    for (const file of ["components/PlayScreen.tsx", "components/PlayTopBar.tsx", "components/PauseButton.tsx"]) {
      const source = code(file);
      expect(source, file).not.toMatch(/href="\/"/);
      expect(source, file).not.toMatch(/common\.home|result\.home|pause\.home|levels\.backHome/);
      expect(source, file).not.toContain("<Link");
    }
    expect(code("components/PlayTopBar.tsx")).toContain("<PauseButton");
  });

  it("the Pause menu has Resume and Return to Home, and is a native modal dialog", () => {
    const menu = code("components/PauseMenu.tsx");
    expect(menu).toContain('t("pause.resume")');
    expect(menu).toContain('t("pause.home")');
    expect(menu).toContain('href="/"');
    expect(menu).toContain("showModal()");
    expect(menu).toContain("event.preventDefault()"); // Esc resumes instead of closing the dialog behind the game's back
  });

  it("the Pause button is at least 44px and announces a dialog", () => {
    const button = code("components/PauseButton.tsx");
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).toContain('buttonClasses("secondary", "compact"'); // h-11 = 44px
  });

  it("pause is offered only while a game is in progress", () => {
    const hook = code("components/hooks/usePause.ts");
    for (const event of ["LEVEL_OBJECTIVE_MET", "GAME_OVER", "CELEBRATION_RESULT"]) {
      expect(hook).toMatch(new RegExp(`${event}[\\s\\S]{0,40}setCanPause\\(false\\)`));
    }
    expect(hook).toContain('event.key !== "Escape"');
    expect(hook).toContain("visibilitychange");
  });

  it("the Back button opens Pause while a game is in progress, and never leaves mid-game", () => {
    expect(code("components/PlayScreen.tsx")).toContain("useBackToPause(canPause, pause)");
    const hook = code("components/hooks/useBackToPause.ts");
    expect(hook).toContain("window.history.pushState(null");
    expect(hook).toContain('addEventListener("popstate"');
    expect(hook).toContain("window.history.back()");
    // the sentinel is only ever spent when the game ends while still mounted, never in an unmount cleanup
    const cleanup = hook.slice(hook.indexOf("return () =>"), hook.indexOf("}, [active]);"));
    expect(cleanup).not.toContain("history.back");
  });

  it("the Endless board is covered while paused, so a stopped clock is not free thinking time", () => {
    expect(code("components/PlayScreen.tsx")).toMatch(/paused && mode === "endless"/);
  });
});

describe("the play layout is one viewport with two compositions", () => {
  const css = read("app/globals.css");

  it("stacks in portrait inside 100dvh and never depends on scrolling the page", () => {
    expect(css).toMatch(/\.play-root \{[^}]*height: 100dvh/);
    expect(css).toMatch(/\.play-root \{[^}]*grid-template-rows: auto auto minmax\(0, 1fr\) auto/);
    expect(css).toMatch(/\.play-board-slot \{[^}]*container-type: size/);
    expect(css).toMatch(/\.play-board \{[^}]*width: min\(100cqw, 100cqh\)/);
    expect(css).toMatch(/\.play-board \{[^}]*aspect-ratio: 1 \/ 1/);
  });

  it("respects the safe areas on all four sides", () => {
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(css).toContain(`env(safe-area-inset-${side})`);
    }
  });

  /** The rules inside the `@media (min-aspect-ratio: 5/4)` block that holds `.play-strip`. */
  const wide = css.slice(css.indexOf("@media (min-aspect-ratio: 5/4) {\n  .play-root,"));
  const wideBlock = wide.slice(0, wide.indexOf("/* ---- opening + cover"));

  it("puts one centred strip above the board on a wide viewport: no rail, no side-by-side columns", () => {
    expect(wideBlock).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
    expect(wideBlock).toMatch(/grid-template-areas:\s*"strip"\s*"board"/);
    expect(wideBlock).toMatch(/\.play-strip \{[^}]*display: flex/);
    expect(wideBlock).toMatch(/\.play-strip \{[^}]*flex-wrap: wrap/);
    expect(wideBlock).toMatch(/\.play-strip \{[^}]*justify-content: center/);
    expect(wideBlock).toMatch(/\.play-strip \{[^}]*width: fit-content/);
    expect(wideBlock).toMatch(/\.play-strip \{[^}]*max-width: 100%/);
    expect(css).not.toMatch(/--rail|--board\b/);
    expect(css).not.toContain('"board top"');
  });

  it("sizes the wide board to what is left under the strip, at most 700px, and centres the pair", () => {
    expect(wideBlock).toMatch(/\.play-board \{[^}]*width: min\(100cqw, 100cqh, 700px\)/);
    expect(wideBlock).toMatch(/grid-template-rows: auto minmax\(220px, 700px\)/);
    expect(wideBlock).toMatch(/align-content: safe center/);
    // the slot stays a size container, so the board really is measured from what the strip leaves
    expect(css).toMatch(/\.play-board-slot \{[^}]*container-type: size/);
  });

  it("keeps the phone layout: the strip is not a box in portrait, and the portrait board has no 700px cap", () => {
    expect(css).toMatch(/\.play-strip \{\s*display: contents;\s*\}/);
    const portraitBoard = css.match(/\.play-board \{[^}]*\}/)![0];
    expect(portraitBoard).toContain("min(100cqw, 100cqh)");
    expect(portraitBoard).not.toContain("700px");
  });

  it("the play screen wraps top bar, stats and goals in one .play-strip (the board is its sibling)", () => {
    const screen = code("components/PlayScreen.tsx");
    const strip = screen.match(/<div className="play-strip">([\s\S]*?)<div className="play-board-slot">/);
    expect(strip).not.toBeNull();
    for (const part of ["play-top", "play-hud", "play-goals"]) expect(strip![1]).toContain(part);
    expect(strip![1]).toContain("<PlayTopBar");
    expect(strip![1]).toContain("<HudStats");
    expect(strip![1]).toContain("<GoalPanel");
    expect(screen.match(/play-strip/g)).toHaveLength(1);
  });

  it("shows the stats, the goals and the Endless best as chips in the strip, not as rail cards", () => {
    const stats = code("components/HudStats.tsx");
    expect(stats).not.toMatch(/wide:grid-cols-2|wide:col-span-2/);
    expect(stats).toContain("wide:flex");
    expect(stats).toContain("wide:h-11");
    expect(code("components/PlayTopBar.tsx")).toContain("wide:flex-none"); // the title no longer stretches
    const goals = code("components/GoalPanel.tsx");
    expect(goals).toMatch(/<ul className="short:hidden wide:hidden flex flex-col">/); // tall rows are portrait only
    expect(goals).toMatch(/<ul className="short:flex wide:flex hidden/); // the chip row is the wide look
    expect(code("components/BestScore.tsx")).toMatch(/wide:flex hidden h-11/);
  });

  it("hides the falling tiles under reduced motion and drops the old rising outlines", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.fall-tile,[\s\S]*display: none/);
    expect(css).not.toContain("tile-rise");
    expect(css).not.toContain(".bg-tile");
  });
});

describe("the falling tiles are decoration only", () => {
  const source = code("components/ui/FallingTiles.tsx");

  it("are hidden from assistive tech, inert, and a few more than before but never many (14, 9 on phones)", () => {
    expect(source).toContain('alt=""');
    expect(source).toContain("aria-hidden");
    expect(source).toContain("pointer-events-none");
    expect(source).toContain("FALLING_TILE_COUNT = 14");
    expect(source).toContain("PHONE_TILE_COUNT = 9");
    expect(source).toContain("decoding=\"async\"");
  });

  it("can show a character twice (there are fewer thumbs than tiles), so the React key is id + lane", () => {
    expect(source).toContain("key={`${spec.id}-${spec.lane}`}");
    expect(source).not.toContain("key={spec.id}");
  });

  it("sit behind everything, animate only transform, and use the small art", () => {
    expect(code("components/ui/BackgroundDecor.tsx")).toContain("-z-10");
    const css = read("app/globals.css");
    const rule = css.match(/\.fall-tile \{[^}]*\}/)![0];
    expect(rule).toContain("animation: tile-fall");
    expect(rule).not.toMatch(/filter|blur|backdrop/);
    expect(css).toMatch(/@keyframes tile-fall \{[^}]*transform: translate3d[\s\S]*?\}\s*\}/);
    expect(source).toContain("assets.thumb");
  });

  it("start above the top edge by more than the biggest tile, so a big one never pops in", () => {
    const css = read("app/globals.css");
    const top = Number(css.match(/\.fall-tile \{[^}]*top: -(\d+)px/)![1]);
    expect(top).toBeGreaterThan(FALL_LIMITS.size.max);
    // the fall ends with the tile's top edge at or past the bottom of the viewport, so it leaves fully
    const travel = Number(css.match(/@keyframes tile-fall[\s\S]*?translate3d\(0, calc\(100dvh \+ (\d+)px\)/)![1]);
    expect(travel).toBeGreaterThanOrEqual(top);
  });
});
