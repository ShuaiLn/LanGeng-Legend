import { useEffect, useRef } from "react";
import {
  getActiveSessionId,
  onGameEvent,
  type GameEventDetailMap,
  type GameEventName,
} from "@/game/core/events";

/**
 * Subscribes a component to the shared game event bus.
 *
 * - The effect's cleanup removes the listener, so leaving `/play` and coming back can never
 *   leave a stale listener behind (double score updates, stars revealed twice, ...).
 * - Events stamped with a sessionId other than the one currently on screen are dropped, a
 *   second safety net on top of the celebration's own cancellation token.
 */
export function useGameEvent<K extends GameEventName>(
  type: K,
  handler: (detail: GameEventDetailMap[K]) => void
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    return onGameEvent(type, (detail) => {
      const sessionId = (detail as { sessionId?: number }).sessionId;
      if (sessionId !== undefined && sessionId !== getActiveSessionId()) return;
      handlerRef.current(detail);
    });
  }, [type]);
}
