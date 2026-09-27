"use client";

import { useState } from "react";
import { DIFFICULTIES } from "@/game/config/difficulty";
import { LEVEL_COUNT } from "@/game/config/levels";
import { bestStarsAcross, isUnlocked, totalStarsAll, unlockedUpTo } from "@/lib/progressStorage";
import { useProgress } from "../hooks/useProgress";
import { useT } from "../hooks/useT";
import { TitleSync } from "../LanguageSync";
import PageHeader from "../ui/PageHeader";
import LevelCell from "./LevelCell";
import LevelDialog from "./LevelDialog";

const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);
/** The most stars the whole mode can hold: three on each level, on each difficulty. */
const MAX_STARS = LEVEL_COUNT * 3 * DIFFICULTIES.length;

/**
 * Level Mode: the 20 levels first, the difficulty second. Tapping a level opens a popup where the
 * difficulty is chosen and the level is started (see LevelDialog). Unlocks are shared across
 * difficulties, so a cell shows the best stars the level has on any of them, and the next level to
 * beat (the unlock frontier) is tinted. A locked level explains itself instead of opening.
 */
export default function LevelSelect() {
  const t = useT();
  const progress = useProgress();
  const [chosen, setChosen] = useState<number | null>(null);
  const [lockedMessage, setLockedMessage] = useState("");
  const frontier = unlockedUpTo(progress);

  function select(level: number) {
    if (!isUnlocked(progress, level)) {
      setLockedMessage(t("levels.lockedHint", { n: level - 1 }));
      return;
    }
    setLockedMessage("");
    setChosen(level);
  }

  return (
    <>
      <TitleSync titleKey="title.levels" />
      <PageHeader
        title={t("levels.title")}
        backHref="/"
        backLabel={t("levels.backHome")}
        subtitle={<span className="text-sm font-bold tabular-nums">★ {t("levels.stars", { n: totalStarsAll(progress), max: MAX_STARS })}</span>}
      />

      <div className="flex flex-1 flex-col gap-2 pb-4">
        <ul aria-label={t("levels.grid")} className="grid grid-cols-4 gap-2 min-[640px]:grid-cols-5">
          {LEVELS.map((level) => {
            const stars = bestStarsAcross(progress, level);
            return (
              <li key={level} className="contents">
                <LevelCell
                  level={level}
                  stars={stars}
                  locked={!isUnlocked(progress, level)}
                  current={frontier === level && stars === 0}
                  onSelect={select}
                />
              </li>
            );
          })}
        </ul>
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-danger-ink">
          {lockedMessage}
        </p>
      </div>

      <LevelDialog level={chosen} onClose={() => setChosen(null)} />
    </>
  );
}
