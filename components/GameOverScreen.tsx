"use client";

import Link from "next/link";
import { useState } from "react";
import { emitGameEvent, GameEvents } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";

interface EndlessResult {
  score: number;
  maxCombo: number;
}

/** Endless-mode result screen. The button only dispatches an event; the scene owns the restart. */
export default function GameOverScreen() {
  const [result, setResult] = useState<EndlessResult | null>(null);

  useGameEvent(GameEvents.SESSION_STARTED, () => setResult(null));
  useGameEvent(GameEvents.GAME_OVER, (d) => {
    if (d.mode === "endless") setResult({ score: d.score, maxCombo: d.maxCombo });
  });

  if (!result) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4">
      <div
        role="dialog"
        aria-label="Game over"
        className="anim-panel-in flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-6 text-center shadow-2xl"
      >
        <h2 className="text-3xl font-black text-accent-2">Time&rsquo;s up!</h2>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">Final score</p>
          <p className="text-5xl font-black tabular-nums text-accent">{result.score.toLocaleString()}</p>
        </div>
        <p className="text-sm text-muted">
          Best combo <span className="font-bold text-foreground">x{Math.max(result.maxCombo, 1)}</span>
        </p>
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            autoFocus
            onClick={() => emitGameEvent(GameEvents.RESTART_REQUESTED, {})}
            className="flex-1 rounded-xl bg-accent px-4 py-3 font-black text-background hover:brightness-110"
          >
            Play again
          </button>
          <Link
            href="/"
            className="flex-1 rounded-xl border border-border px-4 py-3 text-center font-bold text-foreground hover:bg-surface-2"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
