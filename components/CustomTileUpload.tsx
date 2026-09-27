"use client";

import { useState, useSyncExternalStore } from "react";
import {
  clearCustomTile,
  downscaleImageFile,
  readCustomTileDataUrl,
  saveCustomTile,
  subscribeCustomTile,
} from "@/lib/customTileStorage";
import { useT } from "./hooks/useT";
import Button, { buttonClasses } from "./ui/Button";
import Card from "./ui/Card";

const getServerSnapshot = () => null;

/** Settings -> "Your Tile". Behaviour is unchanged from the old home-page card; only the look moved. */
export default function CustomTileUpload() {
  // Reading localStorage through an external store keeps server and first client render identical.
  const stored = useSyncExternalStore(subscribeCustomTile, readCustomTileDataUrl, getServerSnapshot);
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t("custom.errNotImage"));
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await downscaleImageFile(file);
      if (!saveCustomTile(dataUrl)) setError(t("custom.errStorage"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("custom.errProcess"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <p className="text-[15px] leading-relaxed text-ink-2">{t("custom.desc")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {stored ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image adds nothing here
          <img
            src={stored}
            alt={t("custom.alt")}
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-item border border-line bg-well object-cover"
          />
        ) : (
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-item border border-dashed border-line text-xs text-ink-2">
            {t("custom.none")}
          </div>
        )}

        <label
          className={`${buttonClasses("primary", "compact", false, "cursor-pointer")} has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary`}
        >
          {busy ? t("custom.processing") : stored ? t("custom.replace") : t("custom.choose")}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = ""; // allow re-selecting the same file
            }}
          />
        </label>

        {stored && (
          <Button
            variant="secondary"
            size="compact"
            onClick={() => {
              setError(null);
              clearCustomTile();
            }}
          >
            {t("custom.remove")}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </Card>
  );
}
