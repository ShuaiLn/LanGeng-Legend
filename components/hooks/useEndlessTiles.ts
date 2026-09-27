"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_ENDLESS_TILE_SETTINGS,
  getEndlessTileSettings,
  subscribeEndlessTileSettings,
  type EndlessTileSettings,
} from "@/lib/endlessTilesStorage";

const serverSettings = () => DEFAULT_ENDLESS_TILE_SETTINGS;

/** Which library characters are switched on for Endless. Server and first client render both see the defaults. */
export function useEndlessTileSettings(): EndlessTileSettings {
  return useSyncExternalStore(subscribeEndlessTileSettings, getEndlessTileSettings, serverSettings);
}
