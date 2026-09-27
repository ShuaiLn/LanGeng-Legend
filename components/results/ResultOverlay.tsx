import type { ReactNode } from "react";

interface ResultOverlayProps {
  label: string;
  /** Title, stars, the score: always visible at the top. */
  header: ReactNode;
  /** The numbers. The only part that scrolls, so a small screen never pushes the buttons off it. */
  children: ReactNode;
  /** The buttons: pinned to the bottom of the card, always visible. */
  footer: ReactNode;
}

/**
 * Centred white card on a very light dim scrim, laid out as header / scrolling body / pinned footer.
 * It covers the whole viewport (not just the square board), and is never taller than the viewport
 * minus a margin, so on a 320 x 568 phone or a landscape phone the buttons are on screen without
 * scrolling and only the numbers between the two ever scroll.
 */
export default function ResultOverlay({ label, header, children, footer }: ResultOverlayProps) {
  return (
    <div
      className="anim-fade-in fixed inset-0 z-40 flex items-center justify-center p-3"
      style={{ background: "rgb(31 58 95 / 0.16)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="anim-panel-in flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-card border border-line bg-panel text-center shadow-md"
      >
        <div className="flex shrink-0 flex-col items-center gap-2 px-5 pb-2 pt-5">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{children}</div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

/** Two columns of label-over-value cells (one column would make a tall card). */
export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-2 text-left">{children}</dl>;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-btn border border-line px-3 py-2">
      <dt className="text-xs font-bold uppercase tracking-wider text-ink-2">{label}</dt>
      <dd className="text-lg font-extrabold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
