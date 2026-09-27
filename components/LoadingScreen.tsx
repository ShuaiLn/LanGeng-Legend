"use client";

import { useT } from "./hooks/useT";

interface LoadingScreenProps {
  /** 0-1 */
  progress: number;
}

/** Full-screen white -> sky gradient with the logo and a rounded progress bar. */
export default function LoadingScreen({ progress }: LoadingScreenProps) {
  const t = useT();
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      role="status"
      aria-live="polite"
      className="asset-gate fixed inset-0 z-[100] flex min-h-dvh flex-col items-center justify-center gap-8 px-8"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #e8f3ff 100%)" }}
    >
      <div className="text-center">
        <p className="text-[clamp(2.5rem,8vw,3.75rem)] font-extrabold leading-none tracking-tight text-ink">
          烂梗<span className="text-primary">传奇</span>
        </p>
        <p className="mt-2 text-base font-semibold tracking-[0.2em] text-ink-2">Meme Match</p>
      </div>

      <div className="w-full max-w-xs">
        <div
          role="progressbar"
          aria-label={t("load.aria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-3 w-full overflow-hidden rounded-full bg-sky-soft"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur)] ease-[var(--ease)]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between text-sm font-semibold text-ink-2">
          <span>{t("load.assets")}</span>
          <span className="tabular-nums">{percent}%</span>
        </div>
      </div>
    </div>
  );
}
