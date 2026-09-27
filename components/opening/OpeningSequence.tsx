"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { markOpeningSeen, openingCssVars } from "@/lib/opening";
import CoverStage from "./CoverStage";
import IntroStage from "./IntroStage";

type Phase = "intro" | "cover" | "leaving";

const TIMELINE_VARS = openingCssVars() as CSSProperties;

interface OpeningSequenceProps {
  /** The startup preload is finished: the cover accepts a tap. */
  ready: boolean;
  /** The cover has fully faded out; the caller unmounts the opening. */
  onDone: () => void;
}

/**
 * White intro, then the cover, then (on a tap) a fade to the menu. The timing lives in CSS
 * (`.op-*` in globals.css, numbers from `lib/opening.ts`); this component only tracks the phase.
 *
 * The cover sits underneath the intro from the start, so the crossfade is just the intro layer
 * fading out. The animations start at the first paint of the server HTML, which can be well before
 * hydration on a slow connection, so the end of the intro is read from the Web Animations API
 * (`finished` also resolves for an animation that already ended) instead of an `animationend`
 * listener that hydration may have missed.
 */
export default function OpeningSequence({ ready, onDone }: OpeningSequenceProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const introRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = introRef.current;
    if (!layer) return;
    let cancelled = false;
    void Promise.allSettled(layer.getAnimations().map((animation) => animation.finished)).then(() => {
      if (!cancelled) setPhase("cover");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(() => {
    if (phase !== "cover" || !ready) return;
    markOpeningSeen();
    setPhase("leaving");
  }, [phase, ready]);

  // Enter / Space start the game without the button having to be focused first (programmatic focus
  // would draw a keyboard focus ring for mouse users too). Once someone Tabs to the button it
  // activates itself, so a key press that lands on it is left alone.
  useEffect(() => {
    if (phase !== "cover") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.repeat || event.defaultPrevented || event.target instanceof HTMLButtonElement) return;
      event.preventDefault(); // Space would scroll the page behind the cover
      start();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, start]);

  return (
    <div
      className={`op-root asset-gate fixed inset-0 z-[100] overflow-hidden ${phase === "leaving" ? "op-exit" : ""}`}
      style={{ ...TIMELINE_VARS, background: "linear-gradient(180deg, #ffffff 0%, #eaf4ff 100%)" }}
      onAnimationEnd={(event) => {
        // children's animations bubble up; only the fade of this whole layer ends the opening
        if (phase === "leaving" && event.target === event.currentTarget) onDone();
      }}
    >
      <CoverStage active={phase !== "intro"} ready={ready} onStart={start} />
      {phase === "intro" && <IntroStage ref={introRef} />}
    </div>
  );
}
