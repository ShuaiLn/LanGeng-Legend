import { Suspense } from "react";
import PlayRoute from "@/components/PlayRoute";

export const metadata = { title: "Play · 烂梗传奇" };

// The site is a static export, so this Server Component cannot read the query string: PlayRoute (a Client
// Component, which needs the Suspense boundary for `useSearchParams`) does. Phaser is loaded (client-side
// only) by PlayScreen, because `next/dynamic` with `ssr: false` is not allowed in Server Components.
export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayRoute />
    </Suspense>
  );
}
