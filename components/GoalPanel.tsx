"use client";

import { useRef, useState } from "react";
import { CHARACTER_LIBRARY } from "@/game/config/characters";
import type { LevelConfig } from "@/game/config/levels";
import { GameEvents } from "@/game/core/events";
import { createGoals, goalViews, type GoalView } from "@/game/core/goals";
import type { MessageKey } from "@/lib/i18n";
import { useGameEvent } from "./hooks/useGameEvent";
import { useT, type TFunction } from "./hooks/useT";

/** Goals as they stand before the first move (the collect target is only known once the pool is rolled). */
function initialViews(level: LevelConfig | null): GoalView[] {
  return level ? goalViews(createGoals(level.goals, []), { score: 0, maxCombo: 0 }) : [];
}

export function goalLabel(goal: GoalView, t: TFunction): string {
  switch (goal.type) {
    case "score":
      return t("goalShort.score");
    case "collect":
      return t("goalShort.collect");
    case "specials":
      return t("goalShort.specials");
    case "chain":
      return t("goalShort.chain", { n: goal.target });
  }
}

/** The long, spoken form ("Reach a chain of x3"), for the completion announcement. */
export function goalSentence(goal: GoalView, t: TFunction): string {
  const key: MessageKey =
    goal.type === "specials" ? (goal.target === 1 ? "goal.specials.one" : "goal.specials.other") : (`goal.${goal.type}` as MessageKey);
  return t(key, { n: goal.target.toLocaleString() });
}

export function goalNumbers(goal: GoalView): string {
  return `${goal.current.toLocaleString()} / ${goal.target.toLocaleString()}`;
}

/** The tile a collect goal points at, or a small dot for the other kinds (which have no art). */
function GoalIcon({ goal }: { goal: GoalView }) {
  const character = goal.characterId ? CHARACTER_LIBRARY.find((c) => c.id === goal.characterId) : undefined;
  if (goal.type === "collect" && character?.assets.normal) {
    // eslint-disable-next-line @next/next/no-img-element -- a small, preloaded and cached tile; next/image adds nothing here
    return <img src={character.assets.normal} alt="" width={24} height={24} draggable={false} className="h-6 w-6 shrink-0 object-contain" />;
  }
  return (
    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center text-base font-extrabold text-primary-ink">
      {goal.done ? "✓" : goal.type === "score" ? "★" : goal.type === "specials" ? "◆" : goal.type === "chain" ? "»" : "●"}
    </span>
  );
}

function GoalRow({ goal, t }: { goal: GoalView; t: TFunction }) {
  const label = goalLabel(goal, t);
  return (
    <li className="flex h-7 items-center gap-2 min-[360px]:h-8">
      <GoalIcon goal={goal} />
      <span className="min-w-0 shrink-0 basis-[5.5rem] truncate text-[13px] font-bold text-ink min-[360px]:text-sm">{label}</span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-valuenow={goal.current}
        className="h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-sky-soft"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${goal.done ? "bg-primary-press" : "bg-primary"}`}
          style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
        />
      </div>
      <span className={`shrink-0 text-right text-[13px] font-bold tabular-nums min-[360px]:text-sm ${goal.done ? "text-primary-ink" : "text-ink-2"}`}>
        {goalNumbers(goal)}
      </span>
    </li>
  );
}

function GoalChip({ goal, t }: { goal: GoalView; t: TFunction }) {
  return (
    <li
      title={goalLabel(goal, t)}
      className={`tight:gap-1 tight:px-2 wide:h-11 flex h-10 items-center gap-1.5 rounded-btn border px-2.5 text-sm font-bold tabular-nums ${
        goal.done ? "border-primary bg-sky-soft text-primary-ink" : "border-line bg-panel text-ink"
      }`}
    >
      <GoalIcon goal={goal} />
      <span className="sr-only">{goalLabel(goal, t)}</span>
      {goalNumbers(goal)}
    </li>
  );
}

/**
 * What the level asks for, with live progress: up to three rows (icon, name, bar, numbers) under the
 * board, or a line of chips on a short screen and in the wide strip (where the first-attempt hint is left
 * out: it would resize the board when the first move dismisses it). Subscribes on its own, so a
 * goal-progress event never re-renders the score cards. The two bars are the only pills here.
 */
export default function GoalPanel({ level }: { level: LevelConfig | null }) {
  const t = useT();
  const [goals, setGoals] = useState<GoalView[]>(() => initialViews(level));
  const [hintKey, setHintKey] = useState<string | null>(level?.hintKey ?? null);
  const [announcement, setAnnouncement] = useState("");
  const doneRef = useRef<boolean[]>([]);

  const update = (next: GoalView[], announce: boolean) => {
    if (announce) {
      const finished = next.find((goal, i) => goal.done && !doneRef.current[i]);
      if (finished) setAnnouncement(t("a11y.goalDone", { goal: goalSentence(finished, t) }));
    }
    doneRef.current = next.map((goal) => goal.done);
    setGoals(next);
  };

  useGameEvent(GameEvents.SESSION_STARTED, (d) => {
    setAnnouncement("");
    update(d.goals, false);
    setHintKey(d.hintKey);
  });
  useGameEvent(GameEvents.GOAL_PROGRESS, (d) => update(d.goals, true));
  // the hint is for the first look: the first move (or a retry after it) makes it noise
  useGameEvent(GameEvents.MOVES_UPDATED, () => setHintKey(null));

  if (goals.length === 0) return null;
  return (
    <section aria-label={t("hud.goals")} className="flex flex-col gap-1">
      <ul className="short:hidden wide:hidden flex flex-col">
        {goals.map((goal, i) => (
          <GoalRow key={i} goal={goal} t={t} />
        ))}
      </ul>
      <ul className="short:flex wide:flex hidden flex-wrap justify-center gap-2">
        {goals.map((goal, i) => (
          <GoalChip key={i} goal={goal} t={t} />
        ))}
      </ul>
      {hintKey && (
        <p className="short:hidden wide:hidden text-xs leading-snug text-ink-2 min-[360px]:text-[13px]">{t(hintKey as MessageKey)}</p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
