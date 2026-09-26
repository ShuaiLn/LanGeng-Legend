"use client";

import { useState, useSyncExternalStore } from "react";
import { ACTIVE_POOL_SIZE } from "@/game/config/characters";
import {
  clearCustomTile,
  downscaleImageFile,
  readCustomTileDataUrl,
  saveCustomTile,
  subscribeCustomTile,
} from "@/lib/customTileStorage";

const getServerSnapshot = () => null;

export default function CustomTileUpload() {
  // Reading localStorage through an external store keeps server and first client render identical.
  const stored = useSyncExternalStore(subscribeCustomTile, readCustomTileDataUrl, getServerSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await downscaleImageFile(file);
      if (!saveCustomTile(dataUrl)) setError("Your browser refused to store the image (storage full or blocked).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-black text-foreground">Your own tile</h2>
      <p className="mt-1 text-sm text-muted">
        Upload any picture and it joins the board as a character. It takes one of the {ACTIVE_POOL_SIZE} slots, so a
        session then uses {ACTIVE_POOL_SIZE - 1} library characters plus yours. The image is downscaled to 256×256 and
        stays in this browser only.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {stored ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL; next/image adds nothing here
          <img src={stored} alt="Your uploaded tile" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl border border-border object-cover" />
        ) : (
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted">
            none yet
          </div>
        )}

        <label className="cursor-pointer rounded-xl bg-accent px-4 py-2 text-sm font-black text-background hover:brightness-110 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
          {busy ? "Processing…" : stored ? "Replace image" : "Choose image"}
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
          <button
            type="button"
            onClick={() => {
              setError(null);
              clearCustomTile();
            }}
            className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-2"
          >
            Remove
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-accent-2">
          {error}
        </p>
      )}
    </section>
  );
}
