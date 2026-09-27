"use client";

import Link from "next/link";
import { emitGameEvent, GameEvents } from "@/game/core/events";
import type { GoalView } from "@/game/core/goals";
import type { Difficulty } from "@/game/config/difficulty";
import type { MessageKey } from "@/lib/i18n";
import { goalLabel, goalNumbers } from "../GoalPanel";
import { useT } from "../hooks/useT";
import Stars from "../Stars";
import { buttonClasses } from "../ui/Button";
import ResultOverlay, { Stat, StatGrid } from "./ResultOverlay";

export interface DefeatSummary {
  levelNumber: number;
  difficulty: Difficulty;
  score: number;
  best: number;
  maxCombo: number;
  goals: GoalView[];
}

/** Out of moves before every goal was met: same look as the victory card, but no confetti and no jingle. */
export default function DefeatCard({ summary }: { summary: DefeatSummary }) {
  const t = useT();
  const difficulty = t(`diff.${summary.difficulty}` as MessageKey);

  return (
    <ResultOverlay
      label={t("result.defeat.aria")}
      header={
        <>
          <h2 className="text-3xl font-extrabold text-ink">{t("result.defeat.title")}</h2>
          <p className="-mt-1 text-xs font-bold uppercase tracking-widest text-ink-2">
            {t("result.level", { n: summary.levelNumber, difficulty })}
          </p>
          <Stars filled={0} size={44} />
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
            {t("result.retry")}
          </button>
          <Link href="/" className={buttonClasses("ghost", "compact", true)}>
            {t("result.home")}
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <StatGrid>
          <Stat label={t("result.defeat.score")} value={summary.score.toLocaleString()} />
          <Stat label={t("result.stat.best")} value={summary.best.toLocaleString()} />
        </StatGrid>
        <section aria-label={t("result.defeat.goals")} className="text-left">
          <ul className="flex flex-col divide-y divide-line rounded-btn border border-line">
            {summary.goals.map((goal, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="font-bold text-ink">{goalLabel(goal, t)}</span>
                <span className={`font-bold tabular-nums ${goal.done ? "text-primary-ink" : "text-danger-ink"}`}>
                  {goalNumbers(goal)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ResultOverlay>
  );
}
