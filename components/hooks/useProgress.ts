"use client";

import { useSyncExternalStore } from "react";
import { getProgress, getServerProgress, subscribeProgress, type Progress } from "@/lib/progressStorage";

/** Level progress from localStorage. Server and first client render both see an empty profile (no hydration mismatch). */
export function useProgress(): Progress {
  return useSyncExternalStore(subscribeProgress, getProgress, getServerProgress);
}
