/**
 * Framework-agnostic Web Audio manager for tile sounds and the victory jingle.
 *
 * Deliberately NOT Phaser's sound manager: Phaser only exists on /play and its Game (and cache) is
 * destroyed on every exit, while Settings, the Gallery, the menu and the victory panel are plain
 * React. This module-level singleton survives route changes, so decoded buffers live for the
 * whole visit. The rules (what plays, what gets evicted) are pure functions in `soundPolicy.ts`.
 *
 * Browser-only at runtime; importing it on the server is harmless (every entry point no-ops
 * without an `AudioContext`).
 */
import { soundUrlFor, victorySoundUrl, VICTORY_SOUND_KEYS } from "@/game/config/assets";
import { AUDIO } from "@/game/config/gameConfig";
import { getAudioSettings } from "../audioSettingsStorage";
import {
  chooseVictorySound,
  decideVictory,
  isRetrigger,
  planVoiceEviction,
  resolvePlayback,
  selectClearPlays,
  type ActiveVoice,
  type HasCharacter,
  type PlaybackDecision,
} from "./soundPolicy";

interface LiveVoice extends ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface Channel {
  token: number;
  id: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

// touchend fires too late to count as the unlocking gesture on iOS; pointerdown/touchstart/click/keydown
// all land at (or before) the moment the browser considers "trusted user activation" to start.
const UNLOCK_EVENTS = ["pointerdown", "touchstart", "click", "keydown"] as const;

class AudioManager {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;

  /** Raw MP3 bytes from the preloader, decoded lazily once the context is unlocked. */
  private bytes = new Map<string, ArrayBuffer>();
  private buffers = new Map<string, AudioBuffer>();
  private decoding = new Map<string, Promise<AudioBuffer | null>>();
  private customIds = new Set<string>();

  private voices = new Map<number, LiveVoice>();
  private lastStart = new Map<string, number>();
  private nextToken = 1;

  private preview: Channel | null = null;
  private previewRequest = 0;
  private previewListeners = new Set<() => void>();

  private victory: Channel | null = null;
  private victoryRequest = 0;
  private lastVictorySession: number | null = null;

  private unlockAttached = false;
  private visibilityAttached = false;
  private decodedAll = false;

  // ---- context & unlock ------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    try {
      const ctx = new Ctor({ latencyHint: "interactive" });
      const bus = ctx.createGain();
      bus.gain.value = AUDIO.busGain;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      bus.connect(compressor);
      compressor.connect(ctx.destination);
      ctx.addEventListener("statechange", this.handleStateChange);
      this.ctx = ctx;
      this.bus = bus;
    } catch {
      return null;
    }

    if (!this.visibilityAttached) {
      this.visibilityAttached = true;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.stopPreview();
      });
    }
    return this.ctx;
  }

  /**
   * `running` is not a permanent fact on mobile: iOS Safari / WeChat can drop back to `suspended` or
   * `interrupted` later (a phone call, the tab losing focus, Safari's own power-saving). This only
   * decodes whatever bytes are waiting; it deliberately never detaches the gesture listeners, so a
   * later interruption always has a live listener ready to re-prime and resume on the next tap.
   */
  private handleStateChange = (): void => {
    if (this.ctx && String(this.ctx.state) === "running") void this.decodeRegistered();
  };

  /**
   * Public, synchronous gesture entry point. Wire this directly into the real DOM event handler for
   * every explicit "first sound" moment (the opening cover's tap, the board's first pointerdown, a
   * Gallery preview tap) — never through a `useEffect`, a `.then()`, or a `setTimeout`, all of which
   * run outside the browser's "user activation" window and silently fail to unlock iOS/WeChat audio.
   *
   * Safe to call repeatedly and from more than one handler for the same gesture: every call creates
   * the context if needed and ALWAYS starts a real, silent `AudioBufferSourceNode` inside the current
   * call stack (the actual iOS unlock signal), even if `ctx.state` already reads `"running"` — that
   * report can be stale or won by a resume() that resolved outside a gesture, so it must never be
   * trusted to skip priming.
   */
  unlockFromGesture = (): void => {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const silent = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silent;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // not fatal: resume() below is the standard path
    }

    const state = String(ctx.state);
    if (state === "suspended" || state === "interrupted") ctx.resume().catch(() => undefined);
  };

  private attachUnlock(): void {
    if (this.unlockAttached || typeof window === "undefined") return;
    this.unlockAttached = true;
    for (const type of UNLOCK_EVENTS)
      window.addEventListener(type, this.unlockFromGesture, { capture: true, passive: true });
  }

  private detachUnlock(): void {
    if (!this.unlockAttached || typeof window === "undefined") return;
    this.unlockAttached = false;
    for (const type of UNLOCK_EVENTS) window.removeEventListener(type, this.unlockFromGesture, { capture: true });
  }

  /**
   * Starts listening for the first user gesture, as a FALLBACK safety net for any tap that is not one
   * of the explicit call sites above (e.g. a returning visitor who skips the opening cover entirely
   * and lands straight on the menu). Kept attached for the whole app lifetime — never torn down just
   * because the context once reported `running` (see `handleStateChange`). Returns a disposer for the
   * component that armed it; safe to call repeatedly.
   */
  attachUnlockListeners(): () => void {
    this.attachUnlock();
    return () => this.detachUnlock();
  }

  /** Resolves with a running context, resuming it if a gesture is in flight; `null` if impossible. */
  private async runningContext(): Promise<AudioContext | null> {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (String(ctx.state) !== "running") {
      try {
        await ctx.resume();
      } catch {
        return null;
      }
    }
    return String(ctx.state) === "running" ? ctx : null;
  }

  // ---- buffers ------------------------------------------------------------------

  /** Called by the preloader with the raw bytes of a fetched MP3 (`key` = character id / "victory"). */
  registerBytes(key: string, data: ArrayBuffer): void {
    if (this.buffers.has(key)) return;
    this.bytes.set(key, data);
    if (this.ctx && String(this.ctx.state) === "running") void this.decode(key);
  }

  /** For the future custom-tile sound: makes `id` behave like any library tile. */
  async registerCustom(id: string, blob: Blob): Promise<void> {
    this.customIds.add(id);
    this.buffers.delete(id);
    this.registerBytes(id, await blob.arrayBuffer());
  }

  hasSound(id: string): boolean {
    return this.customIds.has(id) || soundUrlFor(id) !== null;
  }

  private urlFor(key: string): string | null {
    return victorySoundUrl(key) ?? soundUrlFor(key);
  }

  private async fetchBytes(key: string): Promise<ArrayBuffer | null> {
    const url = this.urlFor(key);
    if (!url) return null;
    try {
      const response = await fetch(url);
      return response.ok ? await response.arrayBuffer() : null;
    } catch {
      return null;
    }
  }

  private decode(key: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = this.decoding.get(key);
    if (pending) return pending;
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);

    const job = (async () => {
      // A clip the preloader never delivered (failed / not finished) is fetched once, on demand.
      const raw = this.bytes.get(key) ?? (await this.fetchBytes(key));
      if (!raw) return null;
      try {
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        this.buffers.set(key, buffer);
        this.bytes.delete(key);
        return buffer;
      } catch {
        return null;
      }
    })().finally(() => this.decoding.delete(key));
    this.decoding.set(key, job);
    return job;
  }

  private async decodeRegistered(): Promise<void> {
    if (this.decodedAll) return;
    this.decodedAll = true;
    for (const key of [...this.bytes.keys()]) await this.decode(key);
  }

  // ---- voices -----------------------------------------------------------------------

  private fadeAndStop(source: AudioBufferSourceNode, gain: GainNode, ms: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + ms / 1000);
      source.stop(t + ms / 1000 + 0.02);
    } catch {
      // already stopped
    }
  }

  private spawn(buffer: AudioBuffer): { source: AudioBufferSourceNode; gain: GainNode } | null {
    const ctx = this.ctx;
    if (!ctx || !this.bus) return null;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(this.bus);
    source.start(0);
    return { source, gain };
  }

  private releaseNodes(source: AudioBufferSourceNode, gain: GainNode): void {
    try {
      source.disconnect();
      gain.disconnect();
    } catch {
      // already disconnected
    }
  }

  private startTileVoice(id: string): void {
    const ctx = this.ctx;
    if (!ctx || String(ctx.state) !== "running") return;
    const now = performance.now();
    if (isRetrigger(this.lastStart.get(id), now, AUDIO.retriggerMs)) return;

    const buffer = this.buffers.get(id);
    if (!buffer) {
      // first use of this clip: decode it (a few ms), then start it
      void this.decode(id).then((decoded) => {
        if (decoded) this.startTileVoice(id);
      });
      return;
    }

    this.lastStart.set(id, now);
    const running = [...this.voices.values()];
    for (const token of planVoiceEviction(running, { id }, AUDIO.maxVoices)) {
      const old = this.voices.get(token);
      if (!old) continue;
      this.voices.delete(token);
      this.fadeAndStop(old.source, old.gain, old.id === id ? AUDIO.restartFadeMs : AUDIO.evictFadeMs);
    }

    const nodes = this.spawn(buffer);
    if (!nodes) return;
    const token = this.nextToken++;
    this.voices.set(token, { id, token, startedAt: now, ...nodes });
    nodes.source.onended = () => {
      this.voices.delete(token);
      this.releaseNodes(nodes.source, nodes.gain);
    };
  }

  /**
   * One elimination event: at most `AUDIO.maxSoundsPerClear` sounds (the most-cleared
   * characters), one per character, respecting the master and per-tile switches.
   */
  playClear(cleared: readonly HasCharacter[]): void {
    if (!this.ctx) return; // nothing has unlocked audio yet
    const ids = selectClearPlays(cleared, getAudioSettings(), (id) => this.hasSound(id), AUDIO.maxSoundsPerClear);
    for (const id of ids) this.startTileVoice(id);
  }

  // ---- gallery preview (one slot) --------------------------------------------------------

  private setPreview(channel: Channel | null): void {
    this.preview = channel;
    for (const listener of [...this.previewListeners]) listener();
  }

  subscribePreview = (listener: () => void): (() => void) => {
    this.previewListeners.add(listener);
    return () => {
      this.previewListeners.delete(listener);
    };
  };

  /** The character id currently being previewed, or `null`. A primitive, so a valid store snapshot. */
  getPreviewState = (): string | null => this.preview?.id ?? null;

  /**
   * Plays a tile's sound for the Gallery. Uses the same policy as the game, so a muted tile stays
   * silent. Returns why it did or did not play so the UI can show the right state. Tapping the
   * same tile again restarts it; a different tile replaces it (one preview at a time).
   */
  playPreview(id: string): PlaybackDecision {
    const decision = resolvePlayback({ settings: getAudioSettings(), id, hasSound: this.hasSound(id) });
    if (decision === "play") void this.startPreview(id);
    return decision;
  }

  private async startPreview(id: string): Promise<void> {
    const request = ++this.previewRequest;
    const ctx = await this.runningContext();
    if (!ctx || request !== this.previewRequest) return;
    const buffer = await this.decode(id);
    if (!buffer || request !== this.previewRequest) return;

    if (this.preview) {
      this.fadeAndStop(this.preview.source, this.preview.gain, AUDIO.restartFadeMs);
    }
    const nodes = this.spawn(buffer);
    if (!nodes) return;
    const channel: Channel = { token: request, id, ...nodes };
    this.setPreview(channel);
    nodes.source.onended = () => {
      this.releaseNodes(nodes.source, nodes.gain);
      // only the voice that still owns the slot may clear it: a newer preview must not be cancelled
      if (this.preview?.token === channel.token) this.setPreview(null);
    };
  }

  stopPreview(): void {
    this.previewRequest++; // invalidates a preview that is still waiting on resume/decode
    const current = this.preview;
    if (!current) return;
    this.fadeAndStop(current.source, current.gain, AUDIO.restartFadeMs);
    this.setPreview(null);
  }

  // ---- victory jingle (own channel, master switch only) ---------------------------------------

  /** Plays the victory jingle at most once per session id. */
  playVictory(sessionId: number): void {
    const { play, remember } = decideVictory({
      lastSession: this.lastVictorySession,
      sessionId,
      sfxEnabled: getAudioSettings().sfxEnabled,
    });
    this.lastVictorySession = remember;
    if (play) void this.startVictory();
  }

  private async startVictory(): Promise<void> {
    const request = ++this.victoryRequest;
    const ctx = await this.runningContext();
    if (!ctx || request !== this.victoryRequest) return;
    // A different jingle each time keeps repeat Endless runs from sounding identical at the finish.
    const key = chooseVictorySound(VICTORY_SOUND_KEYS, Math.random);
    const buffer = await this.decode(key);
    if (!buffer || request !== this.victoryRequest) return;

    if (this.victory) this.fadeAndStop(this.victory.source, this.victory.gain, AUDIO.restartFadeMs);
    const nodes = this.spawn(buffer);
    if (!nodes) return;
    const channel: Channel = { token: request, id: key, ...nodes };
    this.victory = channel;
    nodes.source.onended = () => {
      this.releaseNodes(nodes.source, nodes.gain);
      if (this.victory?.token === channel.token) this.victory = null;
    };
  }

  stopVictory(): void {
    this.victoryRequest++;
    const current = this.victory;
    if (!current) return;
    this.victory = null;
    this.fadeAndStop(current.source, current.gain, AUDIO.restartFadeMs);
  }

  // ---- housekeeping -----------------------------------------------------------------------------

  /** Fades out every voice (tile, preview, victory). Used when the play screen unmounts. */
  stopAll(): void {
    for (const voice of this.voices.values()) this.fadeAndStop(voice.source, voice.gain, AUDIO.restartFadeMs);
    this.voices.clear();
    this.stopPreview();
    this.stopVictory();
  }

  /** Read-only snapshot for debugging and browser-driven checks. Not used by the game itself. */
  debugSnapshot() {
    return {
      state: this.ctx ? String(this.ctx.state) : "none",
      voices: [...this.voices.values()].map((v) => v.id),
      preview: this.preview?.id ?? null,
      victoryPlaying: this.victory !== null,
      decoded: [...this.buffers.keys()],
      pendingBytes: [...this.bytes.keys()],
    };
  }

  /**
   * Counts and flags only — no ids, no buffers, nothing personal. Meant to stay callable in
   * production so a real phone's unlock state can be checked without a dev build.
   */
  debugAudioState(): {
    contextExists: boolean;
    state: string;
    masterEnabled: boolean;
    registeredBytes: number;
    decodedBuffers: number;
    activeVoices: number;
  } {
    return {
      contextExists: this.ctx !== null,
      state: this.ctx ? String(this.ctx.state) : "none",
      masterEnabled: getAudioSettings().sfxEnabled,
      registeredBytes: this.bytes.size,
      decodedBuffers: this.buffers.size,
      activeVoices: this.voices.size,
    };
  }
}

export const audio = new AudioManager();

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__memeMatchAudio = audio;
}

// Deliberately available in production too (unlike the dev-only handle above): the only way to check
// a real phone's unlock state is on a real deployed build. Exposes counts/flags only; temporary, for
// verifying the mobile unlock path — safe to remove once that is confirmed stable in the field.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__memeMatchAudioDebug = () => audio.debugAudioState();
}
