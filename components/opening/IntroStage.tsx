import type { Ref } from "react";
import { BRAND_ICON_URL } from "@/game/config/assets";
import { FOOTER_LINES } from "../Footer";

/**
 * Pure white, the studio mark and the credit line, nothing else. The mark and the line share one
 * wrapper so they fade in together, and one wrapper so they leave together. The layer fades itself
 * out (`.op-intro-layer`), revealing the cover.
 */
export default function IntroStage({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="op-intro-layer absolute inset-0 flex items-center justify-center bg-white">
      <div className="op-intro-content">
        <div className="op-in flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- 3 KB brand mark, needed before anything else; next/image adds nothing here */}
          <img
            src={BRAND_ICON_URL}
            alt=""
            width={256}
            height={256}
            draggable={false}
            fetchPriority="high"
            className="h-28 w-28 select-none"
          />
          <p className="text-[15px] font-medium tracking-[0.14em] text-ink-2">{FOOTER_LINES[1]}</p>
        </div>
      </div>
    </div>
  );
}
