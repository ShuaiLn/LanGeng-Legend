import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BRAND_ICON_URL, BRAND_LOGO_URL, getPreloadManifest, VICTORY_SOUND_URL } from "../assets";
import { assetUrl } from "../assetUrl";
import { CHARACTER_LIBRARY } from "../characters";

const root = path.resolve(__dirname, "../../..");

/** `/game/tiles/kun.webp?v=1` -> `<root>/public/game/tiles/kun.webp` */
function publicPathOf(url: string): string {
  return path.join(root, "public", new URL(url, "http://localhost").pathname);
}

const stemOf = (url: string) => path.parse(new URL(url, "http://localhost").pathname).name;

describe("character assets", () => {
  it("has 11 characters with unique ids", () => {
    expect(CHARACTER_LIBRARY).toHaveLength(11);
    expect(new Set(CHARACTER_LIBRARY.map((c) => c.id)).size).toBe(11);
  });

  it("points every character at an art file and a sound that exist under public/", () => {
    for (const character of CHARACTER_LIBRARY) {
      expect(character.assets.normal, `${character.id} art`).toBeTruthy();
      expect(character.assets.sound, `${character.id} sound`).toBeTruthy();
      expect(existsSync(publicPathOf(character.assets.normal!)), `${character.id} art file`).toBe(true);
      expect(existsSync(publicPathOf(character.assets.sound!)), `${character.id} sound file`).toBe(true);
    }
    expect(existsSync(publicPathOf(VICTORY_SOUND_URL))).toBe(true);
  });

  it("uses one file stem for a character's art and sound", () => {
    for (const character of CHARACTER_LIBRARY) {
      expect(stemOf(character.assets.sound!)).toBe(stemOf(character.assets.normal!));
    }
  });

  it("maps the ids whose file names differ", () => {
    const stems = Object.fromEntries(CHARACTER_LIBRARY.map((c) => [c.id, stemOf(c.assets.normal!)]));
    expect(stems).toMatchObject({ kunkun: "kun", mj: "spider", sixseven: "67" });
  });

  it("references every source PNG and MP3 in assets/ (only Victory is not a tile)", () => {
    const referencedTiles = new Set(CHARACTER_LIBRARY.map((c) => stemOf(c.assets.normal!)));
    const referencedSounds = new Set(CHARACTER_LIBRARY.map((c) => stemOf(c.assets.sound!)));

    const pngs = readdirSync(path.join(root, "assets", "images")).filter((n) => /\.png$/i.test(n));
    for (const png of pngs) expect(referencedTiles.has(path.parse(png).name.toLowerCase()), png).toBe(true);
    expect(pngs).toHaveLength(referencedTiles.size);

    const mp3s = readdirSync(path.join(root, "assets", "audio")).filter((n) => /\.mp3$/i.test(n));
    for (const mp3 of mp3s) {
      const stem = path.parse(mp3).name.toLowerCase();
      if (stem === "victory") continue;
      expect(referencedSounds.has(stem), mp3).toBe(true);
    }
    expect(mp3s).toHaveLength(referencedSounds.size + 1);
  });

  it("publishes every tile as a 512x512 transparent square (power of two, so WebGL1 can mipmap it)", async () => {
    for (const character of CHARACTER_LIBRARY) {
      const meta = await sharp(publicPathOf(character.assets.normal!)).metadata();
      expect([meta.width, meta.height], character.id).toEqual([512, 512]);
      expect(meta.hasAlpha, character.id).toBe(true);
    }
  });

  it("versions every URL and keeps them lower-case", () => {
    expect(assetUrl("tiles/kun.webp")).toMatch(/^\/game\/tiles\/kun\.webp\?v=\S+$/);
    for (const character of CHARACTER_LIBRARY) {
      expect(character.assets.normal).toMatch(/\?v=/);
      expect(new URL(character.assets.normal!, "http://x").pathname).toBe(
        new URL(character.assets.normal!, "http://x").pathname.toLowerCase()
      );
    }
  });
});

describe("brand assets", () => {
  it("publishes the icon and the logo, and keeps them out of the tile folder", () => {
    expect(existsSync(publicPathOf(BRAND_ICON_URL))).toBe(true);
    expect(existsSync(publicPathOf(BRAND_LOGO_URL))).toBe(true);
    expect(existsSync(path.join(root, "public", "game", "tiles", "icon.webp"))).toBe(false);
    expect(existsSync(path.join(root, "public", "game", "tiles", "logo.webp"))).toBe(false);
    expect(BRAND_ICON_URL).toMatch(/^\/game\/brand\/icon\.webp\?v=\S+$/);
    expect(BRAND_LOGO_URL).toMatch(/^\/game\/brand\/logo\.webp\?v=\S+$/);
  });

  it("keeps the icon square with alpha (a mark on a transparent page, not a boxed tile)", async () => {
    const meta = await sharp(publicPathOf(BRAND_ICON_URL)).metadata();
    expect(meta.width).toBe(meta.height);
    expect(meta.hasAlpha).toBe(true);
  });

  it("cuts the logo out of its margin: about square, transparent corners, opaque centre", async () => {
    const image = sharp(publicPathOf(BRAND_LOGO_URL));
    const meta = await image.metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width! / meta.height!).toBeGreaterThan(0.9);
    expect(meta.width! / meta.height!).toBeLessThan(1.15);

    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + info.channels - 1];
    for (const [x, y] of [
      [0, 0],
      [info.width - 1, 0],
      [0, info.height - 1],
      [info.width - 1, info.height - 1],
    ]) {
      expect(alphaAt(x, y), `corner ${x},${y}`).toBe(0);
    }
    expect(alphaAt(Math.floor(info.width / 2), Math.floor(info.height / 2))).toBe(255);
  });
});

describe("getPreloadManifest", () => {
  it("lists 11 tiles, 11 sounds and the victory jingle", () => {
    const items = getPreloadManifest(null);
    expect(items.filter((i) => i.kind === "image")).toHaveLength(11);
    expect(items.filter((i) => i.kind === "audio")).toHaveLength(12);
    expect(items.some((i) => i.key === "victory")).toBe(true);
  });

  it("has no duplicate (kind, key) pairs and adds the custom image", () => {
    const custom = {
      id: "custom",
      label: "自定义",
      color: 0,
      assets: { normal: "data:image/webp;base64,AAAA", sound: null, special: null, explode: null },
    };
    const items = getPreloadManifest(custom);
    const keys = items.map((i) => `${i.kind}:${i.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(items.find((i) => i.key === "custom")?.kind).toBe("image");
    expect(items.filter((i) => i.key === "custom")).toHaveLength(1); // no sound yet
  });
});

/** RGBA pixels of a published image. */
async function pixels(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaAt = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
  return { width: info.width, height: info.height, alphaAt };
}

// A gameplay tile is its art with its own alpha: nothing baked behind it. A light-blue (or any) square
// painted into the file would show as a rectangle on the white board, so these fail if one ever is.
describe("tile transparency", () => {
  const EMPTY = 8; // pixels at or below this alpha count as empty, as in scripts/build-assets.mjs

  it("keeps all four canvas corners fully transparent for every published tile", async () => {
    for (const character of CHARACTER_LIBRARY) {
      const { width, height, alphaAt } = await pixels(publicPathOf(character.assets.normal!));
      for (const [x, y] of [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ]) {
        expect(alphaAt(x, y), `${character.id} corner ${x},${y}`).toBe(0);
      }
    }
  });

  it("has no filled rectangle behind the art: the corners of its own bounding box are see-through too", async () => {
    for (const character of CHARACTER_LIBRARY) {
      const { width, height, alphaAt } = await pixels(publicPathOf(character.assets.normal!));
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (alphaAt(x, y) > EMPTY) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const inset = 3;
      for (const [x, y] of [
        [minX + inset, minY + inset],
        [maxX - inset, minY + inset],
        [minX + inset, maxY - inset],
        [maxX - inset, maxY - inset],
      ]) {
        expect(alphaAt(x, y), `${character.id} bbox corner ${x},${y}`).toBeLessThanOrEqual(EMPTY);
      }

      // and a real share of the box is empty (a hidden rectangle would fill it solid)
      let empty = 0;
      const area = (maxX - minX + 1) * (maxY - minY + 1);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if (alphaAt(x, y) === 0) empty++;
      expect(empty / area, `${character.id} transparent share of its bounding box`).toBeGreaterThan(0.1);
    }
  });

  it("never flattens or fills a background in the tile pipeline (only alpha-0 padding)", () => {
    const script = readFileSync(path.join(root, "scripts", "build-assets.mjs"), "utf8");
    expect(script).not.toMatch(/\.flatten\(/);
    const backgrounds = [...script.matchAll(/background:\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(backgrounds.length).toBeGreaterThan(0);
    for (const background of backgrounds) expect(background).toMatch(/alpha:\s*0/);
  });
});

describe("small tiles (the menu's falling characters)", () => {
  it("publishes a 128x128 transparent copy of every tile, at a URL of its own", async () => {
    for (const character of CHARACTER_LIBRARY) {
      const thumb = character.assets.thumb;
      expect(thumb, character.id).toMatch(/^\/game\/tiles-sm\/[\w-]+\.webp\?v=\S+$/);
      expect(stemOf(thumb!), character.id).toBe(stemOf(character.assets.normal!));
      const file = publicPathOf(thumb!);
      expect(existsSync(file), character.id).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height], character.id).toEqual([128, 128]);
      expect(meta.hasAlpha, character.id).toBe(true);
      const { width, height, alphaAt } = await pixels(file);
      expect(alphaAt(0, 0), character.id).toBe(0);
      expect(alphaAt(width - 1, height - 1), character.id).toBe(0);
    }
  });

  it("stays small, so the first screen does not decode eleven 512px images", () => {
    let total = 0;
    for (const character of CHARACTER_LIBRARY) total += statSync(publicPathOf(character.assets.thumb!)).size;
    expect(total).toBeLessThan(250 * 1024);
  });

  it("is decoration only: not in the preload manifest", () => {
    const urls = getPreloadManifest(null).map((item) => item.url);
    expect(urls.some((url) => url.includes("/tiles-sm/"))).toBe(false);
  });
});
