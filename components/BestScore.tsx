"use client";

import { useState } from "react";
import { GameEvents } from "@/game/core/events";
import { useEndlessBest } from "./hooks/useEndlessBest";
import { useGameEvent } from "./hooks/useGameEvent";
import { useT } from "./hooks/useT";

/**
 * The Endless best score. Shows the larger of the saved best and the run in progress, so the number
 * never lags a run that is beating the record; nothing is saved until the run ends (session.ts).
 * Two looks, switched by CSS with the layout: a compact right-aligned pair in the top bar (portrait)
 * and a chip in the strip above the board (desktop and landscape).
 */
export default function BestScore({ variant }: { variant: "bar" | "card" }) {
  const t = useT();
  const saved = useEndlessBest();
  const [score, setScore] = useState(0);

  useGameEvent(GameEvents.SESSION_STARTED, () => setScore(0));
  useGameEvent(GameEvents.SCORE_UPDATED, (d) => setScore(d.score));

  const best = Math.max(saved, score);
  const beating = saved > 0 && score > saved;
  const label = beating ? t("hud.newBest") : t("hud.best");
  const labelTone = beating ? "text-primary-ink" : "text-ink-2";

  if (variant === "bar") {
    return (
      <div className="wide:hidden flex shrink-0 flex-col items-end leading-tight">
        <span className={`text-xs font-bold uppercase tracking-wider ${labelTone}`}>{label}</span>
        <span className="text-lg font-extrabold tabular-nums text-ink">{best.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div
      className={`wide:flex hidden h-11 min-w-20 flex-col items-center justify-center rounded-btn border px-3 shadow-sm transition-colors duration-[var(--dur)] ${
        beating ? "border-primary bg-sky-soft" : "border-line bg-panel"
      }`}
    >
      <span className={`text-[11px] font-bold uppercase leading-none tracking-wider ${labelTone}`}>{label}</span>
      <span className="text-xl font-extrabold leading-none tabular-nums text-ink">{best.toLocaleString()}</span>
    </div>
  );
}
