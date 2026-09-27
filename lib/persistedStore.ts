/**
 * A tiny localStorage-backed store shared by the progress, Endless-best and language stores. Same
 * shape as `audioSettingsStorage`: try/catch around every storage call, an in-memory snapshot that
 * stays authoritative even if persisting fails, a stable snapshot reference for
 * `useSyncExternalStore`, and the cross-tab `storage` event. Built as a factory so tests can hand it
 * a fake storage.
 */
import type { StorageLike } from "./audioSettingsStorage";

export type { StorageLike };

export interface PersistedStore<T> {
  /** A stable reference until something changes, so it is a valid `useSyncExternalStore` snapshot. */
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

export interface PersistedStoreOptions<T> {
  key: string;
  getStorage: () => StorageLike | null;
  /**
   * Turns whatever is stored (`null` when absent) into a value; must never throw. Return
   * `migrated: true` to have the value written straight back (a one-off import from an older key).
   */
  load(raw: string | null): { value: T; migrated?: boolean };
  serialize(value: T): string;
}

export function createPersistedStore<T>(options: PersistedStoreOptions<T>): PersistedStore<T> {
  const listeners = new Set<() => void>();
  let snapshot: { value: T } | null = null;
  let storageListening = false;

  function storage(): StorageLike | null {
    try {
      return options.getStorage();
    } catch {
      return null;
    }
  }

  function persist(value: T): void {
    try {
      storage()?.setItem(options.key, options.serialize(value));
    } catch {
      // storage full or blocked: the value just will not survive a reload
    }
  }

  function read(): T {
    let raw: string | null = null;
    try {
      raw = storage()?.getItem(options.key) ?? null;
    } catch {
      raw = null;
    }
    const loaded = options.load(raw);
    if (loaded.migrated) persist(loaded.value);
    return loaded.value;
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  /** Other tabs write the same key: drop the cached snapshot and tell subscribers. */
  function listenForOtherTabs(): void {
    if (storageListening || typeof window === "undefined") return;
    storageListening = true;
    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key !== null && event.key !== options.key) return;
      snapshot = null;
      notify();
    });
  }

  function get(): T {
    listenForOtherTabs();
    if (!snapshot) snapshot = { value: read() };
    return snapshot.value;
  }

  return {
    get,
    set(next) {
      snapshot = { value: next }; // in-memory state is authoritative even if persisting fails
      persist(next);
      notify();
    },
    subscribe(listener) {
      listenForOtherTabs();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The real `window.localStorage`, or `null` on the server / when access throws. */
export function browserStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}
