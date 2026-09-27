"use client";

import { useSyncExternalStore } from "react";
import {
  getPreloadSnapshot,
  getServerPreloadSnapshot,
  subscribePreload,
  type PreloadSnapshot,
} from "@/lib/assetPreloader";

/** Progress of the startup preload. The server and the first client render both report "loading". */
export function usePreloadStatus(): PreloadSnapshot {
  return useSyncExternalStore(subscribePreload, getPreloadSnapshot, getServerPreloadSnapshot);
}
