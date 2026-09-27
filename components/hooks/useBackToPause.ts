"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the phone's Back button (and the browser's) open the Pause menu instead of throwing the game
 * away. While `active` (a game in progress) it keeps one extra history entry, a sentinel with the same
 * URL, above the game's own: Back lands on the game's entry, `onBack` pauses, and the sentinel is put
 * back, so Back can pause any number of times but never leaves mid-game. Leaving is Pause -> Return to
 * Home, exactly as with the on-screen controls.
 *
 * When the game ends (a result card is showing) the sentinel is consumed with one `history.back()`, so
 * the next Back really does leave. Unmounting does not touch history: an ordinary link out of the game
 * behaves as it always did. Next.js's router ignores a popstate with no state of its own and patches
 * `pushState` to keep its bookkeeping, so the entry is invisible to it.
 */
export function useBackToPause(active: boolean, onBack: () => void): void {
  const pushed = useRef(false);
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    if (!pushed.current) {
      window.history.pushState(null, "", window.location.href);
      pushed.current = true;
    }
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href); // put the sentinel back
      onBackRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [active]);

  useEffect(() => {
    if (active || !pushed.current) return;
    pushed.current = false;
    window.history.back(); // the game is over: spend the sentinel so the next Back leaves
  }, [active]);
}
