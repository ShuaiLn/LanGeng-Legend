"use client";

import { useEffect, useRef } from "react";
import { CHARACTER_LIBRARY } from "@/game/config/characters";
import { ENDLESS_MIN_TILES } from "@/game/config/gameConfig";
import { isEndlessTileEnabled, setEndlessTileEnabled, setManyEndlessTilesEnabled } from "@/lib/endlessTilesStorage";
import { characterName } from "@/lib/i18n";
import { useEndlessTileSettings } from "./hooks/useEndlessTiles";
import { useLanguage, useT } from "./hooks/useT";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Switch from "./ui/Switch";

const LIBRARY_IDS = CHARACTER_LIBRARY.map((c) => c.id);

interface EndlessTilePickerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Which library characters share the board in 60-Second Endless: opens from the small icon next to
 * the Endless card in the mode picker (never navigates away from it). The choice is saved
 * (`meme-match:endless-tiles:v1`) and used the next time that mode starts; at least
 * `ENDLESS_MIN_TILES` must stay on, so a switch that would drop below it is disabled rather than let go.
 */
export default function EndlessTilePicker({ open, onClose }: EndlessTilePickerProps) {
  const t = useT();
  const lang = useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const settings = useEndlessTileSettings();
  const enabledCount = LIBRARY_IDS.filter((id) => isEndlessTileEnabled(settings, id)).length;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="endless-tiles-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="sheet m-auto w-[min(28rem,calc(100%-2rem))] max-w-none overflow-hidden rounded-card border border-line bg-panel p-0 text-ink shadow-md max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
    >
      <div className="flex max-h-[85dvh] flex-col gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 id="endless-tiles-title" className="text-2xl font-extrabold">
            {t("mode.endless.tilesTitle")}
          </h2>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-btn-sm text-xl font-bold text-ink-2 transition-colors hover:bg-well hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex items-end justify-between gap-2">
          <p className="flex-1 text-sm text-ink-2">{t("mode.endless.tilesDesc", { n: ENDLESS_MIN_TILES })}</p>
          <Button
            variant="ghost"
            size="compact"
            className="shrink-0"
            onClick={() => setManyEndlessTilesEnabled(LIBRARY_IDS, true)}
          >
            {t("settings.enableAll")}
          </Button>
        </div>

        <Card as="ul" className="overflow-y-auto overflow-x-hidden">
          {CHARACTER_LIBRARY.map((character) => {
            const label = characterName(lang, character.id, character.label);
            const checked = isEndlessTileEnabled(settings, character.id);
            return (
              <li
                key={character.id}
                className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0 sm:px-5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a small static thumbnail; next/image adds nothing here */}
                <img
                  src={character.assets.normal ?? ""}
                  alt=""
                  width={40}
                  height={40}
                  draggable={false}
                  className="h-10 w-10 shrink-0 rounded-btn-sm bg-well object-contain p-0.5"
                />
                <span className="min-w-0 flex-1 truncate text-base font-bold text-ink">{label}</span>
                <Switch
                  checked={checked}
                  disabled={checked && enabledCount <= ENDLESS_MIN_TILES}
                  onChange={(next) => setEndlessTileEnabled(character.id, next)}
                  label={t("mode.endless.tileAria", { name: label })}
                />
              </li>
            );
          })}
        </Card>
      </div>
    </dialog>
  );
}
