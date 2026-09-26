import Phaser from "phaser";
import { activeCelebrationCount } from "./core/celebration";
import { emitGameEvent, GameEvents, gameListenerCount, onGameEvent, type PlayMode } from "./core/events";
import { BoardScene } from "./scenes/BoardScene";
import { BootScene } from "./scenes/BootScene";

/**
 * Creates the Phaser game inside `parent`. Browser-only: import this module solely from a
 * Client Component that is itself loaded with `next/dynamic(..., { ssr: false })`.
 */
export function createGame(parent: HTMLElement, mode: PlayMode): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#160f2b",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: "100%",
      height: "100%",
    },
    scene: [BootScene, BoardScene],
    disableContextMenu: true,
    callbacks: {
      preBoot: (instance) => {
        instance.registry.set("mode", mode);
      },
    },
  });

  if (process.env.NODE_ENV !== "production") {
    // Dev-only handles for poking at the running game from the console / browser-driven checks.
    const w = window as unknown as Record<string, unknown>;
    w.__game = game;
    w.__memeMatchDebug = {
      listenerCount: gameListenerCount,
      activeCelebrations: activeCelebrationCount,
      emit: emitGameEvent,
      on: onGameEvent,
      events: GameEvents,
    };
  }
  return game;
}
