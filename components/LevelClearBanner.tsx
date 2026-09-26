"use client";

import { useEffect, useRef, useState } from "react";
import { CELEBRATION_TIMINGS } from "@/game/config/gameConfig";
import { GameEvents } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";

/** Big "LEVEL CLEAR!" banner plus a full-screen white flash (CSS opacity keyframe). */
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
      <div key={`flash-${shownAt}`} aria-hidden className="anim-screen-flash pointer-events-none fixed inset-0 z-40 bg-white" />
      <div
        key={`banner-${shownAt}`}
        role="status"
        className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      >
        <div className="anim-banner-pop rotate-[-3deg] rounded-2xl border-4 border-accent bg-accent-2 px-6 py-3 text-center text-4xl font-black uppercase tracking-tight text-white shadow-[0_8px_0_#7a1338,0_0_60px_rgba(255,210,63,0.6)] sm:text-6xl">
          Level Clear!
        </div>
      </div>
    </>
  );
}
