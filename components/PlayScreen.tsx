"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { PlayMode } from "@/game/core/events";
import CalloutLayer from "./CalloutLayer";
import GameOverScreen from "./GameOverScreen";
import HUD from "./HUD";
import LevelClearBanner from "./LevelClearBanner";
import LevelResultPanel from "./LevelResultPanel";
import StarReveal from "./StarReveal";

// Phaser touches `window` on import, so it is only ever loaded in the browser.
const PhaserGameCanvas = dynamic(() => import("./PhaserGameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted">
      Loading game…
    </div>
  ),
});

const MODE_TITLE: Record<PlayMode, string> = {
  endless: "60-Second Endless",
  level: "Demo Level",
};

export default function PlayScreen({ mode }: { mode: PlayMode }) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center gap-3 px-4 py-4">
      <div className="flex w-full items-baseline justify-between">
        <h1 className="text-lg font-black text-foreground">{MODE_TITLE[mode]}</h1>
        <Link href="/" className="text-sm font-semibold text-muted hover:text-foreground">
          ← Home
        </Link>
      </div>

      <HUD mode={mode} />

      {/* The board is square; overlays share its coordinate space with the Phaser canvas. */}
      <div
        className="relative w-full touch-none select-none overflow-hidden rounded-3xl border border-border bg-surface"
        style={{ maxWidth: "min(100%, 68dvh)", aspectRatio: "1 / 1" }}
      >
        <PhaserGameCanvas mode={mode} />
        <CalloutLayer />
        <LevelClearBanner />
        <StarReveal />
        <GameOverScreen />
        <LevelResultPanel />
      </div>

      <p className="text-center text-xs text-muted">
        Swipe or tap two neighbouring tiles to swap · match 3+ · four, five and L/T shapes make special tiles
      </p>
    </div>
  );
}
