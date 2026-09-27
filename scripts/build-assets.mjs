#!/usr/bin/env node
/**
 * Publishes the raw art in `assets/` as web-ready files under `public/game/`.
 *
 *   assets/images/*.png  ->  public/game/tiles/<stem>.webp   (alpha-trimmed, 512x512 square, lossless)
 *   (each tile above)    ->  public/game/tiles-sm/<stem>.webp (128x128 copy of the published tile, for the menu's falling tiles)
 *   assets/audio/*.mp3   ->  public/game/audio/<stem>.mp3    (copied, lower-cased)
 *   assets/brand/icon.png ->  public/game/brand/icon.webp     (studio mark, 256px, alpha kept)
 *   assets/brand/logo.jpg ->  public/game/brand/logo.webp     (cover art, cut out of its margin, 720px)
 *
 * Tile and sound output names are the lower-cased source stem, so no mapping table lives here: the
 * single id -> file mapping is `game/config/characters.ts`. `assets/images/` holds tiles only; the
 * two brand files live in `assets/brand/` so they are never mistaken for characters.
 * Sources in `assets/` are never modified. Re-running is idempotent: files whose bytes would not
 * change are left untouched.
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_IMAGES = path.join(root, "assets", "images");
const SRC_AUDIO = path.join(root, "assets", "audio");
const SRC_BRAND = path.join(root, "assets", "brand");
const OUT_TILES = path.join(root, "public", "game", "tiles");
const OUT_TILES_SM = path.join(root, "public", "game", "tiles-sm");
const OUT_AUDIO = path.join(root, "public", "game", "audio");
const OUT_BRAND = path.join(root, "public", "game", "brand");

const ICON_SIDE = 256;
const LOGO_WIDTH = 720;
/**
 * `logo.jpg` has no alpha: the artwork is a glassy rounded card sitting in a full-bleed margin
 * (white at the top, sky blue at the bottom), which would show as a hard-edged rectangle on any
 * page that is not exactly that gradient. So the card is cut out with a rounded-rect alpha mask.
 * Numbers are pixels of the 966x923 source, measured on its outer stroke. The two small squares
 * straddle the card's rim on purpose, so they are part of the mask too instead of being sliced flat.
 */
const LOGO_SHAPES = [
  { x: 40, y: 24, w: 876, h: 873, r: 100 }, // the card
  { x: 26, y: 203, w: 80, h: 80, r: 13 }, // left square
  { x: 851, y: 354, w: 82, h: 82, r: 13 }, // right square
];

/**
 * Published tiles are MAX_SIDE x MAX_SIDE. Transparent margins are trimmed first, then the art is
 * contain-fit (aspect ratio kept, never cropped) and centred on a transparent square. The square is
 * a power of two on purpose: Phaser 4 runs WebGL1, which can only build mipmaps for power-of-two
 * textures, and mipmaps are what keep a 512px sprite from shimmering when it is drawn at 40-90px.
 * The transparent padding costs almost nothing in lossless WebP.
 */
const MAX_SIDE = 512;
/**
 * The menu draws each character at 34-60 CSS pixels; decoding the 512px lossless art ten times just to
 * shrink it would cost ~11 MB of decoded pixels on the first screen. The small copies are still a power
 * of two, lossless and transparent (about 90 KB in all), and are new URLs, so ASSET_VERSION stays as it is.
 */
const SMALL_SIDE = 128;
/** Pixels at or below this alpha count as empty when finding the art's bounding box. */
const ALPHA_THRESHOLD = 8;

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function fileBytes(file) {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

/** Writes only when the content differs; returns "written" | "unchanged". */
async function writeIfChanged(file, data) {
  const existing = await fileBytes(file);
  if (existing && existing.equals(data)) return "unchanged";
  await writeFile(file, data);
  return "written";
}

async function trimmedBox(image) {
  const { data, info } = await image.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + (channels - 1)] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width, height, source: { width, height } }; // fully transparent
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    source: { width, height },
  };
}

async function buildTile(name) {
  const stem = path.parse(name).name.toLowerCase();
  const input = path.join(SRC_IMAGES, name);
  const output = path.join(OUT_TILES, `${stem}.webp`);

  const image = sharp(input);
  const box = await trimmedBox(image);
  const buffer = await image
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toBuffer();
  const meta = await sharp(buffer).metadata();
  const status = await writeIfChanged(output, buffer);
  return {
    file: `tiles/${stem}.webp`,
    from: `${box.source.width}x${box.source.height}`,
    trimmed: `${box.width}x${box.height}`,
    to: `${meta.width}x${meta.height}`,
    srcSize: (await stat(input)).size,
    outSize: buffer.length,
    status,
  };
}

/** A 128x128 copy of an already published tile: same transparent square, same alpha, just smaller. */
async function buildSmallTile(name) {
  const stem = path.parse(name).name.toLowerCase();
  const buffer = await sharp(path.join(OUT_TILES, `${stem}.webp`))
    .resize({ width: SMALL_SIDE, height: SMALL_SIDE, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true, effort: 6, alphaQuality: 100 })
    .toBuffer();
  const status = await writeIfChanged(path.join(OUT_TILES_SM, `${stem}.webp`), buffer);
  return { file: `tiles-sm/${stem}.webp`, outSize: buffer.length, status };
}

async function buildAudio(name) {
  const stem = path.parse(name).name.toLowerCase();
  const input = path.join(SRC_AUDIO, name);
  const output = path.join(OUT_AUDIO, `${stem}.mp3`);
  const data = await readFile(input);
  const existing = await fileBytes(output);
  let status = "unchanged";
  if (!existing || !existing.equals(data)) {
    await copyFile(input, output);
    status = "written";
  }
  return { file: `audio/${stem}.mp3`, srcSize: data.length, outSize: data.length, status };
}

async function buildBrandFile(source, name, pipeline) {
  const input = path.join(SRC_BRAND, source);
  const buffer = await pipeline(sharp(input));
  const meta = await sharp(buffer).metadata();
  return {
    file: `brand/${name}`,
    to: `${meta.width}x${meta.height}`,
    srcSize: (await stat(input)).size,
    outSize: buffer.length,
    status: await writeIfChanged(path.join(OUT_BRAND, name), buffer),
  };
}

const buildIcon = () =>
  buildBrandFile("icon.png", "icon.webp", (image) =>
    image
      .resize({ width: ICON_SIDE, height: ICON_SIDE, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ lossless: true, effort: 6, alphaQuality: 100 })
      .toBuffer()
  );

const buildLogo = () =>
  buildBrandFile("logo.jpg", "logo.webp", async (image) => {
    const left = Math.min(...LOGO_SHAPES.map((s) => s.x));
    const top = Math.min(...LOGO_SHAPES.map((s) => s.y));
    const width = Math.max(...LOGO_SHAPES.map((s) => s.x + s.w)) - left;
    const height = Math.max(...LOGO_SHAPES.map((s) => s.y + s.h)) - top;
    const rects = LOGO_SHAPES.map(
      (s) => `<rect x="${s.x - left}" y="${s.y - top}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="#fff"/>`
    ).join("");
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`);
    // Masked in its own step: sharp resizes before it composites, so the mask must match the crop.
    const masked = await image
      .extract({ left, top, width, height })
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    return sharp(masked).resize({ width: LOGO_WIDTH }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  });

async function main() {
  await mkdir(OUT_TILES, { recursive: true });
  await mkdir(OUT_TILES_SM, { recursive: true });
  await mkdir(OUT_AUDIO, { recursive: true });
  await mkdir(OUT_BRAND, { recursive: true });

  const images = (await readdir(SRC_IMAGES)).filter((n) => /\.png$/i.test(n)).sort();
  const audio = (await readdir(SRC_AUDIO)).filter((n) => /\.mp3$/i.test(n)).sort();

  const stems = new Set();
  for (const name of [...images, ...audio]) {
    const key = `${path.extname(name).toLowerCase()}:${path.parse(name).name.toLowerCase()}`;
    if (stems.has(key)) throw new Error(`Two sources map to the same lower-cased output name: ${name}`);
    stems.add(key);
  }

  const tiles = [];
  for (const name of images) tiles.push(await buildTile(name));
  const smallTiles = [];
  for (const name of images) smallTiles.push(await buildSmallTile(name));
  const sounds = [];
  for (const name of audio) sounds.push(await buildAudio(name));
  const brand = [await buildIcon(), await buildLogo()];

  console.log("\nTiles (alpha-trimmed, contain-fit on a 512x512 transparent square, lossless WebP)");
  console.table(
    tiles.map((t) => ({
      file: t.file,
      source: t.from,
      trimmed: t.trimmed,
      output: t.to,
      "src KB": kb(t.srcSize),
      "out KB": kb(t.outSize),
      status: t.status,
    }))
  );
  console.log("Small tiles (128x128 copies for the menu background)");
  console.table(smallTiles.map((t) => ({ file: t.file, "out KB": kb(t.outSize), status: t.status })));
  console.log("Audio (copied)");
  console.table(sounds.map((s) => ({ file: s.file, size: kb(s.outSize), status: s.status })));
  console.log("Brand (icon keeps alpha; logo is cut out of its margin with a rounded-rect mask)");
  console.table(
    brand.map((b) => ({ file: b.file, output: b.to, "src KB": kb(b.srcSize), "out KB": kb(b.outSize), status: b.status }))
  );

  const srcTotal = tiles.reduce((sum, t) => sum + t.srcSize, 0);
  const outTotal = tiles.reduce((sum, t) => sum + t.outSize, 0);
  const audioTotal = sounds.reduce((sum, s) => sum + s.outSize, 0);
  console.log(
    `Images ${kb(srcTotal)} -> ${kb(outTotal)}; audio ${kb(audioTotal)}; preload total ${kb(outTotal + audioTotal)}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
