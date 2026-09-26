interface StarsProps {
  filled: number;
  total?: number;
  /** Pixel size of each star. */
  size?: number;
  /** Index of the one star that should pop in (used while stars are revealed one by one). */
  popIndex?: number;
}

function Star({ on, size, pop }: { on: boolean; size: number; pop: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={pop ? "anim-star-pop" : undefined}>
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"
        fill={on ? "#ffd23f" : "transparent"}
        stroke={on ? "#b8860b" : "#5b4a99"}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Stars({ filled, total = 3, size = 56, popIndex }: StarsProps) {
  return (
    <div role="img" aria-label={`${filled} of ${total} stars`} className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <Star key={i} on={i < filled} size={size} pop={i === popIndex && i < filled} />
      ))}
    </div>
  );
}
