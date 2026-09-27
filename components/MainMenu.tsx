"use client";

import { useState } from "react";
import { useT } from "./hooks/useT";
import LanguageSwitch from "./LanguageSwitch";
import { TitleSync } from "./LanguageSync";
import ModePicker from "./ModePicker";
import Button from "./ui/Button";

/** Logo plus three identical vertically stacked buttons; the language switch sits top right. Play opens the mode picker. */
export default function MainMenu() {
  const t = useT();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-12 py-12">
      <TitleSync titleKey="title.home" />
      <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-10">
        <LanguageSwitch />
      </div>

      <header className="text-center">
        <h1 className="text-[clamp(2.5rem,8vw,3.75rem)] font-extrabold leading-none tracking-tight text-ink">
          烂梗<span className="text-primary">传奇</span>
        </h1>
        <p className="mt-3 text-lg font-semibold tracking-[0.25em] text-ink-2">Meme Match</p>
      </header>

      <nav aria-label={t("menu.aria")} className="flex w-[min(22rem,calc(100%-3rem))] flex-col gap-4">
        <Button fullWidth onClick={() => setPickerOpen(true)}>
          {t("menu.play")}
        </Button>
        <Button variant="secondary" href="/settings" fullWidth>
          {t("menu.settings")}
        </Button>
        <Button variant="secondary" href="/how-to-play" fullWidth>
          {t("menu.howToPlay")}
        </Button>
      </nav>

      <ModePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
