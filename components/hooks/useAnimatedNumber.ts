import { useEffect, useRef, useState } from "react";

/**
 * Smoothly counts a displayed number toward `target`. Purely cosmetic: it follows the live
 * score as it changes, so it never plays a second "roll-up" of its own. Drops snap instantly.
 */
export function useAnimatedNumber(target: number, duration = 380): number {
  const [display, setDisplay] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    const from = shown.current;
    const span = target < from ? 0 : duration; // e.g. a restart snaps back to 0
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = span === 0 ? 1 : Math.min(1, (now - start) / span);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      shown.current = value;
      setDisplay(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}
