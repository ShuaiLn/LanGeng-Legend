"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LEVEL_CLEAR_CALLOUT } from "@/game/config/callouts";
import { emitGameEvent, GameEvents, type LevelResultPayload } from "@/game/core/events";
import type { MessageKey } from "@/lib/i18n";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { useT } from "../hooks/useT";
import Stars from "../Stars";
import { buttonClasses } from "../ui/Button";
import Confetti from "./Confetti";
import ResultOverlay, { Stat, StatGrid } from "./ResultOverlay";

const STAR_STAGGER_MS = 150;
const BUTTON_STAGGER_MS = 60;
/** Buttons wait for the last star to land. */
const BUTTONS_START_MS = 3 * STAR_STAGGER_MS + 300;

function rise(index: number): React.CSSProperties {
  return { animationDelay: `${BUTTONS_START_MS + index * BUTTON_STAGGER_MS}ms` };
}

/**
 * The level-clear result: gold stars, a score count-up, the numbers that matter, and the way on.
 * The victory jingle is played by AudioBridge when this appears, never from in here (nothing in this
 * file touches audio, so re-rendering or moving between buttons can never replay it).
 *
 * Next Level is a link to the next level on the SAME difficulty (a route change, so a new game), and
 * emits NEXT_LEVEL_REQUESTED first so the still-mounted AudioBridge can cut the jingle off. After
 * level 20 there is no next level: the primary button is the level grid instead (the difficulty is
 * chosen in the popup a level opens there). Replay restarts this level on this difficulty in place.
 */
export default function VictoryCard({ result }: { result: LevelResultPayload }) {
  const t = useT();
  const score = useAnimatedNumber(result.finalScore, 900, 0);
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const movesUsed = Math.max(0, result.moveLimit - result.bonusMoves);
  const difficulty = t(`diff.${result.difficulty}` as MessageKey);
  const nextHref = `/play?mode=level&level=${result.levelNumber + 1}&difficulty=${result.difficulty}`;

  // a link cannot take `autoFocus`; focus the primary action ourselves, like the old buttons did
  useEffect(() => primaryRef.current?.focus(), []);

  return (
    <>
      <Confetti />
      <ResultOverlay
        label={t("result.clear.aria")}
        header={
          <>
            <h2 className="text-3xl font-extrabold text-ink">{LEVEL_CLEAR_CALLOUT}</h2>
            <p className="-mt-1 text-xs font-bold uppercase tracking-widest text-ink-2">
              {t("result.level", { n: result.levelNumber, difficulty })}
            </p>

            <div className="relative overflow-hidden px-2 py-1">
              <Stars filled={result.stars} size={44} staggerMs={STAR_STAGGER_MS} />
              {/* one soft shimmer across the stars, once */}
              <span
                aria-hidden
                className="anim-star-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent"
              />
            </div>

            <p
              className="text-4xl font-extrabold tabular-nums text-ink min-[360px]:text-5xl"
              aria-label={t("result.scoreAria", { n: result.finalScore })}
            >
              {score.toLocaleString()}
            </p>
            {result.isNewBest && (
              <span className="anim-badge-pop rounded-chip bg-primary-press px-4 py-1 text-sm font-extrabold uppercase tracking-wider text-white">
                {t("result.newBest")}
              </span>
            )}
          </>
        }
        footer={
          <>
            {result.hasNext ? (
              <Link
                ref={primaryRef}
                href={nextHref}
                replace
                onClick={() => emitGameEvent(GameEvents.NEXT_LEVEL_REQUESTED, {})}
                style={rise(0)}
                className={`${buttonClasses("primary", "large", true)} anim-rise-in`}
              >
                {t("result.next")}
              </Link>
            ) : (
              <Link
                ref={primaryRef}
                href="/levels"
                onClick={() => emitGameEvent(GameEvents.NEXT_LEVEL_REQUESTED, {})}
                style={rise(0)}
                className={`${buttonClasses("primary", "large", true)} anim-rise-in`}
              >
                {t("result.levelSelect")}
              </Link>
            )}
            <button
              type="button"
              onClick={() => emitGameEvent(GameEvents.RESTART_REQUESTED, {})}
              style={rise(1)}
              className={`${buttonClasses("secondary", "compact", true)} anim-rise-in`}
            >
              {t("result.replay")}
            </button>
            <Link href="/" style={rise(2)} className={`${buttonClasses("ghost", "compact", true)} anim-rise-in`}>
              {t("result.home")}
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {!result.hasNext && <p className="text-base font-extrabold text-primary-ink">{t("result.allCleared")}</p>}
          {result.unlockedNext && result.hasNext && (
            <p className="rounded-btn bg-sky-soft px-3 py-1.5 text-sm font-bold text-primary-ink">
              {t("result.nextUnlocked", { n: result.levelNumber + 1 })}
            </p>
          )}
          <StatGrid>
            <Stat label={t("result.stat.best")} value={result.best.toLocaleString()} />
            <Stat label={t("result.stat.combo")} value={`×${Math.max(result.maxCombo, 1)}`} />
            <Stat label={t("result.stat.moves")} value={`${movesUsed} / ${result.moveLimit}`} />
            <Stat label={t("result.stat.bonus")} value={`+${result.bonusScore.toLocaleString()}`} />
          </StatGrid>
          {!result.hasNext && (
            <p className="text-sm text-ink-2">
              {t("result.totalStars", { n: result.totalStars, max: 60, difficulty })}
            </p>
          )}
        </div>
      </ResultOverlay>
    </>
  );
}
