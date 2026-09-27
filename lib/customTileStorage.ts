import { CUSTOM_CHARACTER_ID, type CharacterConfig } from "@/game/config/characters";

const STORAGE_KEY = "meme-match:custom-tile";
export const CUSTOM_TILE_SIZE = 256;

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** For `useSyncExternalStore`: fires on local changes and on changes from other tabs. */
export function subscribeCustomTile(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The stored data URL (a primitive, so it is a stable external-store snapshot). */
export function readCustomTileDataUrl(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const dataUrl = window.localStorage.getItem(STORAGE_KEY);
    return dataUrl && dataUrl.startsWith("data:image/") ? dataUrl : null;
  } catch {
    return null;
  }
}

function toCharacterConfig(dataUrl: string): CharacterConfig {
  return {
    id: CUSTOM_CHARACTER_ID,
    label: "自定义",
    color: 0x6b7280,
    assets: { normal: dataUrl, sound: null, special: null, explode: null },
  };
}

/** The player's uploaded tile, or `null` if there is none (or storage is unavailable). */
export function loadCustomTile(): CharacterConfig | null {
  const dataUrl = readCustomTileDataUrl();
  return dataUrl ? toCharacterConfig(dataUrl) : null;
}

/** Returns false when the browser refuses to store it (quota, private mode, ...). */
export function saveCustomTile(dataUrl: string): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, dataUrl);
    notify();
    return true;
  } catch {
    return false;
  }
}

export function clearCustomTile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
  notify();
}

/** Centre-crops to a square and downscales to 256x256 before it goes into localStorage. */
export async function downscaleImageFile(file: File, size = CUSTOM_TILE_SIZE): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That file could not be read as an image."));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/webp", 0.85); // browsers without webp encode fall back to png
  } finally {
    URL.revokeObjectURL(url);
  }
}
