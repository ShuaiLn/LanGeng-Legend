"use client";

import { setSfxEnabled } from "@/lib/audioSettingsStorage";
import CustomTileUpload from "../CustomTileUpload";
import { useAudioSettings } from "../hooks/useAudio";
import { useT } from "../hooks/useT";
import LanguageSwitch from "../LanguageSwitch";
import { TitleSync } from "../LanguageSync";
import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";
import Switch from "../ui/Switch";
import TileSoundList from "./TileSoundList";

export default function SettingsView() {
  const settings = useAudioSettings();
  const t = useT();

  return (
    <>
      <TitleSync titleKey="title.settings" />
      <PageHeader title={t("settings.title")} />
      <div className="flex flex-col gap-6 pb-6">
        <section aria-labelledby="language-heading" className="flex flex-col gap-3">
          <h2 id="language-heading" className="text-xl font-extrabold text-ink">
            {t("settings.language")}
          </h2>
          <Card className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="min-w-0 text-sm text-ink-2">{t("settings.language.desc")}</p>
            <LanguageSwitch />
          </Card>
        </section>

        <section aria-labelledby="sound-heading" className="flex flex-col gap-3">
          <h2 id="sound-heading" className="text-xl font-extrabold text-ink">
            {t("settings.sound")}
          </h2>
          <Card className="flex min-h-14 items-center justify-between gap-4 px-5 py-2">
            <div className="min-w-0">
              <p className="text-base font-bold text-ink">{t("settings.sfx")}</p>
              <p className="text-sm text-ink-2">{t("settings.sfx.desc")}</p>
            </div>
            <Switch checked={settings.sfxEnabled} onChange={setSfxEnabled} label={t("settings.sfx")} />
          </Card>
        </section>

        <TileSoundList />

        <section aria-labelledby="your-tile-heading" className="flex flex-col gap-3">
          <h2 id="your-tile-heading" className="text-xl font-extrabold text-ink">
            {t("settings.yourTile")}
          </h2>
          <CustomTileUpload />
        </section>
      </div>
    </>
  );
}
