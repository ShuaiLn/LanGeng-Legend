/**
 * The manager talks to Web Audio, which jsdom-less `node` tests do not have, so these fake just
 * enough of `AudioContext` to observe the unlock contract: a context is created lazily, every
 * `unlockFromGesture()` call starts a real (fake) `AudioBufferSourceNode` inside the same call — the
 * actual iOS/WeChat unlock signal — and `resume()` is only asked for while suspended/interrupted.
 *
 * `vi.resetModules()` + a dynamic `import()` per test gives every test its own fresh `AudioManager`
 * singleton (the module is a singleton by design, so re-importing without resetting would leak state
 * between tests).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioSettings } from "../../audioSettingsStorage";

type FakeState = "suspended" | "running" | "interrupted" | "closed";

const settingsState = vi.hoisted(() => ({ current: undefined as AudioSettings | undefined }));

vi.mock("@/lib/audioSettingsStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audioSettingsStorage")>("@/lib/audioSettingsStorage");
  return { ...actual, getAudioSettings: () => settingsState.current ?? actual.DEFAULT_AUDIO_SETTINGS };
});

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
}

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

/** One fake `AudioContext` class per test, so each gets its own `state` and call history. */
function makeAudioContextClass(initialState: FakeState) {
  const instances: InstanceType<typeof FakeAudioContext>[] = [];

  class FakeAudioContext {
    state: FakeState = initialState;
    currentTime = 0;
    destination = new FakeNode();
    sources: FakeSource[] = [];
    resume = vi.fn(async () => {
      this.state = "running";
      this.fire();
    });
    private listeners = new Set<() => void>();

    constructor() {
      instances.push(this);
    }
    addEventListener(type: string, cb: () => void): void {
      if (type === "statechange") this.listeners.add(cb);
    }
    removeEventListener(type: string, cb: () => void): void {
      if (type === "statechange") this.listeners.delete(cb);
    }
    /** Simulates the browser flipping state on its own (a phone call, tab freeze) and notifying us. */
    setState(next: FakeState): void {
      this.state = next;
      this.fire();
    }
    fire(): void {
      for (const cb of [...this.listeners]) cb();
    }
    createGain() {
      return new FakeGain();
    }
    createDynamicsCompressor() {
      return new FakeCompressor();
    }
    createBuffer() {
      return { duration: 0 };
    }
    createBufferSource() {
      const source = new FakeSource();
      this.sources.push(source);
      return source;
    }
    decodeAudioData() {
      return Promise.resolve({ duration: 1 });
    }
  }

  return { FakeAudioContext, instances };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loadAudio(initialState: FakeState = "suspended") {
  vi.resetModules();
  settingsState.current = undefined;
  const { FakeAudioContext, instances } = makeAudioContextClass(initialState);
  const listeners = new Map<string, Set<EventListener>>();
  const fakeWindow = {
    AudioContext: FakeAudioContext,
    addEventListener: (type: string, cb: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: EventListener) => {
      listeners.get(type)?.delete(cb);
    },
  };
  (globalThis as Record<string, unknown>).window = fakeWindow;
  (globalThis as Record<string, unknown>).document = { addEventListener: vi.fn(), hidden: false };

  const mod = await import("../audioManager");
  return { audio: mod.audio, instances, fakeWindow, listeners };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).document;
  vi.restoreAllMocks();
});

describe("unlockFromGesture", () => {
  it("primes a real source and resumes when the context starts suspended", async () => {
    const { audio, instances } = await loadAudio("suspended");
    audio.unlockFromGesture();

    expect(instances).toHaveLength(1);
    const ctx = instances[0];
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("still primes when the context already reports running (no early return)", async () => {
    const { audio, instances } = await loadAudio("running");
    audio.unlockFromGesture();

    const ctx = instances[0];
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0);
    // already running: resume() is not needed to unlock, so it must not be called
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it("primes on every call in both starting states", async () => {
    for (const state of ["suspended", "running"] as const) {
      const { audio, instances } = await loadAudio(state);
      audio.unlockFromGesture();
      audio.unlockFromGesture();
      audio.unlockFromGesture();
      expect(instances[0].sources).toHaveLength(3);
    }
  });

  it("never creates a second AudioContext across repeated gestures", async () => {
    const { audio, instances } = await loadAudio("suspended");
    audio.unlockFromGesture();
    audio.unlockFromGesture();
    audio.unlockFromGesture();
    expect(instances).toHaveLength(1);
  });

  it("re-primes and resumes after the context later drops to interrupted/suspended", async () => {
    const { audio, instances } = await loadAudio("running");
    audio.unlockFromGesture(); // first gesture: already running, no resume needed
    const ctx = instances[0];
    expect(ctx.resume).not.toHaveBeenCalled();

    ctx.setState("interrupted"); // iOS phone call, tab freeze, etc.
    audio.unlockFromGesture(); // the next tap must still be able to recover audio
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.sources.length).toBeGreaterThanOrEqual(2);

    ctx.setState("suspended");
    audio.unlockFromGesture();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });
});

describe("debugAudioState", () => {
  it("reports counts and flags without ever creating a context on its own", async () => {
    const { audio } = await loadAudio("suspended");
    expect(audio.debugAudioState()).toEqual({
      contextExists: false,
      state: "none",
      masterEnabled: true,
      registeredBytes: 0,
      decodedBuffers: 0,
      activeVoices: 0,
    });

    audio.unlockFromGesture();
    // the fake's resume() resolves synchronously; a real browser's is async, but either way the
    // context now exists and is no longer unreported ("none")
    expect(audio.debugAudioState().contextExists).toBe(true);
    expect(audio.debugAudioState().state).not.toBe("none");
  });

  it("reflects the master switch", async () => {
    const { audio } = await loadAudio("running");
    settingsState.current = { sfxEnabled: false, tiles: {} };
    expect(audio.debugAudioState().masterEnabled).toBe(false);
  });
});

describe("playback policy still holds once unlocked", () => {
  it("plays a decoded tile sound after the board's first pointerdown-style unlock", async () => {
    const { audio } = await loadAudio("running");
    audio.unlockFromGesture(); // stands in for BoardScene.handlePointerDown's unlock call
    audio.registerBytes("laoda", new ArrayBuffer(8));
    await flush();

    audio.playClear([{ characterId: "laoda" }]);
    expect(audio.debugAudioState().activeVoices).toBe(1);
  });

  it("the master switch still prevents playback", async () => {
    const { audio } = await loadAudio("running");
    settingsState.current = { sfxEnabled: false, tiles: {} };
    audio.unlockFromGesture();
    audio.registerBytes("laoda", new ArrayBuffer(8));
    await flush();

    audio.playClear([{ characterId: "laoda" }]);
    expect(audio.debugAudioState().activeVoices).toBe(0);
  });

  it("a per-tile mute still silences only that tile", async () => {
    const { audio } = await loadAudio("running");
    settingsState.current = { sfxEnabled: true, tiles: { laoda: false } };
    audio.unlockFromGesture();
    audio.registerBytes("laoda", new ArrayBuffer(8));
    audio.registerBytes("kunkun", new ArrayBuffer(8));
    await flush();

    audio.playClear([{ characterId: "laoda" }, { characterId: "kunkun" }]);
    expect(audio.debugAudioState().activeVoices).toBe(1);
  });

  it("Gallery preview still plays after an unlock in the same handler", async () => {
    const { audio } = await loadAudio("running");
    audio.unlockFromGesture(); // stands in for GalleryGrid's handlePlay unlock call
    audio.registerBytes("laoda", new ArrayBuffer(8));
    await flush();

    const decision = audio.playPreview("laoda");
    expect(decision).toBe("play");
    await flush();
    expect(audio.getPreviewState()).toBe("laoda");
  });

  it("victory.mp3 still plays once per session", async () => {
    const { audio, instances } = await loadAudio("running");
    audio.unlockFromGesture();
    audio.registerBytes("victory", new ArrayBuffer(8));
    audio.registerBytes("victory2", new ArrayBuffer(8));
    await flush();

    audio.playVictory(1);
    await flush();
    expect(audio.debugSnapshot().victoryPlaying).toBe(true);
    const sourcesAfterFirstPlay = instances[0].sources.length;

    audio.playVictory(1); // same session again: must not start a second source
    await flush();
    expect(instances[0].sources.length).toBe(sourcesAfterFirstPlay);

    audio.playVictory(2); // a genuinely new session plays again
    await flush();
    expect(instances[0].sources.length).toBeGreaterThan(sourcesAfterFirstPlay);
  });
});
