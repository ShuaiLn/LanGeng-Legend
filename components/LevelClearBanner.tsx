"use client";

import { useEffect, useRef, useState } from "react";
import { LEVEL_CLEAR_CALLOUT } from "@/game/config/callouts";
import { CELEBRATION_TIMINGS } from "@/game/config/gameConfig";
import { GameEvents } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";

/** The `Clear！！` pill (the same in every language) plus a soft sky-blue flash (CSS opacity keyframe). */
export default function LevelClearBanner() {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useGameEvent(GameEvents.CELEBRATION_LEVEL_CLEAR, () => {
    clearTimer();
    setShownAt(Date.now()); // a fresh key restarts the CSS animations
    timer.current = setTimeout(() => setShownAt(null), CELEBRATION_TIMINGS.banner);
  });

  useGameEvent(GameEvents.SESSION_STARTED, () => {
    clearTimer();
    setShownAt(null);
  });

  useEffect(() => clearTimer, []);

  if (shownAt === null) return null;
  return (
    <>
      <div
        key={`flash-${shownAt}`}
        aria-hidden
        className="anim-screen-flash pointer-events-none fixed inset-0 z-40 bg-sky-soft"
      />
      <div
        key={`banner-${shownAt}`}
        role="status"
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      >
        <div className="anim-banner-pop rounded-card border-2 border-primary bg-panel px-8 py-3 text-center text-3xl font-extrabold tracking-tight text-primary-ink shadow-md sm:text-5xl">
          {LEVEL_CLEAR_CALLOUT}
        </div>
      </div>
    </>
  );
}
