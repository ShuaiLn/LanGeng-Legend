"use client";

import Link from "next/link";
import { useState } from "react";
import { DEMO_LEVEL } from "@/game/config/levels";
import { emitGameEvent, GameEvents, type LevelResultPayload } from "@/game/core/events";
import { getLevelBest } from "@/lib/levelBestStorage";
import { useGameEvent } from "./hooks/useGameEvent";
import Stars from "./Stars";

type Outcome =
  | { kind: "clear"; result: LevelResultPayload }
  | { kind: "failed"; levelName: string; score: number; best: number; maxCombo: number; target: number };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Level-mode result panel. Appears only after every celebration beat has finished (or straight
 * away, with 0 stars, when the player runs out of moves). Buttons dispatch events; they never
 * reach into Phaser.
 */
export default function LevelResultPanel() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useGameEvent(GameEvents.SESSION_STARTED, () => setOutcome(null));
  useGameEvent(GameEvents.CELEBRATION_RESULT, (result) => setOutcome({ kind: "clear", result }));
  useGameEvent(GameEvents.GAME_OVER, (d) => {
    if (d.mode !== "level") return;
    setOutcome({
      kind: "failed",
      levelName: d.levelName ?? DEMO_LEVEL.name,
      score: d.score,
      best: getLevelBest(d.levelId ?? DEMO_LEVEL.id),
      maxCombo: d.maxCombo,
      target: DEMO_LEVEL.objective.targetScore,
    });
  });

  if (!outcome) return null;
  const cleared = outcome.kind === "clear";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-background/75 p-3">
      <div
        role="dialog"
        aria-label={cleared ? "Level cleared" : "Level failed"}
        className="anim-panel-in my-auto flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-border bg-surface p-5 text-center shadow-2xl"
      >
        <h2 className={`text-3xl font-black ${cleared ? "text-accent" : "text-accent-2"}`}>
          {cleared ? "Level Clear!" : "Out of moves"}
        </h2>
        <p className="-mt-2 text-xs font-semibold uppercase tracking-widest text-muted">
          {cleared ? outcome.result.levelName : outcome.levelName}
        </p>

        <Stars filled={cleared ? outcome.result.stars : 0} size={52} />

        {cleared && outcome.result.isNewBest && (
          <span className="anim-badge-wiggle rounded-full bg-accent-2 px-4 py-1 text-sm font-black uppercase tracking-wider text-white">
            New Best!
          </span>
        )}

        <dl className="w-full text-left">
          {cleared ? (
            <>
              <Row label="Final score" value={outcome.result.finalScore.toLocaleString()} />
              <Row label="Best score" value={outcome.result.best.toLocaleString()} />
              <Row label="Max combo" value={`x${Math.max(outcome.result.maxCombo, 1)}`} />
              <Row
                label={`Remaining ${outcome.result.bonusMoves} moves → bonus`}
                value={`+${outcome.result.bonusScore.toLocaleString()}`}
              />
            </>
          ) : (
            <>
              <Row label="Score" value={outcome.score.toLocaleString()} />
              <Row label="Needed" value={outcome.target.toLocaleString()} />
              <Row label="Best score" value={outcome.best.toLocaleString()} />
              <Row label="Max combo" value={`x${Math.max(outcome.maxCombo, 1)}`} />
            </>
          )}
        </dl>

        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => emitGameEvent(GameEvents.RESTART_REQUESTED, {})}
            className="rounded-xl bg-accent px-4 py-3 font-black text-background hover:brightness-110"
          >
            Retry
          </button>
          {cleared && (
            <button
              type="button"
              onClick={() => emitGameEvent(GameEvents.NEXT_LEVEL_REQUESTED, {})}
              className="rounded-xl border border-border px-4 py-2 font-bold text-foreground hover:bg-surface-2"
            >
              Next Level
              <span className="block text-xs font-normal text-muted">More levels coming soon</span>
            </button>
          )}
          <Link href="/" className="text-sm font-semibold text-muted underline-offset-4 hover:text-foreground hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
