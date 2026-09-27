import { BRAND_LOGO_URL } from "@/game/config/assets";
import { audio } from "@/lib/audio/audioManager";
import { useT } from "../hooks/useT";

interface CoverStageProps {
  /** False while the intro still covers it: nothing here can be focused or clicked yet. */
  active: boolean;
  /** The assets are loaded, so a tap is allowed to leave the cover. */
  ready: boolean;
  onStart: () => void;
}

/**
 * The cover: the logo as the only visual and one quiet line under it. The whole viewport is the
 * button, so a tap or click anywhere starts the game (Enter and Space are handled by
 * OpeningSequence, and by the button itself once someone Tabs to it). There is no focus ring around
 * the viewport; keyboard focus shows on the hint line instead.
 */
export default function CoverStage({ active, ready, onStart }: CoverStageProps) {
  const t = useT();
  return (
    <button
      type="button"
      inert={!active}
      aria-disabled={!ready}
      onClick={() => {
        // Directly inside the tap handler, before anything else: this is the one gesture every
        // visitor is guaranteed to make, so it is the most reliable place to unlock mobile audio.
        // Deferring this through state, a promise or a route change loses the browser's "user
        // activation" window and leaves iOS Safari / WeChat permanently silent.
        audio.unlockFromGesture();
        onStart();
      }}
      className="group absolute inset-0 flex w-full cursor-pointer flex-col items-center justify-center px-6 outline-none aria-disabled:cursor-default"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- one static 40 KB image, needed at first paint; next/image adds nothing here */}
      <img
        src={BRAND_LOGO_URL}
        alt={t("open.logoAlt")}
        width={720}
        height={693}
        draggable={false}
        fetchPriority="high"
        className="op-logo h-auto w-[min(72vw,340px,52dvh)] select-none [filter:drop-shadow(0_12px_28px_rgb(46_143_234/0.22))]"
      />
      <span className="op-hint mt-10 text-sm font-medium tracking-[0.18em] text-ink-2 group-focus-visible:text-ink group-focus-visible:underline group-focus-visible:underline-offset-4">
        {ready ? t("open.tap") : t("open.loading")}
      </span>
    </button>
  );
}
