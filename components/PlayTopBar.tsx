"use client";

import type { PlayMode } from "@/game/core/events";
import BestScore from "./BestScore";
import PauseButton from "./PauseButton";

interface PlayTopBarProps {
  mode: PlayMode;
  title: string;
  canPause: boolean;
  onPause: () => void;
}

/**
 * The slim gameplay top bar: Pause (there is no Home here; it lives on the Pause menu and the result
 * cards), the title, and in Endless (portrait only) the best score at the right end. On a wide screen it
 * is the left end of the strip above the board and only as wide as its content; on a phone on its side
 * the title makes way.
 */
export default function PlayTopBar({ mode, title, canPause, onPause }: PlayTopBarProps) {
  return (
    <div className="flex h-11 min-w-0 items-center gap-3">
      <PauseButton onPause={onPause} disabled={!canPause} />
      <h1 className="tight:hidden wide:max-w-64 wide:flex-none min-w-0 flex-1 truncate text-lg font-extrabold text-ink">{title}</h1>
      {mode === "endless" && <BestScore variant="bar" />}
    </div>
  );
}
