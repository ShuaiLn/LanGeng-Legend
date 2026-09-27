/**
 * Bump when any file under `public/game/` changes. Those URLs are served as immutable in
 * production (see `next.config.ts`), so a new version string is what makes browsers refetch.
 */
export const ASSET_VERSION = "5";

/** Public URL of a file published by `npm run assets:build`, e.g. `assetUrl("tiles/kun.webp")`. */
export function assetUrl(relativePath: string): string {
  return `/game/${relativePath}?v=${ASSET_VERSION}`;
}
