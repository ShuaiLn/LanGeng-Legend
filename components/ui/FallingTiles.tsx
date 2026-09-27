import type { CSSProperties } from "react";
import { CHARACTER_LIBRARY } from "@/game/config/characters";
import { fallSpecs } from "@/lib/menuFall";

/** Fourteen in all; phones show the first nine (see `interleavedLanes`, which keeps any prefix spread out). */
export const FALLING_TILE_COUNT = 14;
export const PHONE_TILE_COUNT = 9;

// Computed once at module load: deterministic, so server and client markup match.
const SPECS = fallSpecs(
  FALLING_TILE_COUNT,
  20260926,
  CHARACTER_LIBRARY.filter((c) => c.assets.thumb).map((c) => c.id)
);

/**
 * Character art falling behind the start screen. Decoration only: `aria-hidden`, empty `alt`, not
 * focusable, `pointer-events-none`, behind everything (`-z-10`, inside MenuBackground). Motion is one
 * transform per tile (see `.fall-tile` in globals.css): no filters, no blur, no JS, hidden under
 * `prefers-reduced-motion`. The 128px copies keep the first screen from decoding eleven 512px images.
 */
export default function FallingTiles() {
  return (
    <>
      {SPECS.map((spec, index) => {
        const art = CHARACTER_LIBRARY.find((c) => c.id === spec.id)?.assets.thumb;
        if (!art) return null;
        return (
          // eslint-disable-next-line @next/next/no-img-element -- a 128px decorative copy that CSS animates; next/image adds nothing here
          <img
            key={`${spec.id}-${spec.lane}`}
            src={art}
            alt=""
            aria-hidden
            width={spec.size}
            height={spec.size}
            draggable={false}
            decoding="async"
            className={`fall-tile pointer-events-none ${index >= PHONE_TILE_COUNT ? "hidden min-[640px]:block" : ""}`}
            style={
              {
                "--x": `${spec.left.toFixed(2)}%`,
                "--s": `${spec.size}px`,
                "--d": `${spec.duration}s`,
                "--delay": `${spec.delay}s`,
                "--r": `${spec.rotate}deg`,
              } as CSSProperties
            }
          />
        );
      })}
    </>
  );
}
