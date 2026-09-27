"use client";

import { useCallback, useEffect, useState } from "react";
import { emitGameEvent, GameEvents } from "@/game/core/events";
import { useGameEvent } from "./useGameEvent";

/**
 * React side of Pause. The scene owns the actual pause; this only asks (PAUSE_REQUESTED /
 * RESUME_REQUESTED) and mirrors what the scene reports (PAUSE_CHANGED), so the two can never
 * disagree about whether the game is frozen.
 *
 * `canPause` is true from the moment a session starts until a level is won (the celebration runs on
 * wall-clock timers that a scene pause cannot stop) or a game ends (those cards have their own buttons).
 * Esc pauses while playing; a tab that goes to the background pauses too, so coming back shows the
 * Pause menu instead of a game that ran on without you.
 */
export function usePause() {
  const [paused, setPaused] = useState(false);
  const [canPause, setCanPause] = useState(false);

  useGameEvent(GameEvents.SESSION_STARTED, () => {
    setPaused(false);
    setCanPause(true);
  });
  useGameEvent(GameEvents.PAUSE_CHANGED, (d) => setPaused(d.paused));
  useGameEvent(GameEvents.LEVEL_OBJECTIVE_MET, () => setCanPause(false));
  useGameEvent(GameEvents.GAME_OVER, () => setCanPause(false));
  useGameEvent(GameEvents.CELEBRATION_RESULT, () => setCanPause(false));

  const pause = useCallback(() => emitGameEvent(GameEvents.PAUSE_REQUESTED, {}), []);
  const resume = useCallback(() => emitGameEvent(GameEvents.RESUME_REQUESTED, {}), []);

  useEffect(() => {
    if (!canPause || paused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return; // another dialog owns Esc
      pause();
    };
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [canPause, paused, pause]);

  return { paused, canPause, pause, resume };
}
