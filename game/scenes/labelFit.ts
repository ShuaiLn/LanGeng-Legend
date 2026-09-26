/**
 * Text-placeholder fitting. Cell size is always driven by the board layout; the label only
 * shrinks to fit it (max 2 lines), never the other way round. Pure so it can be unit tested.
 */

export interface LabelLayout {
  text: string; // with an explicit "\n" when split over two lines
  lines: number;
  fontSize: number;
}

const MAX_LINE_UNITS_ONE_LINE = 3.2;
const LINE_HEIGHT = 1.2;

/** Approximate advance width in "em": CJK glyphs are square, Latin ones are narrower. */
function charUnits(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x2e80) return 1;
  if (ch === " ") return 0.3;
  if (ch >= "A" && ch <= "Z") return 0.72;
  return 0.58;
}

function lineUnits(text: string): number {
  return [...text].reduce((sum, ch) => sum + charUnits(ch), 0);
}

function splitInTwo(chars: string[]): [string, string] {
  const total = lineUnits(chars.join(""));
  let running = 0;
  let cut = chars.length - 1;
  for (let i = 0; i < chars.length; i++) {
    running += charUnits(chars[i]);
    if (running >= total / 2) {
      cut = i + 1;
      break;
    }
  }
  cut = Math.min(Math.max(cut, 1), chars.length - 1);
  return [chars.slice(0, cut).join("").trim(), chars.slice(cut).join("").trim()];
}

export function computeLabelLayout(label: string, cellSize: number): LabelLayout {
  const chars = [...label.trim()];
  const oneLine = lineUnits(label) <= MAX_LINE_UNITS_ONE_LINE || chars.length < 2;
  const lines = oneLine ? [chars.join("")] : splitInTwo(chars);

  const maxWidth = cellSize * 0.8;
  const maxHeight = cellSize * 0.74;
  const widest = Math.max(...lines.map(lineUnits), 0.1);

  const fontSize = Math.max(
    8,
    Math.floor(Math.min(cellSize * 0.34, maxWidth / widest, maxHeight / (lines.length * LINE_HEIGHT)))
  );
  return { text: lines.join("\n"), lines: lines.length, fontSize };
}
