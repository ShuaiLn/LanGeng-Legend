import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Files under /public are served with `max-age=0` by default, so without this "use the browser
    // cache" would only ever mean revalidation. Every /game URL carries `?v=<ASSET_VERSION>`
    // (game/config/assetUrl.ts), so they can be immutable. Dev keeps the default so art edits show.
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/game/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
