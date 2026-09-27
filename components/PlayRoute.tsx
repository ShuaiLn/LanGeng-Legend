"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { parseDifficulty } from "@/game/config/difficulty";
import { parseLevelNumber } from "@/game/config/levels";
import PlayScreen from "./PlayScreen";

/**
 * Reads the query string of /play in the browser: the site is a static export, so there is no server to
 * read `searchParams` on. Rendered inside a Suspense boundary by `app/play/page.tsx`.
 *   /play?mode=endless
 *   /play?mode=level&level=7&difficulty=hard    (a level mode link without a valid level goes to the list)
 */
export default function PlayRoute() {
  const params = useSearchParams();
  const router = useRouter();
  const isLevel = params.get("mode") === "level";
  const levelNumber = isLevel ? parseLevelNumber(params.get("level")) : null;
  const invalid = isLevel && levelNumber === null;

  useEffect(() => {
    if (invalid) router.replace("/levels");
  }, [invalid, router]);

  if (!isLevel) return <PlayScreen key="endless" mode="endless" levelNumber={null} difficulty="normal" />;
  if (levelNumber === null) return null;

  const chosen = parseDifficulty(params.get("difficulty"));
  // the key includes level and difficulty, so Next Level (a route change) mounts a fresh game
  return <PlayScreen key={`level-${chosen}-${levelNumber}`} mode="level" levelNumber={levelNumber} difficulty={chosen} />;
}
