"use client";

import { useState } from "react";
import { GameEvents, type LevelResultPayload } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";
import DefeatCard, { type DefeatSummary } from "./results/DefeatCard";
import VictoryCard from "./results/VictoryCard";

type Outcome = { kind: "clear"; result: LevelResultPayload } | { kind: "failed"; summary: DefeatSummary };

/**
 * Level-mode result. Appears only after every celebration beat has finished (or straight away,
 * with 0 stars, when the player runs out of moves). A thin dispatcher: the victory and defeat
 * cards own the look, and their buttons only dispatch events or navigate.
 */
export default function LevelResultPanel() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useGameEvent(GameEvents.SESSION_STARTED, () => setOutcome(null));
  useGameEvent(GameEvents.CELEBRATION_RESULT, (result) => setOutcome({ kind: "clear", result }));
  useGameEvent(GameEvents.GAME_OVER, (d) => {
    if (d.mode !== "level" || d.levelNumber === null || d.difficulty === null) return;
    setOutcome({
      kind: "failed",
      summary: {
        levelNumber: d.levelNumber,
        difficulty: d.difficulty,
        score: d.score,
        best: d.best,
        maxCombo: d.maxCombo,
        goals: d.goals,
      },
    });
  });

  if (!outcome) return null;
  return outcome.kind === "clear" ? <VictoryCard result={outcome.result} /> : <DefeatCard summary={outcome.summary} />;
}
