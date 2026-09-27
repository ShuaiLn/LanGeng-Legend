import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

/** Every .ts / .tsx file under `dir`, skipping tests. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const ALL = [...sourceFiles("components"), ...sourceFiles("app"), ...sourceFiles("game"), ...sourceFiles("lib")];

// The victory jingle has exactly one way to start: the celebration's final result event reaches
// AudioBridge, which asks the audio manager, which dedupes per session and respects the master switch.
// These guards fail if a second playback path appears (one that could double-play, or play on defeat).
describe("the victory jingle has one trigger", () => {
  it("is started from exactly one call site, in AudioBridge", () => {
    const callers = ALL.filter((file) => /\.playVictory\(/.test(read(file)));
    expect(callers).toEqual(["components/AudioBridge.tsx"]);
  });

  it("is triggered by the celebration result only (never by game over, restarts or renders)", () => {
    const bridge = read("components/AudioBridge.tsx");
    const start = bridge.indexOf("playVictory(");
    const line = bridge.slice(bridge.lastIndexOf("useGameEvent", start), start + 40);
    expect(line).toContain("GameEvents.CELEBRATION_RESULT");
    expect(bridge).not.toMatch(/GAME_OVER/);
    // and it is cut off, never re-started, by every way of leaving the result
    for (const event of ["RESTART_REQUESTED", "NEXT_LEVEL_REQUESTED", "SESSION_STARTED"]) {
      expect(bridge).toMatch(new RegExp(`${event}[^\\n]*stopVictory`));
    }
    expect(bridge).toContain("audio.stopAll()"); // leaving the play screen silences everything
  });

  it("is emitted from one place: the celebration, after every beat", () => {
    const emitters = ALL.filter((file) => /GameEvents\.CELEBRATION_RESULT,\s*\{/.test(read(file)));
    expect(emitters).toEqual(["game/core/celebration.ts"]);
  });

  it("is never started from a result card or any other component that re-renders", () => {
    const uiFiles = ALL.filter((file) => file.startsWith("components/") || file.startsWith("app/"));
    for (const file of uiFiles.filter((f) => f !== "components/AudioBridge.tsx")) {
      const source = read(file);
      expect(source, file).not.toMatch(/playVictory|startVictory/);
    }
    for (const file of uiFiles.filter((f) => f.startsWith("components/results/") || /StarReveal|LevelResultPanel|GameOverScreen/.test(f))) {
      expect(read(file), file).not.toMatch(/audioManager|from "@\/lib\/audio/);
    }
  });

  it("goes through the manager's shared decision and the master switch", () => {
    const manager = read("lib/audio/audioManager.ts");
    expect(manager).toContain("decideVictory(");
    expect(manager).toContain("getAudioSettings().sfxEnabled");
  });
});
