import PlayScreen from "@/components/PlayScreen";
import type { PlayMode } from "@/game/core/events";

export const metadata = { title: "Play · 烂梗传奇" };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// A Server Component that only reads the query string. Phaser is loaded (client-side only) by
// PlayScreen, because `next/dynamic` with `ssr: false` is not allowed in Server Components.
export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const { mode } = await searchParams;
  const playMode: PlayMode = mode === "level" ? "level" : "endless";
  return <PlayScreen key={playMode} mode={playMode} />;
}
