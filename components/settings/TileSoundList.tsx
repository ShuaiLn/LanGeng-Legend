"use client";

import { useSyncExternalStore } from "react";
import { CHARACTER_LIBRARY, CUSTOM_CHARACTER_ID } from "@/game/config/characters";
import { isTileEnabled, setManyTilesEnabled, setTileEnabled } from "@/lib/audioSettingsStorage";
import { readCustomTileDataUrl, subscribeCustomTile } from "@/lib/customTileStorage";
import { characterName } from "@/lib/i18n";
import { useAudioSettings } from "../hooks/useAudio";
import { useLanguage, useT } from "../hooks/useT";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Switch from "../ui/Switch";

const getServerSnapshot = () => null;

interface Row {
  id: string;
  label: string;
  image: string;
  note?: string;
}

/** One switch per tile. Master OFF dims them but keeps them editable, so preferences are not lost. */
export default function TileSoundList() {
  const settings = useAudioSettings();
  const t = useT();
  const lang = useLanguage();
  const customImage = useSyncExternalStore(subscribeCustomTile, readCustomTileDataUrl, getServerSnapshot);

  const rows: Row[] = CHARACTER_LIBRARY.map((c) => ({
    id: c.id,
    label: characterName(lang, c.id, c.label),
    image: c.assets.normal ?? "",
  }));
  if (customImage) {
    rows.push({
      id: CUSTOM_CHARACTER_ID,
      label: t("settings.yourTileName"),
      image: customImage,
      note: t("settings.noCustomSound"),
    });
  }
  const ids = rows.map((row) => row.id);

  return (
    <section aria-labelledby="tile-sounds-heading" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        <h2 id="tile-sounds-heading" className="text-xl font-extrabold text-ink">
          {t("settings.tileSounds")}
        </h2>
        <div className="-mr-2 flex">
          <Button variant="ghost" size="compact" onClick={() => setManyTilesEnabled(ids, true)}>
            {t("settings.enableAll")}
          </Button>
          <Button variant="ghost" size="compact" onClick={() => setManyTilesEnabled(ids, false)}>
            {t("settings.muteAll")}
          </Button>
        </div>
      </div>

      <Card
        as="ul"
        className={`overflow-hidden transition-opacity duration-[var(--dur)] ${settings.sfxEnabled ? "" : "opacity-60"}`}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 sm:px-5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static thumbnail; next/image adds nothing here */}
            <img
              src={row.image}
              alt=""
              width={40}
              height={40}
              draggable={false}
              className="h-10 w-10 shrink-0 rounded-btn-sm bg-well object-contain p-0.5"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-ink">{row.label}</span>
              {row.note && <span className="block text-xs text-ink-2">{row.note}</span>}
            </span>
            <Switch
              checked={isTileEnabled(settings, row.id)}
              onChange={(next) => setTileEnabled(row.id, next)}
              label={t("settings.tileSoundAria", { name: row.label })}
            />
          </li>
        ))}
      </Card>
      {!settings.sfxEnabled && (
        <p className="text-sm text-ink-2">{t("settings.sfxOff")}</p>
      )}
    </section>
  );
}
