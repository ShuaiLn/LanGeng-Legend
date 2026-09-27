/**
 * Pure sound rules: which characters get to play, whether a tile may play at all, and which
 * voices to drop when too many overlap. No Web Audio in here, so it is all unit-testable.
 */
import { isTileEnabled, type AudioSettings } from "../audioSettingsStorage";

/** Anything with a character id: a resolver `ClearedTile` satisfies this. */
export interface HasCharacter {
  characterId: string;
}

/**
 * Once per elimination event, never per tile: groups the cleared tiles by character, ranks the
 * groups by tile count (ties: whichever character was cleared first) and keeps the top `max`.
 */
export function pickClearSounds(cleared: readonly HasCharacter[], max: number): string[] {
  const groups = new Map<string, { count: number; first: number }>();
  cleared.forEach((tile, index) => {
    const group = groups.get(tile.characterId);
    if (group) group.count++;
    else groups.set(tile.characterId, { count: 1, first: index });
  });
  return [...groups.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.first - b.first)
    .slice(0, Math.max(0, max))
    .map(([id]) => id);
}

export type PlaybackDecision = "play" | "muted-master" | "muted-tile" | "no-sound";

/** Why a tile's sound would or would not play right now. A tile with no sound is just "no-sound". */
export function resolvePlayback(args: { settings: AudioSettings; id: string; hasSound: boolean }): PlaybackDecision {
  if (!args.hasSound) return "no-sound";
  if (!args.settings.sfxEnabled) return "muted-master";
  if (!isTileEnabled(args.settings, args.id)) return "muted-tile";
  return "play";
}

/**
 * The characters that actually make a sound for one clear event. The top-N selection happens
 * FIRST and disabled tiles are dropped afterwards, so muting LaoDa silences LaoDa's clears rather
 * than promoting some other tile's sound in its place.
 */
export function selectClearPlays(
  cleared: readonly HasCharacter[],
  settings: AudioSettings,
  hasSound: (id: string) => boolean,
  maxPerClear: number
): string[] {
  return pickClearSounds(cleared, maxPerClear).filter(
    (id) => resolvePlayback({ settings, id, hasSound: hasSound(id) }) === "play"
  );
}

export interface ActiveVoice {
  id: string;
  /** Unique per started voice; how the manager finds it again. */
  token: number;
  startedAt: number;
}

/**
 * Which running voices must be faded out so `incoming` can start: the same character is restarted
 * (never two copies of one clip), and when the cap would be exceeded the OLDEST voices go, so the
 * newest `maxVoices` always win. Returns tokens, oldest first.
 */
export function planVoiceEviction(
  active: readonly ActiveVoice[],
  incoming: { id: string },
  maxVoices: number
): number[] {
  const evict: number[] = [];
  const kept: ActiveVoice[] = [];
  for (const voice of active) {
    if (voice.id === incoming.id) evict.push(voice.token);
    else kept.push(voice);
  }
  kept.sort((a, b) => a.startedAt - b.startedAt || a.token - b.token);
  // the incoming voice takes one of the `maxVoices` slots
  const overflow = kept.length + 1 - Math.max(1, maxVoices);
  for (let i = 0; i < overflow; i++) evict.push(kept[i].token);
  return evict;
}

/**
 * The victory jingle plays at most once per session, and only when sound effects are on. The
 * session is remembered EVEN WHEN muted, so switching sound on later can never replay an old
 * victory. Pure: the manager keeps the `lastSession` state, this only decides.
 */
export function decideVictory(args: { lastSession: number | null; sessionId: number; sfxEnabled: boolean }): {
  play: boolean;
  remember: number;
} {
  if (args.lastSession === args.sessionId) return { play: false, remember: args.lastSession };
  return { play: args.sfxEnabled, remember: args.sessionId };
}

/** The same character asked to start again within `minMs` of its last start is ignored. */
export function isRetrigger(lastStartedAt: number | undefined, now: number, minMs: number): boolean {
  return lastStartedAt !== undefined && now - lastStartedAt < minMs;
}

/**
 * Which victory jingle to play: uniformly random among `keys` (`rng` is injected, like everywhere
 * else here, so a seeded test can pin the pick). Falls back to the first key for degenerate input.
 */
export function chooseVictorySound(keys: readonly string[], rng: () => number): string {
  if (keys.length <= 1) return keys[0] ?? "";
  const index = Math.min(keys.length - 1, Math.floor(rng() * keys.length));
  return keys[index];
}
