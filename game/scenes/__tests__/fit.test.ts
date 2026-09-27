import { describe, expect, it } from "vitest";
import { fitContain } from "../fit";

// Published tile sizes from `npm run assets:build` (longest side 512).
const SPRITES: Record<string, [number, number]> = {
  nailong: [464, 512],
  kun: [493, 512],
  laoda: [411, 512],
  jiahao: [376, 512],
  niulai: [512, 478],
  spider: [491, 512],
  xiongda: [476, 512],
  meituan: [420, 512],
  miaocui: [387, 512],
  manbo: [503, 512],
  "67": [512, 404],
};

describe("fitContain", () => {
  it("fills the longest side of every sprite and keeps its aspect ratio", () => {
    const box = 60;
    for (const [name, [w, h]] of Object.entries(SPRITES)) {
      const fit = fitContain(w, h, box, box);
      expect(Math.max(fit.width, fit.height), name).toBeCloseTo(box, 6);
      expect(fit.width / fit.height, name).toBeCloseTo(w / h, 6);
      expect(fit.width, name).toBeLessThanOrEqual(box + 1e-9);
      expect(fit.height, name).toBeLessThanOrEqual(box + 1e-9);
    }
  });

  it("centres the result in the box", () => {
    const fit = fitContain(200, 100, 100, 100);
    expect(fit).toEqual({ width: 100, height: 50, x: 0, y: 25 });
    const tall = fitContain(100, 200, 100, 100);
    expect(tall).toEqual({ width: 50, height: 100, x: 25, y: 0 });
  });

  it("scales small art up (contain, not cover) and never crops", () => {
    const fit = fitContain(16, 16, 64, 32);
    expect(fit.width).toBe(32);
    expect(fit.height).toBe(32);
  });

  it("returns an empty rect for degenerate input", () => {
    expect(fitContain(0, 10, 50, 50)).toEqual({ width: 0, height: 0, x: 0, y: 0 });
    expect(fitContain(10, 10, 0, 50)).toEqual({ width: 0, height: 0, x: 0, y: 0 });
  });
});
