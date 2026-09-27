import type { Metadata, Viewport } from "next";
import AssetGate from "@/components/AssetGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "烂梗传奇 · Meme Match",
  description: "A match-3 puzzle game starring your favourite Chinese internet memes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#EAF4FF",
};

// No site-wide header or footer: the start screen has neither, gameplay has its own slim top bar,
// and the other pages bring their own back-header and footer through PageShell / PageHeader.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body>
        <AssetGate>{children}</AssetGate>
      </body>
    </html>
  );
}
