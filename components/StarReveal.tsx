"use client";

import { useState } from "react";
import { GameEvents } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";
import { useT } from "./hooks/useT";
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
  const t = useT();
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
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/55">
      <div className="anim-panel-in flex flex-col items-center gap-3 rounded-card border border-line bg-panel px-8 py-6 shadow-md">
        <p className="text-sm font-bold uppercase tracking-widest text-ink-2">{t("reveal.finalScore")}</p>
        <p className="text-5xl font-extrabold tabular-nums text-ink">{state.finalScore.toLocaleString()}</p>
        <Stars filled={state.revealed} size={60} popIndex={state.revealed - 1} />
        {state.newBest && (
          <span className="anim-badge-pop rounded-chip bg-primary-press px-4 py-1 text-sm font-extrabold uppercase tracking-wider text-white">
            {t("reveal.newBest")}
          </span>
        )}
      </div>
    </div>
  );
}
