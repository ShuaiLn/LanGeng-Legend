"use client";

import { useState } from "react";
import { ENDLESS_DURATION_SECONDS } from "@/game/config/gameConfig";
import type { LevelConfig } from "@/game/config/levels";
import { GameEvents, type PlayMode } from "@/game/core/events";
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { useGameEvent } from "./hooks/useGameEvent";
import { useT } from "./hooks/useT";

interface StatsState {
  score: number;
  combo: number;
  timeRemaining: number | null;
  movesRemaining: number | null;
}

function initialState(mode: PlayMode, level: LevelConfig | null): StatsState {
  return mode === "endless" || !level
    ? { score: 0, combo: 0, timeRemaining: ENDLESS_DURATION_SECONDS, movesRemaining: null }
    : { score: 0, combo: 0, timeRemaining: null, movesRemaining: level.moveLimit };
}

// Portrait: three cards in a row. Wide: compact 44px chips in the strip above the board (same height as Pause).
const CARD =
  "tight:px-2 wide:h-11 wide:px-3 wide:py-1 flex min-w-0 flex-col items-center justify-center rounded-btn border px-2 py-1.5 shadow-sm transition-colors duration-[var(--dur)]";
const LABEL = "wide:text-[11px] wide:leading-none text-xs font-bold uppercase tracking-wider text-ink-2";
const VALUE =
  "wide:!text-xl wide:leading-none text-2xl min-[360px]:text-[28px] font-extrabold tabular-nums leading-tight";

function Stat({
  label,
  value,
  tone = "default",
  className = "",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div className={`${CARD} border-line bg-panel ${className}`}>
      <span className={LABEL}>{label}</span>
      <span className={`${VALUE} ${tone === "danger" ? "text-danger-ink" : "text-ink"}`}>{value}</span>
    </div>
  );
}

/**
 * Score, Time (Endless) or Moves (levels), and Combo. Its own event subscriptions, so a goal-progress
 * update never re-renders these cards. Portrait: one row of three; wide: three chips in the strip.
 */
export default function HudStats({ mode, level }: { mode: PlayMode; level: LevelConfig | null }) {
  const t = useT();
  const [state, setState] = useState<StatsState>(() => initialState(mode, level));
  const displayScore = useAnimatedNumber(state.score);

  useGameEvent(GameEvents.SESSION_STARTED, (d) =>
    setState({ score: 0, combo: 0, timeRemaining: d.timeRemaining, movesRemaining: d.movesRemaining })
  );
  useGameEvent(GameEvents.SCORE_UPDATED, (d) => setState((s) => ({ ...s, score: d.score })));
  useGameEvent(GameEvents.COMBO_UPDATED, (d) => setState((s) => ({ ...s, combo: d.combo })));
  useGameEvent(GameEvents.TIMER_TICK, (d) => setState((s) => ({ ...s, timeRemaining: d.remaining })));
  useGameEvent(GameEvents.MOVES_UPDATED, (d) => setState((s) => ({ ...s, movesRemaining: d.movesRemaining })));

  const comboOn = state.combo >= 2;

  return (
    <section aria-label={t("hud.status")} className="wide:flex grid grid-cols-[1.5fr_1fr_1fr] gap-2">
      <Stat label={t("hud.score")} value={displayScore.toLocaleString()} className="tight:min-w-16 wide:min-w-24" />
      {state.timeRemaining !== null && (
        <Stat
          label={t("hud.time")}
          value={t("hud.timeValue", { n: state.timeRemaining })}
          tone={state.timeRemaining <= 10 ? "danger" : "default"}
          className="tight:min-w-12 wide:min-w-16"
        />
      )}
      {state.movesRemaining !== null && (
        <Stat
          label={t("hud.moves")}
          value={state.movesRemaining}
          tone={state.movesRemaining <= 3 ? "danger" : "default"}
          className="tight:min-w-12 wide:min-w-16"
        />
      )}
      <div className={`${CARD} tight:min-w-12 wide:min-w-16 ${comboOn ? "border-gold bg-gold/25" : "border-line bg-panel"}`}>
        <span className={`${LABEL} ${comboOn ? "!text-gold-ink" : ""}`}>{t("hud.combo")}</span>
        <span className={`${VALUE} ${comboOn ? "text-gold-ink" : "text-ink-2"}`}>{comboOn ? `×${state.combo}` : "–"}</span>
      </div>
    </section>
  );
}
