"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEvents, type CalloutKind } from "@/game/core/events";
import { calloutLabel, type MessageKey } from "@/lib/i18n";
import { useGameEvent } from "./hooks/useGameEvent";
import { useLanguage } from "./hooks/useT";

interface Callout {
  id: number;
  kind: CalloutKind;
  /** Verbatim text, or the English fallback of a keyed callout. */
  text: string;
  /** Keyed callouts (the reshuffle notice) are translated at render time, so a language switch applies. */
  key?: MessageKey;
  /** A combo's chain length: it picks the size of the pop. */
  n?: number;
  x: number | null;
  y: number | null;
}

const LIFETIME_MS: Record<CalloutKind, number> = {
  score: 950,
  combo: 1300,
  meme: 1300,
  boom: 1300,
  system: 1300,
};
const MAX_VISIBLE = 24;

// Text over a light board: deep-blue ink with a white halo (`callout-text`), never dark shadows.
const STYLE: Record<CalloutKind, string> = {
  score: "callout-text anim-callout-rise text-xl font-extrabold text-primary-ink",
  combo: "",
  meme: "callout-text anim-callout-pop text-3xl font-extrabold text-primary-ink sm:text-4xl",
  boom: "callout-text anim-callout-pop text-5xl font-extrabold text-ink",
  system: "anim-callout-pop rounded-btn border border-line bg-panel px-4 py-2 text-sm font-bold text-ink shadow-md",
};

/**
 * A combo shout (a meme phrase) is a gold rounded-rectangle with dark-amber ink. Size and animation step up
 * at chains of 4 and 6 (a brief scale pulse, no extra particles).
 */
function comboStyle(level: number): string {
  const base = "rounded-btn border-2 border-white bg-gold font-extrabold text-gold-ink shadow-md";
  // The longest phrase ("What Can I Say!") must fit a 304px board at every step, so phones step the type down.
  if (level >= 6) return `${base} anim-combo-pulse px-7 py-2 text-4xl max-[420px]:px-4 max-[420px]:text-2xl`;
  if (level >= 4) return `${base} anim-combo-pulse px-6 py-1.5 text-3xl max-[420px]:px-4 max-[420px]:text-[22px]`;
  return `${base} anim-callout-pop px-5 py-1 text-2xl max-[420px]:px-3 max-[420px]:text-xl`;
}

// Where a callout lands when the game does not give it explicit coordinates.
const DEFAULT_ANCHOR: Record<CalloutKind, { x: string; y: string }> = {
  score: { x: "50%", y: "45%" },
  combo: { x: "50%", y: "16%" },
  meme: { x: "50%", y: "32%" },
  boom: { x: "50%", y: "50%" },
  system: { x: "50%", y: "50%" },
};

/** Meme text / score popups, laid over the canvas (same size, so game px map 1:1). */
export default function CalloutLayer() {
  const lang = useLanguage();
  const [items, setItems] = useState<Callout[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    timers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  useGameEvent(GameEvents.CALLOUT, (d) => {
    const id = nextId.current++;
    setItems((list) => [
      ...list.slice(-(MAX_VISIBLE - 1)),
      { id, kind: d.kind, text: d.text, key: d.key, n: d.n, x: d.x ?? null, y: d.y ?? null },
    ]);
    timers.current.set(
      id,
      setTimeout(() => remove(id), LIFETIME_MS[d.kind])
    );
  });

  useGameEvent(GameEvents.SESSION_STARTED, () => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    setItems([]);
  });

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {items.map((item) => {
        const anchor = DEFAULT_ANCHOR[item.kind];
        return (
          <span
            key={item.id}
            className={`absolute whitespace-nowrap ${item.kind === "combo" ? comboStyle(item.n ?? 0) : STYLE[item.kind]}`}
            style={{ left: item.x ?? anchor.x, top: item.y ?? anchor.y }}
          >
            {calloutLabel(lang, item)}
          </span>
        );
      })}
    </div>
  );
}
