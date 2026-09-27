/**
 * The Endless-mode best score (`meme-match:endless-best:v1`, a number string). Written only when a
 * run ENDS and beats it; leaving mid-run (Pause -> Home) is not a result and saves nothing.
 */
import { browserStorage, createPersistedStore, type StorageLike } from "./persistedStore";

export const ENDLESS_BEST_KEY = "meme-match:endless-best:v1";

export interface EndlessBestResult {
  best: number;
  isNewBest: boolean;
}

export interface EndlessBestStore {
  get(): number;
  subscribe(listener: () => void): () => void;
  /** Saves `score` only if it is higher than the stored best. */
  record(score: number): EndlessBestResult;
}

/** Missing, non-numeric, negative or infinite values all read as "no best yet". */
export function parseEndlessBest(raw: string | null): number {
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

export function createEndlessBestStore(getStorage: () => StorageLike | null): EndlessBestStore {
  const store = createPersistedStore<number>({
    key: ENDLESS_BEST_KEY,
    getStorage,
    load: (raw) => ({ value: parseEndlessBest(raw) }),
    serialize: (value) => String(value),
  });

  return {
    get: store.get,
    subscribe: store.subscribe,
    record(score) {
      const previous = store.get();
      const final = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
      if (final <= previous) return { best: previous, isNewBest: false };
      store.set(final);
      return { best: final, isNewBest: true };
    },
  };
}

const defaultStore = createEndlessBestStore(browserStorage);

export const getEndlessBest = defaultStore.get;
export const getServerEndlessBest = (): number => 0;
export const subscribeEndlessBest = defaultStore.subscribe;
export const recordEndlessScore = defaultStore.record;
