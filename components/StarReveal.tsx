"use client";

import { useState } from "react";
import { GameEvents } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";
import Stars from "./Stars";

interface RevealState {
  visible: boolean;
  finalScore: number;
  revealed: number;
  newBest: boolean;
}

const HIDDEN: RevealState = { visible: false, finalScore: 0, revealed: 0, newBest: false };

/**
 * The in-board celebration read-out: "Final Score: N", then stars popping in one at a time
 * (each beat also triggers a particle burst + shake in the Phaser scene), then NEW BEST.
 * Hands over to the result panel once every beat has finished.
 */
export default function StarReveal() {
  const [state, setState] = useState<RevealState>(HIDDEN);

  useGameEvent(GameEvents.SESSION_STARTED, () => setState(HIDDEN));
  // The score shown here is simply the settled live score: there is no second count-up.
  useGameEvent(GameEvents.CELEBRATION_FINAL_SCORE, (d) =>
    setState({ visible: true, finalScore: d.score, revealed: 0, newBest: false })
  );
  useGameEvent(GameEvents.CELEBRATION_STAR, (d) => setState((s) => ({ ...s, revealed: d.index + 1 })));
  useGameEvent(GameEvents.NEW_BEST, () => setState((s) => ({ ...s, newBest: true })));
  useGameEvent(GameEvents.CELEBRATION_RESULT, () => setState(HIDDEN));

  if (!state.visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/55">
      <div className="anim-panel-in flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface/95 px-8 py-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted">Final Score</p>
        <p className="text-5xl font-black tabular-nums text-accent">{state.finalScore.toLocaleString()}</p>
        <Stars filled={state.revealed} size={60} popIndex={state.revealed - 1} />
        {state.newBest && (
          <span className="anim-badge-wiggle rounded-full bg-accent-2 px-4 py-1 text-sm font-black uppercase tracking-wider text-white">
            New Best!
          </span>
        )}
      </div>
    </div>
  );
}
