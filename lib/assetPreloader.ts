/**
 * Startup preloader: fetches every tile image and MP3 once, before the menu is usable.
 *
 * Module state (not React state) so it survives client-side navigation: the loading screen shows
 * once per page load, and menu -> play -> retry -> gallery never downloads anything twice (audio
 * bytes go to the AudioManager, images land in the browser's HTTP cache).
 *
 * It can never block forever: each item gets retries, the whole run has a ceiling, and failures
 * are reported in `failed` so the game degrades (text placeholder tile / silent) instead of hanging.
 */
import { getPreloadManifest, type PreloadItem } from "@/game/config/assets";
import { audio } from "./audio/audioManager";
import { loadCustomTile } from "./customTileStorage";

export type PreloadStatus = "loading" | "ready" | "error";

export interface PreloadSnapshot {
  /** `error` = finished, but at least one item failed (see `failed`). The game is still playable. */
  status: PreloadStatus;
  loaded: number;
  total: number;
  failed: readonly string[];
}

export const PRELOAD_CONCURRENCY = 6;
export const PRELOAD_RETRIES = 2;
export const PRELOAD_TIMEOUT_MS = 20_000;

const LOADING_SNAPSHOT: PreloadSnapshot = { status: "loading", loaded: 0, total: 0, failed: [] };

let snapshot: PreloadSnapshot = LOADING_SNAPSHOT;
let promise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: PreloadSnapshot): void {
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

/** Stable object per change: a valid `useSyncExternalStore` snapshot. */
export function getPreloadSnapshot(): PreloadSnapshot {
  return snapshot;
}

/** What the server (and the first client render) sees, so hydration always agrees. */
export function getServerPreloadSnapshot(): PreloadSnapshot {
  return LOADING_SNAPSHOT;
}

export function subscribePreload(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True once the run finished, successfully or not. */
export function isPreloadDone(state: PreloadSnapshot): boolean {
  return state.status !== "loading";
}

async function loadImage(url: string, signal: AbortSignal): Promise<void> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await Promise.race([
    image.decode(),
    new Promise<never>((_, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
    ),
  ]);
}

async function loadAudio(item: PreloadItem, signal: AbortSignal): Promise<void> {
  const response = await fetch(item.url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  audio.registerBytes(item.key, await response.arrayBuffer());
}

async function loadItem(item: PreloadItem, signal: AbortSignal): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= PRELOAD_RETRIES; attempt++) {
    if (signal.aborted) break;
    try {
      await (item.kind === "image" ? loadImage(item.url, signal) : loadAudio(item, signal));
      return;
    } catch (error) {
      lastError = error;
      if (signal.aborted) break;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("aborted");
}

async function run(): Promise<void> {
  const items = getPreloadManifest(loadCustomTile());
  const failed: string[] = [];
  let loaded = 0;
  publish({ status: "loading", loaded, total: items.length, failed: [] });

  const controller = new AbortController();
  const ceiling = setTimeout(() => controller.abort(), PRELOAD_TIMEOUT_MS);

  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const item = items[next++];
      try {
        await loadItem(item, controller.signal);
        loaded++;
      } catch {
        failed.push(`${item.kind}:${item.key}`);
      }
      publish({ status: "loading", loaded, total: items.length, failed: [...failed] });
    }
  }
  await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, items.length) }, worker));

  clearTimeout(ceiling);
  publish({ status: failed.length > 0 ? "error" : "ready", loaded, total: items.length, failed: [...failed] });
}

/** Starts the preload (once per page load) and returns the same promise on every call. */
export function startPreload(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  promise ??= run().catch(() => {
    // a bug must not leave the loading screen up forever
    publish({ status: "error", loaded: snapshot.loaded, total: snapshot.total, failed: [...snapshot.failed] });
  });
  return promise;
}
