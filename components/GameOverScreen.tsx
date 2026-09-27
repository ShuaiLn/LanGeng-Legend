"use client";

import Link from "next/link";
import { useState } from "react";
import { emitGameEvent, GameEvents } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";
import { useT } from "./hooks/useT";
import ResultOverlay, { Stat, StatGrid } from "./results/ResultOverlay";
import { buttonClasses } from "./ui/Button";

interface EndlessResult {
  score: number;
  maxCombo: number;
  best: number;
  isNewBest: boolean;
}

/** Endless-mode result screen. The button only dispatches an event; the scene owns the restart. */
export default function GameOverScreen() {
  const t = useT();
  const [result, setResult] = useState<EndlessResult | null>(null);

  useGameEvent(GameEvents.SESSION_STARTED, () => setResult(null));
  useGameEvent(GameEvents.GAME_OVER, (d) => {
    if (d.mode === "endless") setResult({ score: d.score, maxCombo: d.maxCombo, best: d.best, isNewBest: d.isNewBest });
  });

  if (!result) return null;
  return (
    <ResultOverlay
      label={t("endless.over.aria")}
      header={
        <>
          <h2 className="text-3xl font-extrabold text-ink">{t("endless.over.title")}</h2>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-2">{t("endless.finalScore")}</p>
            <p className="text-4xl font-extrabold tabular-nums text-primary-ink min-[360px]:text-5xl">
              {result.score.toLocaleString()}
            </p>
          </div>
          {result.isNewBest && (
            <span className="anim-badge-pop rounded-chip bg-primary-press px-4 py-1 text-sm font-extrabold uppercase tracking-wider text-white">
              {t("result.newBest")}
            </span>
          )}
        </>
      }
      footer={
        <>
          <button
            type="button"
            autoFocus
            onClick={() => emitGameEvent(GameEvents.RESTART_REQUESTED, {})}
            className={buttonClasses("primary", "large", true)}
          >
            {t("endless.again")}
          </button>
          <Link href="/" className={buttonClasses("ghost", "compact", true)}>
            {t("result.home")}
          </Link>
        </>
      }
    >
      <StatGrid>
        <Stat label={t("endless.best")} value={result.best.toLocaleString()} />
        <Stat label={t("endless.combo")} value={`×${Math.max(result.maxCombo, 1)}`} />
      </StatGrid>
    </ResultOverlay>
  );
}
