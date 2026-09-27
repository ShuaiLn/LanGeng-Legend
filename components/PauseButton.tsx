"use client";

import { useT } from "./hooks/useT";
import { buttonClasses } from "./ui/Button";

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden fill="currentColor">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  );
}

/** Replaces the old Home link in the gameplay top bar: at least 44 x 44, icon plus label (icon only on a phone on its side). */
export default function PauseButton({ onPause, disabled }: { onPause: () => void; disabled: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onPause();
      }}
      className={buttonClasses("secondary", "compact", false, "tight:gap-0 tight:px-2 min-w-11 shrink-0 gap-2 px-3")}
    >
      <PauseIcon />
      <span className="tight:sr-only">{t("pause.button")}</span>
    </button>
  );
}
