"use client";

import Link from "next/link";
import type { PlaybackDecision } from "@/lib/audio/soundPolicy";
import { useT, type TFunction } from "../hooks/useT";

interface TileCardProps {
  id: string;
  label: string;
  imageUrl: string;
  /** Why a tap would or would not play: drives the visual state (never red or gold). */
  decision: PlaybackDecision;
  playing: boolean;
  /** Show the "Muted in Settings" hint (briefly, after tapping a muted tile). */
  hint: boolean;
  badge?: string;
  onPlay: (id: string) => void;
}

function SpeakerOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

function EqualizerIcon() {
  return (
    <span aria-hidden className="flex h-4 items-end gap-[2px]">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="eq-bar block h-full w-[3px] rounded-full bg-primary"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function stateLabel(decision: PlaybackDecision, t: TFunction): string {
  if (decision === "no-sound") return t("gallery.state.none");
  if (decision === "play") return t("gallery.state.play");
  return t("gallery.state.off");
}

/** One tile in the Gallery: a real button, so keyboard, touch and mouse all work without hover. */
export default function TileCard({ id, label, imageUrl, decision, playing, hint, badge, onPlay }: TileCardProps) {
  const t = useT();
  const muted = decision === "muted-master" || decision === "muted-tile";
  const unavailable = decision === "no-sound";

  return (
    <li className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={t("gallery.aria", { name: label, state: stateLabel(decision, t) })}
        aria-disabled={unavailable || undefined}
        onClick={() => onPlay(id)}
        className={`group relative flex w-full flex-col items-center gap-2 rounded-item border bg-panel p-2.5 shadow-sm transition-[border-color,box-shadow,background-color] duration-[var(--dur)] ease-[var(--ease)] hover:bg-well ${
          playing ? "anim-gallery-pop border-primary ring-[3px] ring-primary" : "border-line"
        }`}
      >
        <span className="relative block aspect-square w-full overflow-hidden rounded-btn-sm bg-well">
          {/* eslint-disable-next-line @next/next/no-img-element -- static, preloaded and cached art; next/image adds nothing here */}
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className={`h-full w-full select-none object-contain p-2 transition-opacity duration-[var(--dur)] ${
              muted || unavailable ? "opacity-60" : ""
            }`}
          />
          {(playing || muted) && (
            <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-chip bg-panel text-ink-2 shadow-sm">
              {playing ? <EqualizerIcon /> : <SpeakerOffIcon />}
            </span>
          )}
          {badge && (
            <span className="absolute bottom-1.5 left-1.5 rounded-chip bg-sky-soft px-2 py-0.5 text-[11px] font-bold text-primary-ink">
              {badge}
            </span>
          )}
        </span>
        <span className="w-full truncate text-center text-[15px] font-bold text-ink">{label}</span>
      </button>

      {/* status line under the card; a polite live region so the hint is announced */}
      <p role="status" className="min-h-4 text-center text-xs text-ink-2">
        {hint ? (
          <Link href="/settings" className="font-bold text-primary-ink underline-offset-2 hover:underline">
            {t("gallery.mutedIn")}
          </Link>
        ) : unavailable ? (
          t("gallery.state.none")
        ) : muted ? (
          t("gallery.state.off")
        ) : (
          id
        )}
      </p>
    </li>
  );
}
