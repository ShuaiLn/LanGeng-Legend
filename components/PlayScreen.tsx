"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Difficulty } from "@/game/config/difficulty";
import { ENDLESS_DURATION_SECONDS } from "@/game/config/gameConfig";
import { resolveLevel } from "@/game/config/levels";
import type { PlayMode } from "@/game/core/events";
import type { MessageKey } from "@/lib/i18n";
import { isPreloadDone } from "@/lib/assetPreloader";
import { isUnlocked } from "@/lib/progressStorage";
import AudioBridge from "./AudioBridge";
import BestScore from "./BestScore";
import CalloutLayer from "./CalloutLayer";
import GameOverScreen from "./GameOverScreen";
import GoalPanel from "./GoalPanel";
import HudStats from "./HudStats";
import { useBackToPause } from "./hooks/useBackToPause";
import { usePause } from "./hooks/usePause";
import { usePreloadStatus } from "./hooks/usePreloadStatus";
import { useProgress } from "./hooks/useProgress";
import { useT } from "./hooks/useT";
import { TitleSync } from "./LanguageSync";
import LevelClearBanner from "./LevelClearBanner";
import LevelResultPanel from "./LevelResultPanel";
import PauseMenu from "./PauseMenu";
import PlayTopBar from "./PlayTopBar";
import StarReveal from "./StarReveal";
import { GameBackground } from "./ui/BackgroundDecor";

function CanvasPlaceholder() {
  const t = useT();
  return (
    <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink-2">
      {t("play.loading")}
    </div>
  );
}

// Phaser touches `window` on import, so it is only ever loaded in the browser.
const PhaserGameCanvas = dynamic(() => import("./PhaserGameCanvas"), {
  ssr: false,
  loading: () => <CanvasPlaceholder />,
});

const subscribeNever = () => () => {};

interface PlayScreenProps {
  mode: PlayMode;
  /** 1-20 in Level Mode, `null` in Endless. */
  levelNumber: number | null;
  difficulty: Difficulty;
}

/**
 * The game screen: one component tree, two CSS compositions (see `.play-root` in globals.css). Portrait
 * stacks top bar, stats, board and goals so the whole game fits the viewport; a wide viewport puts one
 * centred strip (Pause and title, stats, goals or the Endless best) above a slightly smaller board.
 */
export default function PlayScreen({ mode, levelNumber, difficulty }: PlayScreenProps) {
  const t = useT();
  const router = useRouter();
  const progress = useProgress();
  const { paused, canPause, pause, resume } = usePause();
  useBackToPause(canPause, pause); // Back opens Pause while a game is in progress
  // A deep link to /play must not start Phaser before the tile art is fetched (the AssetGate
  // covers the screen meanwhile), so the canvas only mounts once the preload has finished.
  const assetsReady = isPreloadDone(usePreloadStatus());
  // false on the server and during hydration: stored progress is only trustworthy after that
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);

  const level = useMemo(
    () => (mode === "level" && levelNumber !== null ? resolveLevel(levelNumber, difficulty) : null),
    [mode, levelNumber, difficulty]
  );

  // Levels unlock in order (shared across difficulties): a deep link to a locked one goes back to the grid.
  const locked = level !== null && hydrated && !isUnlocked(progress, level.number);
  useEffect(() => {
    if (locked) router.replace("/levels");
  }, [locked, router]);
  const canStart = assetsReady && hydrated && !locked;

  const title = level
    ? t("play.title.level", { n: level.number, difficulty: t(`diff.${level.difficulty}` as MessageKey) })
    : t("play.title.endless", { s: ENDLESS_DURATION_SECONDS });

  return (
    <div className="play-root" data-goals={level ? "1" : "0"}>
      <TitleSync titleKey="title.play" />
      <GameBackground />
      <AudioBridge />

      {/* Wide: one centred strip above the board. Portrait: not a box (`display: contents`), so the
          three parts stack around the board as before. */}
      <div className="play-strip">
        <div className="play-top">
          <PlayTopBar mode={mode} title={title} canPause={canPause} onPause={pause} />
        </div>

        <div className="play-hud flex flex-col gap-2 wide:flex-row wide:items-center wide:gap-2">
          <HudStats mode={mode} level={level} />
          {mode === "endless" && <BestScore variant="card" />}
        </div>

        {level && (
          <div className="play-goals">
            <GoalPanel level={level} />
          </div>
        )}
      </div>

      <div className="play-board-slot">
        {/* The board is a square white card; overlays share its coordinate space with the transparent Phaser canvas. */}
        <div className="play-board relative touch-none select-none overflow-hidden rounded-board border border-line bg-panel shadow-sm">
          {canStart && <PhaserGameCanvas mode={mode} level={level} />}
          <CalloutLayer />
          <LevelClearBanner />
          <StarReveal />
          {/* On a stopped Endless clock the board would otherwise be free thinking time */}
          {paused && mode === "endless" && <div aria-hidden className="absolute inset-0 z-20 bg-panel" />}
        </div>
      </div>

      <PauseMenu open={paused} onResume={resume} />
      <GameOverScreen />
      <LevelResultPanel />
    </div>
  );
}
