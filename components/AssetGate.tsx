"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { audio } from "@/lib/audio/audioManager";
import { isPreloadDone, startPreload } from "@/lib/assetPreloader";
import { plural } from "@/lib/i18n";
import { openingSeen } from "@/lib/opening";
import { useT } from "./hooks/useT";
import { usePreloadStatus } from "./hooks/usePreloadStatus";
import { LanguageSync } from "./LanguageSync";
import LoadingScreen from "./LoadingScreen";
import OpeningSequence from "./opening/OpeningSequence";

/** Even a fully cached load shows the loading screen this long, so it never flashes. */
const MIN_DISPLAY_MS = 250;

/**
 * Mounted once in the root layout: starts the preload, covers the page until it is done, and arms
 * the audio unlock listeners. A fresh load of `/` is covered by the opening (white intro, then the
 * cover, then a tap); every other entry point gets the plain loading screen. The server HTML starts
 * covered either way, so there is never an un-gated flash. If some assets failed the game still
 * works (text tile / silent), with a notice.
 */
export default function AssetGate({ children }: { children: ReactNode }) {
  const preload = usePreloadStatus();
  const pathname = usePathname();
  const t = useT();
  // Decided once, on the first render: the server and the first client render agree, and because
  // the layout never remounts, later navigation (menu -> play -> home) cannot bring the opening back.
  const [opening, setOpening] = useState(() => pathname === "/" && !openingSeen());
  const [minElapsed, setMinElapsed] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    void startPreload();
    const detach = audio.attachUnlockListeners();
    const timer = setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);
    return () => {
      detach();
      clearTimeout(timer);
    };
  }, []);

  const loading = !isPreloadDone(preload) || !minElapsed;
  const progress = preload.total > 0 ? (preload.loaded + preload.failed.length) / preload.total : 0;

  return (
    <>
      <LanguageSync />
      {/* `contents` keeps layout untouched; `inert` keeps focus out of the page while it is covered */}
      <div className="contents" inert={loading || opening}>
        {children}
      </div>

      {opening ? (
        <OpeningSequence ready={!loading} onDone={() => setOpening(false)} />
      ) : (
        loading && <LoadingScreen progress={progress} />
      )}

      {!loading && !opening && preload.status === "error" && !noticeDismissed && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-item border border-line bg-panel px-4 py-3 text-sm text-ink shadow-md"
        >
          <p className="flex-1">
            {t(plural(preload.failed.length, "error.assets.one", "error.assets.other"), { n: preload.failed.length })}
          </p>
          <button
            type="button"
            onClick={() => setNoticeDismissed(true)}
            className="h-11 shrink-0 rounded-btn-sm px-3 font-bold text-primary-ink hover:bg-well"
          >
            {t("common.dismiss")}
          </button>
        </div>
      )}

      <noscript>
        <style>{".asset-gate{display:none!important}"}</style>
      </noscript>
    </>
  );
}
