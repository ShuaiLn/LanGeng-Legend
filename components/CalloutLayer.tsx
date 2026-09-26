"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEvents, type CalloutKind } from "@/game/core/events";
import { useGameEvent } from "./hooks/useGameEvent";

interface Callout {
  id: number;
  kind: CalloutKind;
  text: string;
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

const STYLE: Record<CalloutKind, string> = {
  score: "anim-callout-rise text-xl font-black text-accent",
  combo: "anim-callout-pop text-3xl font-black text-accent",
  meme: "anim-callout-pop text-3xl font-black text-accent-2 sm:text-4xl",
  boom: "anim-callout-pop text-5xl font-black text-orange-400",
  system: "anim-callout-pop rounded-full bg-surface-2 px-4 py-2 text-sm font-bold text-foreground",
};

// Where a callout lands when the game does not give it explicit coordinates.
const DEFAULT_ANCHOR: Record<CalloutKind, { x: string; y: string }> = {
  score: { x: "50%", y: "45%" },
  combo: { x: "50%", y: "18%" },
  meme: { x: "50%", y: "32%" },
  boom: { x: "50%", y: "50%" },
  system: { x: "50%", y: "50%" },
};

/** Meme text / score popups, laid over the canvas (same size, so game px map 1:1). */
export default function CalloutLayer() {
  const [items, setItems] = useState<Callout[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    timers.current.delete(id);
    setItems((list) => list.filter((item) => item.id !== id));
  }, []);

  useGameEvent(GameEvents.CALLOUT, (d) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, kind: d.kind, text: d.text, x: d.x ?? null, y: d.y ?? null }]);
    timers.current.set(id, setTimeout(() => remove(id), LIFETIME_MS[d.kind]));
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
            className={`absolute whitespace-nowrap [text-shadow:0_2px_0_rgba(18,11,36,0.9),0_0_12px_rgba(18,11,36,0.8)] ${STYLE[item.kind]}`}
            style={{ left: item.x ?? anchor.x, top: item.y ?? anchor.y }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}
