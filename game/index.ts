import Phaser from "phaser";
import type { LevelConfig } from "./config/levels";
import { activeCelebrationCount } from "./core/celebration";
import { emitGameEvent, GameEvents, gameListenerCount, onGameEvent, type PlayMode } from "./core/events";
import { BoardScene } from "./scenes/BoardScene";
import { BootScene } from "./scenes/BootScene";

/** Above this the extra pixels cost more than they show (phones report 2-3). */
const MAX_DEVICE_RATIO = 3;

/**
 * Creates the Phaser game inside `parent`. Browser-only: import this module solely from a
 * Client Component that is itself loaded with `next/dynamic(..., { ssr: false })`.
 *
 * The canvas backing store is sized in DEVICE pixels (parent CSS size x devicePixelRatio) while CSS
 * keeps it filling the parent, so art stays sharp on HiDPI screens. Phaser's RESIZE mode always
 * uses CSS pixels, so the size is managed here instead. Inside the game everything is in game
 * pixels; the ratio is published as `registry.get("dpr")` for the few places that mix in CSS
 * pixels (swipe distance, particle physics, and callout coordinates sent to React).
 *
 * `level` is the already-resolved level (number + difficulty) for Level Mode, `null` for Endless. The
 * scene never picks a level itself; it reads this one from the registry, and Replay restarts it as is.
 */
export function createGame(parent: HTMLElement, mode: PlayMode, level: LevelConfig | null = null): Phaser.Game {
  const deviceRatio = () => Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_DEVICE_RATIO);
  const measure = () => {
    const dpr = deviceRatio();
    return {
      dpr,
      width: Math.max(1, Math.round(parent.clientWidth * dpr)),
      height: Math.max(1, Math.round(parent.clientHeight * dpr)),
    };
  };
  const first = measure();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    // The board card behind the tiles is CSS; a transparent canvas lets it show through.
    transparent: true,
    // Mipmaps (power-of-two textures only, which is why tiles are published as 512x512 squares)
    // keep the downscaled sprites from shimmering while they move.
    render: { mipmapFilter: "LINEAR_MIPMAP_LINEAR" },
    scale: { mode: Phaser.Scale.NONE, width: first.width, height: first.height },
    disableContextMenu: true,
    scene: [BootScene, BoardScene],
    callbacks: {
      preBoot: (instance) => {
        instance.registry.set("mode", mode);
        instance.registry.set("level", level);
        instance.registry.set("dpr", first.dpr);
      },
    },
  });

  // CSS, not Phaser, sizes the canvas on screen: it always fills the parent.
  const style = game.canvas.style;
  style.width = "100%";
  style.height = "100%";
  style.display = "block";

  const refit = () => {
    const next = measure();
    game.registry.set("dpr", next.dpr);
    if (next.width !== game.scale.width || next.height !== game.scale.height) {
      game.scale.resize(next.width, next.height); // emits Scale RESIZE, which BoardScene relays out on
    }
  };
  const observer = new ResizeObserver(refit);
  observer.observe(parent);
  // moving the window to a screen with another pixel ratio changes no CSS size, so listen for it too
  const ratioQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  ratioQuery.addEventListener("change", refit);
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    observer.disconnect();
    ratioQuery.removeEventListener("change", refit);
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
