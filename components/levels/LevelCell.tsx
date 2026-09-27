"use client";

import { useT } from "../hooks/useT";

interface LevelCellProps {
  level: number;
  /** Best stars on any difficulty (0-3); 0 when the level has never been cleared. */
  stars: number;
  locked: boolean;
  /** The next level to beat: the unlock frontier, while it is still uncleared. */
  current: boolean;
  onSelect: (level: number) => void;
}

function MiniStar({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden>
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"
        fill={on ? "#FFC933" : "#EEF5FE"}
        stroke={on ? "#D9A100" : "#B7C9DE"}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * One level in the grid: its number, three mini stars (the best it has on any difficulty) and, when
 * locked, a lock. Tapping an open one opens the level's popup (the difficulty is chosen there). A locked
 * cell is `aria-disabled` rather than `disabled`, so it stays focusable and can explain itself when
 * tapped. Current (the next one to beat): a soft primary tint.
 */
export default function LevelCell({ level, stars, locked, current, onSelect }: LevelCellProps) {
  const t = useT();
  const label = locked
    ? t("a11y.levelCellLocked", { n: level })
    : stars === 0
      ? t("a11y.levelCellNew", { n: level })
      : t("a11y.levelCell", { n: level, stars });

  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={locked || undefined}
      aria-haspopup={locked ? undefined : "dialog"}
      onClick={() => onSelect(level)}
      className={`flex aspect-square min-h-[60px] min-w-[60px] flex-col items-center justify-center gap-1 rounded-btn border transition-colors duration-[var(--dur)] ease-[var(--ease)] ${
        locked
          ? "border-line bg-soft text-ink-2"
          : current
            ? "border-primary bg-sky-soft/60 hover:bg-sky-soft"
            : "border-line bg-panel hover:bg-well"
      }`}
    >
      <span className={`text-lg font-extrabold leading-none tabular-nums ${locked ? "text-ink-2" : "text-ink"}`}>{level}</span>
      {locked ? (
        <span className="text-ink-2">
          <LockIcon />
        </span>
      ) : (
        <span aria-hidden className="flex gap-px">
          {[0, 1, 2].map((i) => (
            <MiniStar key={i} on={i < stars} />
          ))}
        </span>
      )}
    </button>
  );
}
