import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buttonClasses } from "@/components/ui/Button";

const root = path.resolve(__dirname, "../..");

/** Every .ts / .tsx file under `dir`, skipping tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const FILES = [...sourceFiles("components"), ...sourceFiles("app")];
const css = readFileSync(path.join(root, "app", "globals.css"), "utf8");

/** The spec: rectangular and restrained, 6-18px; buttons are the sharpest of the interactive shapes. */
const RADIUS_TOKENS = { chip: 6, "btn-sm": 7, btn: 9, item: 14, card: 16, board: 18 };

/** Pills that are meant to be pills: progress bars, the Switch, the equalizer bars. Counted per file. */
const PILL_ALLOWLIST: Record<string, number> = {
  "components/GoalPanel.tsx": 2, // goal progress track + fill
  "components/LoadingScreen.tsx": 2, // loading progress track + fill
  "components/ui/Switch.tsx": 3, // hit area, track, thumb
  "components/gallery/TileCard.tsx": 1, // the 3px equalizer bar
};

/** Source without comments, so prose like "a rounded progress bar" is not read as a class. */
function code(file: string): string {
  return readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(?<![:"'`])\/\/[^\n]*/g, "");
}

/** `rounded-lg`, `max-sm:rounded-b-none`, `rounded-[24px]`: the class after any variant, minus a side. */
function roundedClasses(source: string): string[] {
  return [...source.matchAll(/(?<![\w-])rounded(?:-(?:t|b|l|r|tl|tr|bl|br|s|e))?(?:-([\w-]+|\[[^\]\s]+\]))?(?![\w-])/g)].map(
    (m) => m[1] ?? "",
  );
}

describe("radius tokens", () => {
  it("defines exactly the six radii of the spec and nothing else", () => {
    const defined = Object.fromEntries(
      [...css.matchAll(/--radius-([\w-]+):\s*(\d+)px/g)].map((m) => [m[1], Number(m[2])]),
    );
    expect(defined).toEqual(RADIUS_TOKENS);
  });

  it("uses a light shadow: nothing taller than 10px of blur", () => {
    const md = css.match(/--shadow-md:\s*0 (\d+)px (\d+)px/);
    expect(md).not.toBeNull();
    expect(Number(md![1])).toBeLessThanOrEqual(2);
    expect(Number(md![2])).toBeLessThanOrEqual(10);
  });
});

describe("radius usage", () => {
  it("only uses defined radius tokens (an undefined `rounded-*` silently draws square corners)", () => {
    const allowed = new Set([...Object.keys(RADIUS_TOKENS), "none", "full"]);
    for (const file of FILES) {
      for (const name of roundedClasses(code(file))) {
        if (/^\[\d+px\]$/.test(name)) {
          expect(parseInt(name.slice(1), 10), `${file}: rounded-${name}`).toBeLessThanOrEqual(18);
        } else {
          expect(allowed.has(name), `${file}: rounded-${name}`).toBe(true);
        }
      }
    }
  });

  it("keeps rounded-full to progress bars, the Switch and the equalizer bars", () => {
    const found: Record<string, number> = {};
    for (const file of FILES) {
      const count = roundedClasses(code(file)).filter((n) => n === "full").length;
      if (count > 0) found[file] = count;
    }
    expect(found).toEqual(PILL_ALLOWLIST);
  });

  it("sizes buttons 52px large / 44px compact, with the matching radius", () => {
    const large = buttonClasses("primary", "large", false);
    const compact = buttonClasses("secondary", "compact", false);
    expect(large).toContain("h-[52px]");
    expect(large).toContain("rounded-btn ");
    expect(compact).toContain("h-11");
    expect(compact).toContain("rounded-btn-sm");
    // one shared box: every variant has the 1px border, transparent when it should not show
    expect(buttonClasses("primary", "large", false)).toContain("border-transparent");
    expect(buttonClasses("secondary", "large", false)).toContain("border-line");
  });
});
