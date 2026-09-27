"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ENDLESS_DURATION_SECONDS } from "@/game/config/gameConfig";
import { totalStarsAll } from "@/lib/progressStorage";
import EndlessTilePicker from "./EndlessTilePicker";
import { useEndlessBest } from "./hooks/useEndlessBest";
import { useProgress } from "./hooks/useProgress";
import { useT } from "./hooks/useT";

interface ModePickerProps {
  open: boolean;
  onClose: () => void;
}

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.66 6.34l-1.42 1.42M7.76 16.24l-1.42 1.42M17.66 17.66l-1.42-1.42M7.76 7.76 6.34 6.34" />
    </svg>
  );
}

function ModeCard({
  href,
  badge,
  title,
  note,
  configure,
  children,
}: {
  href: string;
  badge: string;
  title: string;
  /** A short line of the player's own progress ("Best 12,340"); absent until there is some. */
  note?: string;
  /** An extra icon button before the chevron (Endless's "choose tiles"); the row still starts the mode when tapped elsewhere. */
  configure?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  const body = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="w-fit rounded-chip bg-sky-soft px-2.5 py-0.5 text-xs font-bold tracking-wide text-primary-ink">
          {badge}
        </span>
        {note && <span className="text-xs font-bold tabular-nums text-ink-2">{note}</span>}
      </span>
      <span className="text-xl font-extrabold text-ink">{title}</span>
      <span className="text-sm leading-snug text-ink-2">{children}</span>
    </span>
  );

  if (!configure) {
    return (
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-item border border-line bg-panel p-4 no-underline transition-[background-color,border-color,transform] duration-[var(--dur)] ease-[var(--ease)] hover:border-primary hover:bg-well active:scale-[0.99]"
      >
        {body}
        <span aria-hidden className="text-2xl font-bold text-primary transition-transform group-hover:translate-x-0.5">
          ›
        </span>
      </Link>
    );
  }

  // A gear button cannot nest inside the anchor (invalid HTML), so the row is a plain container with
  // the anchor around the text (most of the tap target) and the gear as a sibling before the chevron.
  return (
    <div className="group flex items-center gap-1 rounded-item border border-line bg-panel p-4 transition-[background-color,border-color] duration-[var(--dur)] ease-[var(--ease)] hover:border-primary hover:bg-well">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 self-stretch no-underline active:scale-[0.99]">
        {body}
      </Link>
      <button
        type="button"
        aria-label={configure.label}
        onClick={configure.onClick}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn-sm text-ink-2 transition-colors hover:bg-well hover:text-ink"
      >
        <GearIcon />
      </button>
      <Link href={href} aria-hidden tabIndex={-1} className="shrink-0 text-2xl font-bold text-primary transition-transform group-hover:translate-x-0.5">
        ›
      </Link>
    </div>
  );
}

/**
 * The Play button's mode picker: a centred card on desktop, a bottom sheet on phones. Built on the
 * native <dialog>, which supplies the focus trap, Escape to close and focus return; a click on
 * the scrim (the dialog element itself) closes it too. Endless goes straight into the game; Level
 * Mode goes to the difficulty screen first.
 */
export default function ModePicker({ open, onClose }: ModePickerProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const best = useEndlessBest();
  const stars = totalStarsAll(useProgress());
  const [tilesOpen, setTilesOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal(); // traps focus until the dialog closes
      // showModal() would focus the first focusable element, the close button: start on the first card
      dialog.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby="mode-picker-title"
        onClose={onClose}
        onClick={(event) => {
          if (event.target === ref.current) onClose();
        }}
        className="sheet m-auto w-[min(28rem,calc(100%-2rem))] max-w-none overflow-hidden rounded-card border border-line bg-panel p-0 text-ink shadow-md max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
      >
        <div className="flex flex-col gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <h2 id="mode-picker-title" className="text-2xl font-extrabold">
              {t("mode.title")}
            </h2>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={onClose}
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-btn-sm text-xl font-bold text-ink-2 transition-colors hover:bg-well hover:text-ink"
            >
              ✕
            </button>
          </div>

          <ModeCard
            href="/levels"
            badge={t("mode.level.badge")}
            title={t("mode.level.title")}
            note={stars > 0 ? t("mode.level.stars", { n: stars }) : undefined}
          >
            {t("mode.level.desc")}
          </ModeCard>
          <ModeCard
            href="/play?mode=endless"
            badge={t("mode.endless.badge")}
            title={t("mode.endless.title", { s: ENDLESS_DURATION_SECONDS })}
            note={best > 0 ? t("mode.endless.best", { n: best.toLocaleString() }) : undefined}
            configure={{ label: t("mode.endless.chooseTiles"), onClick: () => setTilesOpen(true) }}
          >
            {t("mode.endless.desc")}
          </ModeCard>
        </div>
      </dialog>
      <EndlessTilePicker open={tilesOpen} onClose={() => setTilesOpen(false)} />
    </>
  );
}
