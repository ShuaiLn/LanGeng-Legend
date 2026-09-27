"use client";

import { useEffect, useRef } from "react";
import { createGame } from "@/game";
import { cancelAllCelebrations } from "@/game/core/celebration";
import type { LevelConfig } from "@/game/config/levels";
import type { PlayMode } from "@/game/core/events";

/**
 * Owns the Phaser.Game instance. Phaser needs `window`/canvas, so this module must only ever be
 * loaded client-side (PlayScreen imports it via `next/dynamic` with `ssr: false`).
 */
export default function PhaserGameCanvas({ mode, level }: { mode: PlayMode; level: LevelConfig | null }) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const game = createGame(parent, mode, level);

    return () => {
      // Unmount / route change: stop any celebration timers, then tear the game down. The scene's
      // own shutdown handler removes its event-bus listeners.
      cancelAllCelebrations();
      game.destroy(true);
    };
    // `level` is a fresh object per render but a pure function of its id: the id is the dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, level?.id]);

  return <div ref={parentRef} className="absolute inset-0" />;
}
