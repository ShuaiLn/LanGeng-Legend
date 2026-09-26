"use client";

import { useState } from "react";
import { ENDLESS_DURATION_SECONDS } from "@/game/config/gameConfig";
import { DEMO_LEVEL } from "@/game/config/levels";
import { GameEvents, type PlayMode } from "@/game/core/events";
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { useGameEvent } from "./hooks/useGameEvent";

interface HudState {
  score: number;
  combo: number;
  timeRemaining: number | null;
  movesRemaining: number | null;
  targetScore: number | null;
}

function initialState(mode: PlayMode): HudState {
  return mode === "endless"
    ? { score: 0, combo: 0, timeRemaining: ENDLESS_DURATION_SECONDS, movesRemaining: null, targetScore: null }
    : {
        score: 0,
        combo: 0,
        timeRemaining: null,
        movesRemaining: DEMO_LEVEL.moveLimit,
        targetScore: DEMO_LEVEL.objective.targetScore,
      };
}

function Stat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "danger" }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-border bg-surface px-3 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span
        className={`text-2xl font-black tabular-nums leading-tight ${tone === "danger" ? "text-accent-2" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function HUD({ mode }: { mode: PlayMode }) {
  const [state, setState] = useState<HudState>(() => initialState(mode));
  const displayScore = useAnimatedNumber(state.score);

  useGameEvent(GameEvents.SESSION_STARTED, (d) =>
    setState({
      score: 0,
      combo: 0,
      timeRemaining: d.timeRemaining,
      movesRemaining: d.movesRemaining,
      targetScore: d.targetScore,
    })
  );
  useGameEvent(GameEvents.SCORE_UPDATED, (d) => setState((s) => ({ ...s, score: d.score })));
  useGameEvent(GameEvents.COMBO_UPDATED, (d) => setState((s) => ({ ...s, combo: d.combo })));
  useGameEvent(GameEvents.TIMER_TICK, (d) => setState((s) => ({ ...s, timeRemaining: d.remaining })));
  useGameEvent(GameEvents.MOVES_UPDATED, (d) => setState((s) => ({ ...s, movesRemaining: d.movesRemaining })));

  const progress = state.targetScore ? Math.min(100, (state.score / state.targetScore) * 100) : null;

  return (
    <section aria-label="Game status" className="w-full">
      <div className="flex gap-2">
        <Stat label="Score" value={displayScore.toLocaleString()} />
        {state.timeRemaining !== null && (
          <Stat label="Time" value={`${state.timeRemaining}s`} tone={state.timeRemaining <= 10 ? "danger" : "default"} />
        )}
        {state.movesRemaining !== null && (
          <Stat label="Moves" value={state.movesRemaining} tone={state.movesRemaining <= 3 ? "danger" : "default"} />
        )}
        <div
          className={`flex min-w-0 flex-1 flex-col items-center rounded-xl border px-3 py-2 transition-colors ${
            state.combo >= 2 ? "border-accent bg-accent/15" : "border-border bg-surface"
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Combo</span>
          <span className={`text-2xl font-black tabular-nums leading-tight ${state.combo >= 2 ? "text-accent" : "text-muted"}`}>
            {state.combo >= 2 ? `x${state.combo}` : "–"}
          </span>
        </div>
      </div>

      {progress !== null && state.targetScore !== null && (
        <div className="mt-2">
          <div className="flex justify-between text-[11px] font-semibold text-muted">
            <span>Goal</span>
            <span className="tabular-nums">
              {Math.min(state.score, state.targetScore).toLocaleString()} / {state.targetScore.toLocaleString()}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.targetScore}
            aria-valuenow={Math.min(state.score, state.targetScore)}
            className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}
