"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CHARACTER_LIBRARY, CUSTOM_CHARACTER_ID } from "@/game/config/characters";
import { audio } from "@/lib/audio/audioManager";
import { resolvePlayback } from "@/lib/audio/soundPolicy";
import { characterName } from "@/lib/i18n";
import { readCustomTileDataUrl, subscribeCustomTile } from "@/lib/customTileStorage";
import { useAudioSettings, usePreviewState } from "../hooks/useAudio";
import { useLanguage, useT } from "../hooks/useT";
import TileCard from "./TileCard";

const HINT_MS = 1600;
const getServerSnapshot = () => null;

/**
 * The Gallery grid. Sounds go through the same AudioManager and the same `resolvePlayback` policy
 * as the game (no Gallery-specific mapping), so the master and per-tile switches apply, and a tap
 * never issues a network request: the clips were preloaded at startup.
 */
export default function GalleryGrid() {
  const settings = useAudioSettings();
  const t = useT();
  const lang = useLanguage();
  const playingId = usePreviewState();
  const customImage = useSyncExternalStore(subscribeCustomTile, readCustomTileDataUrl, getServerSnapshot);
  const [hintId, setHintId] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      audio.stopPreview(); // leaving the Gallery ends any preview
    },
    []
  );

  const handlePlay = useCallback((id: string) => {
    // Unlock synchronously inside this same tap/click handler before requesting playback: on
    // mobile, a Gallery preview may be the very first sound the player ever triggers.
    audio.unlockFromGesture();
    const decision = audio.playPreview(id);
    if (decision === "muted-master" || decision === "muted-tile") {
      setHintId(id);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHintId(null), HINT_MS);
    }
  }, []);

  const decisionFor = (id: string) => resolvePlayback({ settings, id, hasSound: audio.hasSound(id) });

  return (
    <ul className="grid grid-cols-3 gap-3 pb-6 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
      {CHARACTER_LIBRARY.map((character) => (
        <TileCard
          key={character.id}
          id={character.id}
          label={characterName(lang, character.id, character.label)}
          imageUrl={character.assets.normal ?? ""}
          decision={decisionFor(character.id)}
          playing={playingId === character.id}
          hint={hintId === character.id}
          onPlay={handlePlay}
        />
      ))}
      {customImage && (
        <TileCard
          key={CUSTOM_CHARACTER_ID}
          id={CUSTOM_CHARACTER_ID}
          label={t("gallery.custom")}
          imageUrl={customImage}
          decision={decisionFor(CUSTOM_CHARACTER_ID)}
          playing={playingId === CUSTOM_CHARACTER_ID}
          hint={hintId === CUSTOM_CHARACTER_ID}
          badge={t("gallery.yourTile")}
          onPlay={handlePlay}
        />
      )}
    </ul>
  );
}
