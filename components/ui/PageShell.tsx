import type { ReactNode } from "react";
import Footer from "../Footer";
import { MenuBackground } from "./BackgroundDecor";

interface PageShellProps {
  children: ReactNode;
  /** Show the drifting start-screen background (the other pages use the plain page gradient). */
  menuBackground?: boolean;
  /** Vertically centre the content (the start screen). */
  centered?: boolean;
  /** Content column width; the footer always sits below it in normal flow. */
  width?: "narrow" | "wide";
}

/**
 * Shell for every non-game page: content, then the footer in normal flow (`mt-auto`), so on a
 * short viewport the footer can never sit on top of a button.
 */
export default function PageShell({
  children,
  menuBackground = false,
  centered = false,
  width = "narrow",
}: PageShellProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col pt-[env(safe-area-inset-top)]">
      {menuBackground && <MenuBackground />}
      <div
        className={`mx-auto flex w-full flex-1 flex-col px-4 ${width === "wide" ? "max-w-4xl" : "max-w-2xl"} ${
          centered ? "justify-center" : ""
        }`}
      >
        {children}
      </div>
      <Footer />
    </div>
  );
}
