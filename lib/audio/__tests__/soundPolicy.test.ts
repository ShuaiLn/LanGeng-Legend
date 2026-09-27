import { describe, expect, it } from "vitest";
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from "../../audioSettingsStorage";
import {
  decideVictory,
  isRetrigger,
  pickClearSounds,
  planVoiceEviction,
  resolvePlayback,
  selectClearPlays,
  type ActiveVoice,
} from "../soundPolicy";

const tiles = (...ids: string[]) => ids.map((characterId) => ({ characterId }));
const settings = (patch: Partial<AudioSettings> = {}): AudioSettings => ({ ...DEFAULT_AUDIO_SETTINGS, ...patch });

describe("pickClearSounds", () => {
  it("plays each character once per event, not once per tile", () => {
    expect(pickClearSounds(tiles("a", "a", "a", "b", "b"), 3)).toEqual(["a", "b"]);
  });

  it("keeps the 3 most-cleared characters", () => {
    const cleared = tiles("a", "b", "b", "c", "c", "c", "d", "d");
    expect(pickClearSounds(cleared, 3)).toEqual(["c", "b", "d"]);
  });

  it("breaks ties by whichever character was cleared first", () => {
    expect(pickClearSounds(tiles("x", "y", "z", "w"), 3)).toEqual(["x", "y", "z"]);
    expect(pickClearSounds(tiles("y", "x", "x", "y"), 1)).toEqual(["y"]);
  });

  it("handles empty input and a zero cap", () => {
    expect(pickClearSounds([], 3)).toEqual([]);
    expect(pickClearSounds(tiles("a"), 0)).toEqual([]);
  });
});

describe("resolvePlayback", () => {
  const base = { id: "laoda", hasSound: true };

  it("plays by default", () => {
    expect(resolvePlayback({ settings: DEFAULT_AUDIO_SETTINGS, ...base })).toBe("play");
  });

  it("is muted by the master switch", () => {
    expect(resolvePlayback({ settings: settings({ sfxEnabled: false }), ...base })).toBe("muted-master");
  });

  it("is muted by the per-tile switch only for that tile", () => {
    const s = settings({ tiles: { laoda: false } });
    expect(resolvePlayback({ settings: s, ...base })).toBe("muted-tile");
    expect(resolvePlayback({ settings: s, id: "kunkun", hasSound: true })).toBe("play");
  });

  it("reports no-sound before anything else", () => {
    expect(resolvePlayback({ settings: settings({ sfxEnabled: false }), id: "custom", hasSound: false })).toBe(
      "no-sound"
    );
  });

  it("treats a missing tile entry as enabled", () => {
    expect(resolvePlayback({ settings: settings({ tiles: { other: false } }), ...base })).toBe("play");
  });
});

describe("selectClearPlays", () => {
  const always = () => true;

  it("drops a muted tile instead of promoting another tile's sound", () => {
    const cleared = tiles("laoda", "laoda", "laoda", "kun", "kun", "nailong", "manbo");
    const s = settings({ tiles: { laoda: false } });
    // top 3 = laoda, kun, nailong; laoda is muted -> two sounds, and manbo does NOT fill in
    expect(selectClearPlays(cleared, s, always, 3)).toEqual(["kun", "nailong"]);
  });

  it("plays nothing when the master switch is off", () => {
    expect(selectClearPlays(tiles("a", "b"), settings({ sfxEnabled: false }), always, 3)).toEqual([]);
  });

  it("skips characters without a sound", () => {
    expect(selectClearPlays(tiles("a", "custom"), DEFAULT_AUDIO_SETTINGS, (id) => id !== "custom", 3)).toEqual(["a"]);
  });
});

describe("planVoiceEviction", () => {
  const voice = (id: string, token: number, startedAt: number): ActiveVoice => ({ id, token, startedAt });

  it("evicts nothing while under the cap", () => {
    const active = [voice("a", 1, 0), voice("b", 2, 10), voice("c", 3, 20), voice("d", 4, 30)];
    expect(planVoiceEviction(active, { id: "e" }, 5)).toEqual([]);
  });

  it("fades the oldest voice when a 6th starts, so the newest 5 win", () => {
    const active = [voice("a", 1, 0), voice("b", 2, 10), voice("c", 3, 20), voice("d", 4, 30), voice("e", 5, 40)];
    expect(planVoiceEviction(active, { id: "f" }, 5)).toEqual([1]);
  });

  it("orders by start time, not by array position", () => {
    const active = [voice("c", 3, 20), voice("a", 1, 0), voice("e", 5, 40), voice("b", 2, 10), voice("d", 4, 30)];
    expect(planVoiceEviction(active, { id: "f" }, 5)).toEqual([1]);
  });

  it("restarts a character that is already playing instead of stacking two copies", () => {
    const active = [voice("a", 1, 0), voice("b", 2, 10)];
    expect(planVoiceEviction(active, { id: "a" }, 5)).toEqual([1]);
  });

  it("does not double-evict when the restart already frees a slot", () => {
    const active = [voice("a", 1, 0), voice("b", 2, 10), voice("c", 3, 20), voice("d", 4, 30), voice("e", 5, 40)];
    // restarting "c" frees its own slot, so no other voice has to go
    expect(planVoiceEviction(active, { id: "c" }, 5)).toEqual([3]);
  });

  it("evicts several when far over the cap", () => {
    const active = [voice("a", 1, 0), voice("b", 2, 10), voice("c", 3, 20), voice("d", 4, 30)];
    expect(planVoiceEviction(active, { id: "z" }, 2)).toEqual([1, 2, 3]);
  });

  it("after a burst of 8 starts only the newest 5 remain", () => {
    let active: ActiveVoice[] = [];
    let token = 0;
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const evict = planVoiceEviction(active, { id }, 5);
      active = active.filter((v) => !evict.includes(v.token));
      active.push(voice(id, ++token, token * 10));
    }
    expect(active.map((v) => v.id)).toEqual(["d", "e", "f", "g", "h"]);
  });
});

describe("isRetrigger", () => {
  it("ignores a repeat inside the floor and allows it after", () => {
    expect(isRetrigger(1000, 1100, 150)).toBe(true);
    expect(isRetrigger(1000, 1150, 150)).toBe(false);
    expect(isRetrigger(undefined, 1000, 150)).toBe(false);
  });
});

describe("decideVictory", () => {
  it("plays the jingle for the first victory of a session", () => {
    expect(decideVictory({ lastSession: null, sessionId: 4, sfxEnabled: true })).toEqual({ play: true, remember: 4 });
  });

  it("never plays the same session twice, however often the event repeats", () => {
    let last: number | null = null;
    const plays: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const decision = decideVictory({ lastSession: last, sessionId: 7, sfxEnabled: true });
      plays.push(decision.play);
      last = decision.remember;
    }
    expect(plays).toEqual([true, false, false, false, false]);
  });

  it("plays again for a new session (Replay, or the next level)", () => {
    const first = decideVictory({ lastSession: null, sessionId: 1, sfxEnabled: true });
    expect(decideVictory({ lastSession: first.remember, sessionId: 2, sfxEnabled: true })).toEqual({
      play: true,
      remember: 2,
    });
  });

  it("stays silent when sound effects are off, but still remembers the session so un-muting cannot replay it", () => {
    const muted = decideVictory({ lastSession: null, sessionId: 3, sfxEnabled: false });
    expect(muted).toEqual({ play: false, remember: 3 });
    // sound is switched on afterwards and the same victory event arrives again: still nothing
    expect(decideVictory({ lastSession: muted.remember, sessionId: 3, sfxEnabled: true }).play).toBe(false);
    // ...but the next session does play
    expect(decideVictory({ lastSession: muted.remember, sessionId: 4, sfxEnabled: true }).play).toBe(true);
  });

  it("copes with sessions interleaving out of order", () => {
    let last: number | null = null;
    const results = [5, 6, 5].map((sessionId) => {
      const decision = decideVictory({ lastSession: last, sessionId, sfxEnabled: true });
      last = decision.remember;
      return decision.play;
    });
    // only the immediately repeated id is suppressed; a session that was superseded is a new event
    expect(results).toEqual([true, true, true]);
  });
});
