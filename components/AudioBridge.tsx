"use client";

import { useEffect } from "react";
import { GameEvents } from "@/game/core/events";
import { audio } from "@/lib/audio/audioManager";
import { useGameEvent } from "./hooks/useGameEvent";

/**
 * Connects the game's event bus to sounds that live outside Phaser. Renders nothing.
 *
 * - The victory jingle plays when the result panel appears (`celebration-result`), not at the
 *   earlier "LEVEL CLEAR!" banner, so it never collides with the bonus detonations' tile sounds.
 *   The audio manager dedupes it by session id, so a repeated event can never play it twice.
 * - Retry / next level / a fresh session cut it off; unmounting silences everything.
 * Tile sounds are triggered by the board scene itself, once per elimination event.
 */
export default function AudioBridge() {
  useGameEvent(GameEvents.CELEBRATION_RESULT, (d) => audio.playVictory(d.sessionId));
  useGameEvent(GameEvents.RESTART_REQUESTED, () => audio.stopVictory());
  useGameEvent(GameEvents.NEXT_LEVEL_REQUESTED, () => audio.stopVictory());
  useGameEvent(GameEvents.SESSION_STARTED, () => audio.stopVictory());

  useEffect(() => () => audio.stopAll(), []);
  return null;
}
