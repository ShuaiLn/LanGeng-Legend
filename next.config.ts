import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A static export (`out/`, deployed to Cloudflare Pages). `headers()` is not supported here, so the
  // long-lived cache for /game/* lives in public/_headers, which Cloudflare Pages reads.
  output: "export",
};

export default nextConfig;
