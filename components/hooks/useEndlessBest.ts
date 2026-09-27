"use client";

import { useSyncExternalStore } from "react";
import { getEndlessBest, getServerEndlessBest, subscribeEndlessBest } from "@/lib/endlessBestStorage";

/** The saved Endless best score; 0 on the server and on the first client render. */
export function useEndlessBest(): number {
  return useSyncExternalStore(subscribeEndlessBest, getEndlessBest, getServerEndlessBest);
}
