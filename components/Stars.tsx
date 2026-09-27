"use client";

import { useT } from "./hooks/useT";

interface StarsProps {
  filled: number;
  total?: number;
  /** Pixel size of each star. */
  size?: number;
  /** Index of the one star that should pop in (used while stars are revealed one by one). */
  popIndex?: number;
  /** Pop every filled star in on mount, this many ms apart (the victory card). */
  staggerMs?: number;
}

function Star({ on, size, pop, delay }: { on: boolean; size: number; pop: boolean; delay?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={pop ? "anim-star-pop" : undefined}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"
        fill={on ? "#FFC933" : "#EEF5FE"}
        stroke={on ? "#D9A100" : "#B7C9DE"}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Gold stars; empty ones are a pale blue-gray. */
export default function Stars({ filled, total = 3, size = 56, popIndex, staggerMs }: StarsProps) {
  const t = useT();
  return (
    <div role="img" aria-label={t("a11y.stars", { n: filled, total })} className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const on = i < filled;
        const staggered = staggerMs !== undefined && on;
        return (
          <Star
            key={i}
            on={on}
            size={size}
            pop={staggered || (i === popIndex && on)}
            delay={staggered ? i * staggerMs : undefined}
          />
        );
      })}
    </div>
  );
}
