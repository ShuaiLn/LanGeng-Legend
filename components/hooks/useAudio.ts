"use client";

import { useSyncExternalStore } from "react";
import { audio } from "@/lib/audio/audioManager";
import {
  DEFAULT_AUDIO_SETTINGS,
  getAudioSettings,
  subscribeAudioSettings,
  type AudioSettings,
} from "@/lib/audioSettingsStorage";

const serverSettings = () => DEFAULT_AUDIO_SETTINGS;
const serverPreview = () => null;

/** Persisted sound preferences. Server and first client render both see the defaults (no hydration mismatch). */
export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(subscribeAudioSettings, getAudioSettings, serverSettings);
}

/** The character id whose Gallery preview is playing right now, or `null`. */
export function usePreviewState(): string | null {
  return useSyncExternalStore(audio.subscribePreview, audio.getPreviewState, serverPreview);
}
