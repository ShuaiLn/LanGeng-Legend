"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DIFFICULTIES, type Difficulty } from "@/game/config/difficulty";
import { resolveLevel } from "@/game/config/levels";
import { createGoals, goalViews } from "@/game/core/goals";
import type { MessageKey } from "@/lib/i18n";
import { recordFor, setLastDifficulty } from "@/lib/progressStorage";
import { goalSentence } from "../GoalPanel";
import { useProgress } from "../hooks/useProgress";
import { useT } from "../hooks/useT";
import Stars from "../Stars";
import { buttonClasses } from "../ui/Button";
import Segmented from "../ui/Segmented";

interface LevelDialogProps {
  /** The level that was tapped in the grid; `null` keeps the dialog closed. */
  level: number | null;
  onClose: () => void;
}

const STAR_STAGGER_MS = 120;

/** What one level asks for on one difficulty: chapter, goals, moves and the star lines. */
function LevelFacts({ level, difficulty }: { level: number; difficulty: Difficulty }) {
  const t = useT();
  const config = resolveLevel(level, difficulty);
  const goals = goalViews(createGoals(config.goals, []), { score: 0, maxCombo: 0 });
  const [one, two, three] = config.starThresholds;

  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={t("levels.goals")} className="flex flex-col gap-1 text-[15px] font-semibold text-ink">
        {goals.map((goal, i) => (
          <li key={i} className="flex items-baseline gap-2">
            <span aria-hidden className="text-primary">
              ●
            </span>
            {goalSentence(goal, t)}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">{t("levels.moves", { n: config.moveLimit })}</p>
      <p className="text-xs text-ink-2">
        {one === 0
          ? t("levels.starLinesClear", { two: two.toLocaleString(), three: three.toLocaleString() })
          : t("levels.starLines", { one: one.toLocaleString(), two: two.toLocaleString(), three: three.toLocaleString() })}
      </p>
    </div>
  );
}

/**
 * The popup behind a level in the grid: pick the difficulty (on top), see that difficulty's stars,
 * goals and star lines, and Start (at the bottom). A centred card on desktop, a bottom sheet on phones,
 * built on the native <dialog> like the mode picker: focus trap, Escape and focus return come with it,
 * and a click on the scrim (the dialog element itself) closes it too. Start goes to the game; the
 * difficulty rides in the URL, and is remembered as the one to offer next time.
 */
export default function LevelDialog({ level, onClose }: LevelDialogProps) {
  const t = useT();
  const progress = useProgress();
  const ref = useRef<HTMLDialogElement>(null);
  // the last difficulty played is the starting point; a change stays for the other levels of this visit
  const [picked, setPicked] = useState<Difficulty | null>(null);
  const difficulty = picked ?? progress.lastDifficulty ?? "normal";
  const open = level !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal(); // traps focus until the dialog closes
      // showModal() would focus the first focusable element, the close button: start on Start
      dialog.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const record = level === null ? null : recordFor(progress, difficulty, level);
  const options = DIFFICULTIES.map((value) => ({ value, label: t(`diff.${value}` as MessageKey) }));

  return (
    <dialog
      ref={ref}
      aria-labelledby="level-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="sheet m-auto max-h-[calc(100dvh-1rem)] w-[min(26rem,calc(100%-2rem))] max-w-none overflow-y-auto rounded-card border border-line bg-panel p-0 text-ink shadow-md max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
    >
      {level !== null && (
        <div className="flex flex-col gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <h2 id="level-dialog-title" className="text-2xl font-extrabold">
              {t("levels.levelN", { n: level })}
              <span className="text-base font-bold text-ink-2"> · {t(`chapter.${resolveLevel(level, difficulty).chapter}` as MessageKey)}</span>
            </h2>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-btn-sm text-xl font-bold text-ink-2 transition-colors hover:bg-well hover:text-ink"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Segmented
              value={difficulty}
              options={options}
              onChange={setPicked}
              label={t("levels.difficultyLabel")}
              className="w-full"
            />
            <p className="text-center text-xs text-ink-2">{t(`diff.${difficulty}.desc` as MessageKey)}</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            {/* keyed by difficulty, so switching it pops this difficulty's stars in again */}
            <Stars key={`${level}-${difficulty}`} filled={record?.stars ?? 0} size={48} staggerMs={STAR_STAGGER_MS} />
            <p className="text-sm font-bold tabular-nums text-ink-2">
              {record ? t("levels.best", { n: record.best.toLocaleString() }) : t("levels.notCleared")}
            </p>
          </div>

          <LevelFacts level={level} difficulty={difficulty} />

          <Link
            href={`/play?mode=level&level=${level}&difficulty=${difficulty}`}
            onClick={() => setLastDifficulty(difficulty)}
            className={buttonClasses("primary", "large", true)}
          >
            {t("levels.startLevel")}
          </Link>
        </div>
      )}
    </dialog>
  );
}
