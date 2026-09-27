import { redirect } from "next/navigation";
import PlayScreen from "@/components/PlayScreen";
import { parseDifficulty } from "@/game/config/difficulty";
import { parseLevelNumber } from "@/game/config/levels";
import type { PlayMode } from "@/game/core/events";

export const metadata = { title: "Play · 烂梗传奇" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// A Server Component that only reads the query string. Phaser is loaded (client-side only) by
// PlayScreen, because `next/dynamic` with `ssr: false` is not allowed in Server Components.
//   /play?mode=endless
//   /play?mode=level&level=7&difficulty=hard    (a level mode link without a valid level goes to the list)
export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const { mode, level, difficulty } = await searchParams;
  const playMode: PlayMode = mode === "level" ? "level" : "endless";

  if (playMode === "endless") return <PlayScreen key="endless" mode="endless" levelNumber={null} difficulty="normal" />;

  const levelNumber = parseLevelNumber(level);
  if (levelNumber === null) redirect("/levels");
  const chosen = parseDifficulty(difficulty);
  // the key includes level and difficulty, so Next Level (a route change) mounts a fresh game
  return <PlayScreen key={`level-${chosen}-${levelNumber}`} mode="level" levelNumber={levelNumber} difficulty={chosen} />;
}
