"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useT } from "./hooks/useT";
import { buttonClasses } from "./ui/Button";

interface PauseMenuProps {
  open: boolean;
  onResume: () => void;
}

/**
 * The Pause screen: a native <dialog> (focus trap, inert page, focus return), centred on every size.
 * Esc resumes; there is no confirmation on Return to Home, because this screen is the confirmation.
 * The game underneath is frozen by the scene, not by this dialog, so it is exactly where it was.
 */
export default function PauseMenu({ open, onResume }: PauseMenuProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus(); // Resume, not whatever comes first
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="pause-title"
      onCancel={(event) => {
        event.preventDefault(); // Esc resumes; the dialog closes when the scene confirms
        onResume();
      }}
      className="pause m-auto w-[min(22rem,calc(100%-2rem))] max-w-none rounded-card border border-line bg-panel p-0 text-ink shadow-md"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 id="pause-title" className="pb-1 text-center text-2xl font-extrabold">
          {t("pause.title")}
        </h2>
        <button type="button" data-autofocus onClick={onResume} className={buttonClasses("primary", "large", true)}>
          {t("pause.resume")}
        </button>
        <Link href="/" className={buttonClasses("secondary", "large", true)}>
          {t("pause.home")}
        </Link>
      </div>
    </dialog>
  );
}
