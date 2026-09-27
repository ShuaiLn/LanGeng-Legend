import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CORNER_RATIO } from "../shapes";

const scene = readFileSync(path.resolve(__dirname, "../BoardScene.ts"), "utf8");

describe("CORNER_RATIO", () => {
  it("is the one corner radius the selection ring and the text-fallback card share", () => {
    expect(CORNER_RATIO).toBe(0.2);
  });
});

// A gameplay tile is its art with its own alpha and nothing behind it. These fail if a well, a plate
// or a selection fill ever comes back (any of them reads as a light-blue square behind the tile).
describe("BoardScene draws nothing behind a tile", () => {
  it("has no cell wells", () => {
    for (const token of ["bakeWells", "updateWells", "WELLS_TEXTURE_KEY", "wellGeometry", "createCanvas"]) {
      expect(scene, token).not.toContain(token);
    }
  });

  it("has no special-tile plate", () => {
    expect(scene).not.toContain('"plate"');
    expect(scene).not.toMatch(/plate\s*[:.=]/);
    expect(scene).not.toMatch(/fillStyle\(THEME\.skySoft/);
  });

  it("draws the selection as an outline ring only, with no fill", () => {
    const body = scene.slice(scene.indexOf("private drawSelection"), scene.indexOf("private select("));
    expect(body).toContain("lineStyle");
    expect(body).toContain("strokeRoundedRect");
    expect(body).not.toContain("fillStyle");
    expect(body).not.toContain("fillRoundedRect");
    expect(scene).not.toContain("fillStyle(THEME.primary, 0.12)");
  });

  it("gives an image tile no background graphics (only the text fallback gets a card)", () => {
    expect(scene).toContain("const bg = useImage ? null : this.add.graphics();");
  });

  it("keeps the red / gold clear flash as a tinted silhouette copy of the sprite", () => {
    expect(scene).toContain("setTintMode(Phaser.TintModes.FILL)");
  });
});
