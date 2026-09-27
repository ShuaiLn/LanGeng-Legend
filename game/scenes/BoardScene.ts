import Phaser from "phaser";
import { audio } from "../../lib/audio/audioManager";
import { endlessCharacterPool, getEndlessTileSettings } from "../../lib/endlessTilesStorage";
import { getProgress, recordFor } from "../../lib/progressStorage";
import { BOOM_CALLOUTS, memeCalloutFor, pickComboCallout } from "../config/callouts";
import {
  findCharacter,
  getActivePool,
  textureKeyFor,
  type CharacterConfig,
} from "../config/characters";
import {
  ANIMATION,
  DEFAULT_GRID_SIZE,
  COMBO_CALLOUT_MIN,
  ENDLESS_DURATION_SECONDS,
  SWIPE_THRESHOLD_PX,
} from "../config/gameConfig";
import { DEFAULT_DIFFICULTY } from "../config/difficulty";
import { resolveLevel, type LevelConfig } from "../config/levels";
import { THEME, THEME_CSS } from "../config/theme";
import { findValidMove, generateBoard, hasValidMove } from "../core/board";
import { inBounds, isAdjacent } from "../core/cells";
import { cancelAllCelebrations, startCelebrationListener, type CelebrationHost } from "../core/celebration";
import {
  emitGameEvent,
  GameEvents,
  onGameEvent,
  type CalloutKey,
  type CalloutKind,
  type GameEventDetailMap,
  type GameEventName,
  type PlayMode,
} from "../core/events";
import { pauseTransition, type PauseAction } from "../core/pause";
import { ensurePlayable } from "../core/playable";
import {
  attemptSwap,
  type ClearStep,
  type FallStep,
  type RefillStep,
  type ReshuffleStep,
  type ResolutionStep,
  type SpawnSpecialStep,
} from "../core/resolver";
import { pickRandom } from "../core/rng";
import { GameSession, type SessionConfig, type SessionOptions } from "../core/session";
import type { Board, CellRef, CharacterId, SpecialType, Tile } from "../core/types";
import { DOT_TEXTURE_KEY, DOT_TEXTURE_SIZE } from "./BootScene";
import { fitContain } from "./fit";
import { computeLabelLayout } from "./labelFit";
import { CORNER_RATIO } from "./shapes";

type LockReason = "animating" | "timer" | "session" | "celebration" | "paused";

interface TileView {
  uid: number;
  characterId: CharacterId;
  special: SpecialType | null;
  container: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  /** Coloured card behind a text-placeholder tile. Image tiles have none: the art is the whole tile. */
  bg: Phaser.GameObjects.Graphics | null;
  /** Direction bars / ring / sparkle over the art of a special tile. Created lazily. */
  marker: Phaser.GameObjects.Graphics | null;
}

interface Layout {
  cell: number;
  originX: number;
  originY: number;
}

interface Gesture {
  cell: CellRef;
  x: number;
  y: number;
  swiped: boolean;
}

const FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif';
/** Share of a cell that a sprite's longest side fills (about 5% padding per side). */
const ART_FILL = 0.9;
/**
 * A special tile's art fills less of the cell than a plain tile's: the striped bars / ring markers
 * are drawn OVER the art (see drawSpecial), and some characters' silhouettes reach close to their own
 * canvas edge (e.g. niulai's horns) with no built-in padding to clear the marker. Shrinking the art a
 * little whenever a tile carries a special guarantees that gap for every character, not just the ones
 * whose art happens to have empty margin baked in.
 */
const ART_FILL_SPECIAL = 0.78;
const DEPTH = { clearing: 5, selection: 10, particles: 15, fx: 20 } as const;
/** A combo clear shares this many gold sparkles across all its tiles. */
const COMBO_SPARKLE_BUDGET = 14;
const NORMAL_SPARKLES_PER_TILE = 2;

export class BoardScene extends Phaser.Scene {
  private mode: PlayMode = "endless";
  private level: LevelConfig | null = null;
  /** Side of the square board: the level's own, or the default in Endless. */
  private gridSize: number = DEFAULT_GRID_SIZE;
  private session!: GameSession;
  private board!: Board;
  private views = new Map<number, TileView>();
  private layout: Layout = { cell: 0, originX: 0, originY: 0 };

  private selection!: Phaser.GameObjects.Graphics;
  private selectedCell: CellRef | null = null;
  private gesture: Gesture | null = null;

  /** One shared flag for every reason input may be locked (animating, timer, celebration...). */
  private locks = new Set<LockReason>();
  private cleanups: (() => void)[] = [];
  private pendingResolvers = new Set<() => void>();
  private burstEmitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private pendingRelayout = false;
  private restarting = false;
  private closed = false;
  private paused = false;
  /** The last combo phrase shown, so the next one differs; reset with every session. */
  private lastComboCallout: string | null = null;

  constructor() {
    super("BoardScene");
  }

  private get inputLocked(): boolean {
    return this.locks.size > 0;
  }

  /**
   * Device pixels per CSS pixel. The canvas backing store is device-resolution (see createGame), so
   * game pixels are dpr x CSS pixels: anything defined in CSS pixels has to be scaled by this.
   */
  private get dpr(): number {
    const value = this.registry.get("dpr");
    return typeof value === "number" && value > 0 ? value : 1;
  }

  private lock(reason: LockReason): void {
    this.locks.add(reason);
    // a running animation and a pause both keep the player's selection; everything else drops it
    if (reason !== "animating" && reason !== "paused") this.clearSelection();
  }

  private unlock(reason: LockReason): void {
    this.locks.delete(reason);
  }

  // ---- lifecycle ---------------------------------------------------------

  init(): void {
    // Scene instances survive `scene.restart()`, so every field must be reset here.
    this.mode = (this.registry.get("mode") as PlayMode | undefined) ?? "endless";
    // Replay restarts this same scene, so the level (and its difficulty) simply stays in the registry.
    this.level = this.mode === "level" ? ((this.registry.get("level") as LevelConfig | null | undefined) ?? resolveLevel(1, DEFAULT_DIFFICULTY)) : null;
    this.gridSize = this.level?.gridSize ?? DEFAULT_GRID_SIZE;
    this.views = new Map();
    this.layout = { cell: 0, originX: 0, originY: 0 };
    this.selectedCell = null;
    this.gesture = null;
    this.locks = new Set();
    this.cleanups = [];
    this.pendingResolvers = new Set();
    this.burstEmitters = new Map();
    this.timerEvent = null;
    this.pendingRelayout = false;
    this.restarting = false;
    this.closed = false;
    this.paused = false;
    this.lastComboCallout = null;
  }

  create(): void {
    const customTile = (this.registry.get("customTile") as CharacterConfig | null | undefined) ?? null;
    const rng = Math.random;

    // The active pool is rolled exactly once per session and reused for every refill/reshuffle.
    // Its size is the level's own (6, 7 or 8); Endless keeps the default. Endless also draws only
    // from the player's chosen tile set (the "choose tiles" picker); Level Mode always uses the
    // whole library.
    const library = this.mode === "endless" ? endlessCharacterPool(getEndlessTileSettings()) : undefined;
    const pool = getActivePool(customTile, rng, this.level?.poolSize, library);
    const config: SessionConfig = this.level
      ? { mode: "level", level: this.level }
      : { mode: "endless", durationSeconds: ENDLESS_DURATION_SECONDS };
    const options: SessionOptions = {
      levelBest: (level) => recordFor(getProgress(), level.difficulty, level.number)?.best ?? 0,
      levelCleared: (level) => (recordFor(getProgress(), level.difficulty, level.number)?.stars ?? 0) >= 1,
    };
    this.session = new GameSession(config, pool, rng, options);
    this.board = generateBoard(this.gridSize, this.gridSize, pool, rng);

    // The board is the white CSS card (the canvas is transparent) with the tile art straight on it:
    // no wells, no cell structure. The only thing drawn under the tiles is nothing.
    this.selection = this.add.graphics().setDepth(DEPTH.selection);
    this.computeLayout();

    this.registerInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);

    this.registerBusListeners();
    this.session.start();

    if (this.mode === "endless") {
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: this.handleTimerTick,
        callbackScope: this,
      });
    }

    void this.introduceBoard();
  }

  /** Removes every listener this scene attached to the shared bus; safe to call repeatedly. */
  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;

    for (const dispose of this.cleanups.splice(0)) dispose();
    try {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    } catch {
      // the scale manager may already be gone during a full game destroy
    }
    this.timerEvent?.remove();
    this.timerEvent = null;
    // unblock anything still awaiting a tween that will never complete
    for (const resolve of [...this.pendingResolvers]) resolve();
    this.pendingResolvers.clear();
  }

  private onBus<K extends GameEventName>(type: K, handler: (detail: GameEventDetailMap[K]) => void): void {
    this.cleanups.push(
      onGameEvent(type, (detail) => {
        const sessionId = (detail as { sessionId?: number }).sessionId;
        if (sessionId !== undefined && sessionId !== this.session.sessionId) return; // stale session
        handler(detail);
      })
    );
  }

  private registerBusListeners(): void {
    // Result-screen buttons only dispatch events; the scene owns the actual restart (Replay). "Next
    // level" is a route change (a new URL, so a new game): React emits NEXT_LEVEL_REQUESTED only so the
    // victory jingle can be cut off, and the scene deliberately does not listen to it.
    this.cleanups.push(onGameEvent(GameEvents.RESTART_REQUESTED, this.handleRestart));
    // Pause is for every mode, so these sit above the level-only listeners below.
    this.cleanups.push(onGameEvent(GameEvents.PAUSE_REQUESTED, () => this.setPaused("pause")));
    this.cleanups.push(onGameEvent(GameEvents.RESUME_REQUESTED, () => this.setPaused("resume")));

    if (this.mode !== "level") return;

    const host: CelebrationHost = {
      session: this.session,
      getBoard: () => this.board,
      playSteps: (steps) => this.playSteps(steps),
    };
    this.cleanups.push(startCelebrationListener(() => host));

    this.onBus(GameEvents.CELEBRATION_LOCK_INPUT, () => this.lock("celebration"));
    this.onBus(GameEvents.CELEBRATION_LEVEL_CLEAR, () => this.cameras.main.shake(200, 0.005));
    this.onBus(GameEvents.CELEBRATION_CONVERT, (d) => this.popConvertedTile(d.uid, d.special));
    this.onBus(GameEvents.CELEBRATION_DETONATE, (d) => {
      const { x, y } = this.cellCenter(d.cell.row, d.cell.col);
      this.emitCallout("boom", pickRandom(BOOM_CALLOUTS, this.session.rng), x, y);
    });
    this.onBus(GameEvents.CELEBRATION_STAR, () => this.starBurst());
  }

  private handleRestart = (): void => {
    if (this.restarting || this.closed) return;
    this.restarting = true;
    cancelAllCelebrations();
    this.scene.restart();
  };

  /**
   * Freezes or resumes the whole game. `scene.pause()` stops this scene's UPDATE, which is what
   * drives tweens, the Endless clock and particles, so a resume continues the very same animation
   * from the very same frame; nothing is reset (same session, board, score, moves, time, selection).
   * The last frame stays on screen (paused scenes still render). The celebration sequencer runs on
   * wall-clock timers this cannot stop, which is why React never offers Pause once a level is won.
   */
  private setPaused(action: PauseAction): void {
    const { paused, changed } = pauseTransition(
      { paused: this.paused, status: this.session.status, inert: this.closed || this.restarting },
      action
    );
    if (!changed) return;
    this.paused = paused;
    if (paused) {
      this.gesture = null; // a half-finished swipe must not complete after the resume
      this.lock("paused");
      this.scene.pause();
    } else {
      this.unlock("paused");
      this.scene.resume();
    }
    emitGameEvent(GameEvents.PAUSE_CHANGED, { sessionId: this.session.sessionId, paused });
  }

  // ---- layout & drawing ----------------------------------------------------

  private computeLayout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    // a slim margin: the tile art already leaves ~5% of its cell empty on every side
    const padding = Math.max(4 * this.dpr, Math.floor(Math.min(width, height) * 0.015));
    const cell = Math.floor(Math.min((width - padding * 2) / this.gridSize, (height - padding * 2) / this.gridSize));
    this.layout = {
      cell: Math.max(cell, 0),
      originX: Math.floor((width - cell * this.gridSize) / 2),
      originY: Math.floor((height - cell * this.gridSize) / 2),
    };
  }

  private cellCenter(row: number, col: number): { x: number; y: number } {
    const { cell, originX, originY } = this.layout;
    return { x: originX + col * cell + cell / 2, y: originY + row * cell + cell / 2 };
  }

  private characterFor(id: CharacterId): CharacterConfig | undefined {
    return findCharacter(this.session.activePool, id);
  }

  private createView(tile: Tile, x: number, y: number): TileView {
    const character = this.characterFor(tile.characterId);
    const textureKey = textureKeyFor(tile.characterId);
    const useImage = Boolean(character?.assets.normal) && this.textures.exists(textureKey);

    const art: TileView["art"] = useImage
      ? this.add.image(0, 0, textureKey)
      : this.add
          .text(0, 0, character?.label ?? tile.characterId, {
            fontFamily: FONT_FAMILY,
            fontStyle: "bold",
            color: THEME_CSS.white,
            align: "center",
          })
          .setOrigin(0.5);

    // An image tile is the art and nothing else: no card, no plate, no well. Only the text fallback
    // (art missing) gets a coloured card.
    const bg = useImage ? null : this.add.graphics();
    const container = this.add.container(x, y, bg ? [bg, art] : [art]);
    const view: TileView = {
      uid: tile.uid,
      characterId: tile.characterId,
      special: tile.special,
      container,
      art,
      bg,
      marker: null,
    };
    this.views.set(tile.uid, view);
    this.drawView(view);
    return view;
  }

  private drawView(view: TileView): void {
    const { cell } = this.layout;
    if (cell < 4) return;
    const size = cell * 0.92;

    if (view.art instanceof Phaser.GameObjects.Image) {
      // Contain-fit inside the cell: aspect ratio always preserved, centred, never cropped.
      const box = cell * (view.special ? ART_FILL_SPECIAL : ART_FILL);
      const fit = fitContain(view.art.width, view.art.height, box, box);
      view.art.setDisplaySize(fit.width, fit.height);
    } else {
      const character = this.characterFor(view.characterId);
      this.drawTextCard(view, size);
      const layout = computeLabelLayout(character?.label ?? view.characterId, cell);
      view.art.setText(layout.text);
      view.art.setFontSize(layout.fontSize);
      view.art.setLineSpacing(Math.round(layout.fontSize * 0.05));
      view.art.setStroke(THEME_CSS.text, Math.max(2, Math.round(layout.fontSize * 0.16)));
      view.art.setWordWrapWidth(size * 0.94);
    }

    this.drawSpecial(view, size);
    view.container.setSize(size, size);
  }

  /** The coloured card behind a text-placeholder tile; `color` overrides it for the clear flash. */
  private drawTextCard(view: TileView, size: number, color?: number): void {
    const bg = view.bg;
    if (!bg) return;
    const half = size / 2;
    const radius = size * CORNER_RATIO;
    bg.clear();
    bg.fillStyle(THEME.text, 0.16);
    bg.fillRoundedRect(-half + 1, -half + size * 0.05, size, size, radius);
    bg.fillStyle(color ?? this.characterFor(view.characterId)?.color ?? 0x666666, 1);
    bg.fillRoundedRect(-half, -half, size, size, radius);
    bg.fillStyle(0xffffff, 0.16);
    bg.fillRoundedRect(-half, -half, size, size * 0.42, { tl: radius, tr: radius, bl: 0, br: 0 });
  }

  /** Lazily creates the special-tile marker layer: plain tiles carry none, which keeps the board cheap. */
  private specialLayer(view: TileView): Phaser.GameObjects.Graphics {
    if (view.marker) return view.marker;
    const graphics = this.add.graphics();
    view.container.add(graphics); // over the art
    view.marker = graphics;
    return graphics;
  }

  /**
   * Special tiles are the art plus markers over it: sky-blue bars / ring / sparkle with a white
   * outline so they read on any sprite. Never a plate or background behind the art, and never gold:
   * gold is reserved for combos.
   */
  private drawSpecial(view: TileView, size: number): void {
    if (!view.special) return;
    const half = size / 2;

    const g = this.specialLayer(view);
    g.clear();
    const t = Math.max(3, size * 0.085); // marker thickness
    const edge = Math.max(3, size * 0.05); // inset from the tile edge
    const outline = Math.max(1.5, size * 0.025);
    const bar = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(x - outline, y - outline, w + outline * 2, h + outline * 2);
      g.fillStyle(THEME.primary, 1);
      g.fillRect(x, y, w, h);
    };
    const dot = (cx: number, cy: number, r: number) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(cx, cy, r + outline);
      g.fillStyle(THEME.primary, 1);
      g.fillCircle(cx, cy, r);
    };

    switch (view.special) {
      case "striped-row": {
        const len = size * 0.74;
        bar(-len / 2, -half + edge, len, t);
        bar(-len / 2, half - edge - t, len, t);
        break;
      }
      case "striped-col": {
        const len = size * 0.74;
        bar(-half + edge, -len / 2, t, len);
        bar(half - edge - t, -len / 2, t, len);
        break;
      }
      case "wrapped": {
        const inset = edge + t / 2;
        g.lineStyle(t + outline * 2, 0xffffff, 1);
        g.strokeRoundedRect(-half + inset, -half + inset, size - inset * 2, size - inset * 2, size * 0.16);
        g.lineStyle(t, THEME.primary, 1);
        g.strokeRoundedRect(-half + inset, -half + inset, size - inset * 2, size - inset * 2, size * 0.16);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) dot(sx * (half - inset), sy * (half - inset), t * 0.75);
        break;
      }
      case "super": {
        const inset = edge + t / 2;
        g.lineStyle(t * 1.3 + outline * 2, 0xffffff, 1);
        g.strokeRoundedRect(-half + inset, -half + inset, size - inset * 2, size - inset * 2, size * 0.16);
        g.lineStyle(t * 1.3, THEME.primary, 1);
        g.strokeRoundedRect(-half + inset, -half + inset, size - inset * 2, size - inset * 2, size * 0.16);
        // a four-point sparkle marks it as the super tile
        const cx = half - size * 0.2;
        const cy = -half + size * 0.2;
        const outer = size * 0.19;
        const inner = outer * 0.38;
        const points: Phaser.Math.Vector2[] = [];
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? outer : inner;
          const a = (Math.PI / 4) * i - Math.PI / 2;
          points.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
        }
        g.fillStyle(0xffffff, 1);
        g.fillPoints(points, true);
        g.lineStyle(outline * 1.4, THEME.primary, 1);
        g.strokePoints(points, true);
        break;
      }
      default:
        break;
    }
  }

  private relayout(): void {
    this.pendingRelayout = false;
    this.computeLayout();
    for (let row = 0; row < this.board.length; row++) {
      for (let col = 0; col < this.board[row].length; col++) {
        const tile = this.board[row][col];
        const view = tile ? this.views.get(tile.uid) : undefined;
        if (!view) continue;
        const { x, y } = this.cellCenter(row, col);
        view.container.setPosition(x, y);
        this.drawView(view);
      }
    }
    this.drawSelection();
  }

  private handleResize = (): void => {
    if (this.closed) return;
    // Mid-animation tweens target pixel positions computed with the old layout; re-snap when idle.
    if (this.locks.has("animating")) {
      this.pendingRelayout = true;
      this.computeLayout();
    } else {
      this.relayout();
    }
  };

  private drawSelection(): void {
    this.selection.clear();
    if (!this.selectedCell || this.layout.cell < 4) return;
    const { x, y } = this.cellCenter(this.selectedCell.row, this.selectedCell.col);
    const size = this.layout.cell * 0.96;
    const left = x - size / 2;
    const top = y - size / 2;
    // an outline ring only: a fill would read as a coloured square behind the tile
    this.selection.lineStyle(Math.max(3, this.layout.cell * 0.06), THEME.primary, 1);
    this.selection.strokeRoundedRect(left, top, size, size, size * CORNER_RATIO);
  }

  private select(cell: CellRef): void {
    this.selectedCell = cell;
    this.drawSelection();
  }

  private clearSelection(): void {
    this.selectedCell = null;
    this.selection?.clear();
  }

  // ---- input ---------------------------------------------------------------

  private registerInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.gesture = null;
    });
  }

  private pointToCell(x: number, y: number): CellRef | null {
    const { cell, originX, originY } = this.layout;
    if (cell <= 0) return null;
    const col = Math.floor((x - originX) / cell);
    const row = Math.floor((y - originY) / cell);
    const ref = { row, col };
    return inBounds(this.board, ref) ? ref : null;
  }

  /**
   * Pointer position in game pixels, taken from the live canvas rect. Phaser caches the canvas
   * bounds, and those can be wrong for a moment after boot (or after a layout shift), which
   * would map a swipe onto the wrong cell.
   */
  private pointerToGame(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const native = pointer.event as MouseEvent | TouchEvent | undefined;
    let clientX: number | undefined;
    let clientY: number | undefined;
    if (native && "clientX" in native) {
      clientX = native.clientX;
      clientY = native.clientY;
    } else if (native && "changedTouches" in native && native.changedTouches.length > 0) {
      clientX = native.changedTouches[0].clientX;
      clientY = native.changedTouches[0].clientY;
    }

    const rect = this.game.canvas?.getBoundingClientRect();
    if (clientX === undefined || clientY === undefined || !rect || rect.width === 0 || rect.height === 0) {
      return { x: pointer.x, y: pointer.y };
    }
    return {
      x: (clientX - rect.left) * (this.scale.width / rect.width),
      y: (clientY - rect.top) * (this.scale.height / rect.height),
    };
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    // Every physical touch on the board is another chance to unlock mobile audio: iOS/WeChat can
    // drop the context back to suspended after the opening cover's tap, and this guarantees a source
    // is started inside THIS gesture before any tile logic (and thus any playClear) can run.
    audio.unlockFromGesture();
    if (this.inputLocked) return;
    const { x, y } = this.pointerToGame(pointer);
    const cell = this.pointToCell(x, y);
    this.gesture = cell ? { cell, x, y, swiped: false } : null;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    if (!gesture || gesture.swiped || !pointer.isDown) return;
    const here = this.pointerToGame(pointer);
    const dx = here.x - gesture.x;
    const dy = here.y - gesture.y;
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD_PX * this.dpr) return;

    // Past the threshold it is a swipe: the dominant axis picks the direction.
    gesture.swiped = true;
    const target: CellRef =
      Math.abs(dx) > Math.abs(dy)
        ? { row: gesture.cell.row, col: gesture.cell.col + (dx > 0 ? 1 : -1) }
        : { row: gesture.cell.row + (dy > 0 ? 1 : -1), col: gesture.cell.col };
    this.clearSelection();
    void this.trySwap(gesture.cell, target);
  }

  private handlePointerUp(): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (!gesture || gesture.swiped || this.inputLocked) return;

    // A short movement is a tap: select, then tap an adjacent tile to swap.
    const tapped = gesture.cell;
    const selected = this.selectedCell;
    if (!selected) {
      this.select(tapped);
    } else if (selected.row === tapped.row && selected.col === tapped.col) {
      this.clearSelection();
    } else if (isAdjacent(selected, tapped)) {
      this.clearSelection();
      void this.trySwap(selected, tapped);
    } else {
      this.select(tapped);
    }
  }

  // ---- moves ---------------------------------------------------------------

  private async trySwap(from: CellRef, to: CellRef): Promise<void> {
    if (this.inputLocked || !inBounds(this.board, to)) return;
    const tileA = this.board[from.row][from.col];
    const tileB = this.board[to.row][to.col];
    if (!tileA || !tileB) return;
    const viewA = this.views.get(tileA.uid);
    const viewB = this.views.get(tileB.uid);
    if (!viewA || !viewB) return;

    this.lock("animating");
    // Pure logic resolves instantly; the animation below just replays it.
    const result = attemptSwap(this.board, from, to, this.session.activePool, this.session.rng);
    try {
      await this.slide(viewA, to, viewB, from);
      if (this.closed) return;

      if (!result.valid) {
        await this.slide(viewA, from, viewB, to); // snap back; costs no move
        return;
      }

      this.session.consumeMove(); // only swaps that actually clear something spend a move
      await this.playSteps(result.steps);
      this.session.resetCombo();
    } finally {
      if (!this.closed) {
        if (this.pendingRelayout) this.relayout();
        await this.settle(); // still under the "animating" lock, so a safety-net reshuffle cannot be interrupted
        if (!this.closed) this.unlock("animating");
      }
    }
  }

  /**
   * After a fully settled loop (or an idle timer expiry): decide whether the session goes on, and if
   * it does, make sure there is still a move to make. The resolver already repairs a dead board it
   * creates; this second look is the safety net for anything it does not know about (a future
   * mechanic, a bug), so no code path can leave the player on a board with no moves.
   */
  private async settle(): Promise<void> {
    if (this.session.evaluateSettled() !== "continue") {
      this.lock("session");
      return;
    }
    if (this.closed || hasValidMove(this.board)) return;
    const { method } = ensurePlayable(this.board, this.session.activePool, this.session.rng);
    if (method === "none") return;
    await this.playReshuffle({ type: "reshuffle", board: this.board.map((line) => line.map((tile) => (tile ? { ...tile } : null))), method });
  }

  private handleTimerTick(): void {
    if (this.closed || this.paused) return;
    if (this.session.tickSecond() > 0) return;

    // Time is up: refuse new swaps immediately, but let any in-flight cascade finish first.
    this.timerEvent?.remove();
    this.timerEvent = null;
    this.lock("timer");
    if (!this.locks.has("animating")) void this.settle();
    // otherwise trySwap's `finally` calls settle() once playback has completed
  }

  // ---- animation ---------------------------------------------------------------

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      if (this.closed) {
        resolve();
        return;
      }
      const done = () => {
        this.pendingResolvers.delete(done);
        resolve();
      };
      this.pendingResolvers.add(done);
      this.tweens.add({ ...config, onComplete: done });
    });
  }

  private async slide(a: TileView, toA: CellRef, b: TileView, toB: CellRef): Promise<void> {
    const pa = this.cellCenter(toA.row, toA.col);
    const pb = this.cellCenter(toB.row, toB.col);
    await Promise.all([
      this.tween({ targets: a.container, x: pa.x, y: pa.y, duration: ANIMATION.swap, ease: "Quad.easeInOut" }),
      this.tween({ targets: b.container, x: pb.x, y: pb.y, duration: ANIMATION.swap, ease: "Quad.easeInOut" }),
    ]);
  }

  private async introduceBoard(): Promise<void> {
    this.lock("animating");
    const tweens: Promise<void>[] = [];
    for (let row = 0; row < this.board.length; row++) {
      for (let col = 0; col < this.board[row].length; col++) {
        const tile = this.board[row][col]!;
        const { x, y } = this.cellCenter(row, col);
        const view = this.createView(tile, x, y);
        view.container.setScale(0.4).setAlpha(0);
        tweens.push(
          this.tween({
            targets: view.container,
            scale: 1,
            alpha: 1,
            duration: ANIMATION.boardIntro,
            delay: (row + col) * 18,
            ease: "Back.easeOut",
          })
        );
      }
    }
    await Promise.all(tweens);
    if (this.closed) return;
    this.unlock("animating");
  }

  /** Plays resolver steps as animation. Scores land as each clear plays, so the HUD ticks live. */
  private async playSteps(steps: ResolutionStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      if (this.closed) return;
      const step = steps[i];
      switch (step.type) {
        case "clear":
          await this.playClear(step);
          break;
        case "spawnSpecial":
          await this.playSpawnSpecial(step);
          break;
        case "fall": {
          const next = steps[i + 1];
          if (next?.type === "refill") {
            await Promise.all([this.playFall(step), this.playRefill(next)]);
            i++;
          } else {
            await this.playFall(step);
          }
          break;
        }
        case "refill":
          await this.playRefill(step);
          break;
        case "reshuffle":
          await this.playReshuffle(step);
          break;
      }
    }
    if (!this.closed) this.relayout();
  }

  private async playClear(step: ClearStep): Promise<void> {
    // scores, extends the chain and counts collected tiles: one call, one goal-progress event
    this.session.applyStep(step);

    // The pass a swap triggers is a normal clear (red); every chained pass is a combo (gold).
    // Bonus detonations at level clear follow the same rule.
    const isCombo = step.comboIndex >= 1;

    // One call per elimination event: the audio layer picks at most 3 characters, never one per tile.
    audio.playClear(step.cleared);

    let sumX = 0;
    let sumY = 0;
    let sparkleBudget = COMBO_SPARKLE_BUDGET;
    const sparklesPerTile = Math.max(1, Math.floor(COMBO_SPARKLE_BUDGET / Math.max(step.cleared.length, 1)));
    const tweens: Promise<void>[] = [];
    for (const cleared of step.cleared) {
      const view = this.views.get(cleared.uid);
      const { x, y } = this.cellCenter(cleared.cell.row, cleared.cell.col);
      sumX += x;
      sumY += y;
      if (!view) continue;
      this.views.delete(cleared.uid);

      if (isCombo) {
        const count = Math.min(sparklesPerTile, sparkleBudget);
        if (count > 0) this.burst(x, y, THEME.gold, count);
        sparkleBudget -= count;
      } else {
        this.burst(x, y, THEME.redSoft, NORMAL_SPARKLES_PER_TILE);
      }
      tweens.push(this.playTileClear(view, isCombo));
    }

    for (const special of step.activated) this.playSpecialEffect(special.special, special.cell);

    const count = Math.max(step.cleared.length, 1);
    this.emitCallout("score", `+${step.scoreDelta}`, sumX / count, sumY / count);
    const kind = step.kinds.includes("line5")
      ? "line5"
      : step.kinds.includes("lt-shape")
        ? "lt-shape"
        : step.kinds.includes("line4")
          ? "line4"
          : null;
    const meme = kind ? memeCalloutFor(kind, this.session.rng) : null;
    if (meme) this.emitCallout("meme", meme);
    if (step.comboIndex + 1 >= COMBO_CALLOUT_MIN) {
      // a meme phrase, not a count (the HUD's Combo box has the count); `n` only scales the pop
      this.lastComboCallout = pickComboCallout(this.session.rng, this.lastComboCallout);
      this.emitCallout("combo", this.lastComboCallout, undefined, undefined, { n: step.comboIndex + 1 });
    }

    await Promise.all(tweens);
  }

  /**
   * One tile's elimination: a flat-colour silhouette flash (red, or gold for a combo) that follows
   * the sprite's own transparency, a quick pop, then the shrink-away. The texture itself is never
   * modified, and a combo adds a gold silhouette "glow" behind the art (no filters or shaders).
   */
  private playTileClear(view: TileView, isCombo: boolean): Promise<void> {
    const color = isCombo ? THEME.gold : THEME.red;
    const total = isCombo ? ANIMATION.clearCombo : ANIMATION.clearNormal;
    const flashMs = ANIMATION.clearFlash;
    const peak = isCombo ? 1.22 : 1.14;
    const container = view.container;
    container.setDepth(DEPTH.clearing); // pop above the neighbours

    if (view.art instanceof Phaser.GameObjects.Image) {
      const key = view.art.texture.key;
      const { displayWidth, displayHeight } = view.art;

      const flash = this.add
        .image(0, 0, key)
        .setDisplaySize(displayWidth, displayHeight)
        .setTint(color)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(0);
      container.add(flash);
      // leaves ~15% of the art visible underneath so its detail is not lost
      void this.tween({ targets: flash, alpha: 0.85, duration: flashMs, ease: "Quad.easeOut" });

      if (isCombo) {
        const glow = this.add
          .image(0, 0, key)
          .setDisplaySize(displayWidth * 1.15, displayHeight * 1.15)
          .setTint(THEME.gold)
          .setTintMode(Phaser.TintModes.FILL)
          .setAlpha(0.5);
        container.addAt(glow, 0);
      }
    } else {
      // text-placeholder fallback: recolour the card for the flash
      this.drawTextCard(view, this.layout.cell * 0.92, color);
    }

    return this.tween({ targets: container, scale: peak, duration: flashMs, ease: "Quad.easeOut" })
      .then(() =>
        this.tween({
          targets: container,
          scale: 0.1,
          alpha: 0,
          angle: Phaser.Math.Between(-40, 40),
          duration: Math.max(total - flashMs, 60),
          ease: "Quad.easeIn",
        })
      )
      .then(() => {
        if (!this.closed) container.destroy();
      });
  }

  private playSpecialEffect(special: SpecialType, cell: CellRef): void {
    const { cell: size, originX, originY } = this.layout;
    const { x, y } = this.cellCenter(cell.row, cell.col);
    const boardW = size * this.gridSize;
    const boardH = boardW;
    let shape: Phaser.GameObjects.Shape;
    let props: Phaser.Types.Tweens.TweenBuilderConfig;

    // Sky blue, not white or gold: white vanishes on the light board and gold is for combos.
    switch (special) {
      case "striped-row":
        shape = this.add.rectangle(originX + boardW / 2, y, boardW, size * 0.9, THEME.primary, 0.5);
        props = { targets: shape, alpha: 0, scaleY: 0.15, duration: 320, ease: "Quad.easeOut" };
        break;
      case "striped-col":
        shape = this.add.rectangle(x, originY + boardH / 2, size * 0.9, boardH, THEME.primary, 0.5);
        props = { targets: shape, alpha: 0, scaleX: 0.15, duration: 320, ease: "Quad.easeOut" };
        break;
      case "wrapped":
        shape = this.add.circle(x, y, size * 0.7, THEME.primary, 0.5);
        props = { targets: shape, alpha: 0, scale: 3, duration: 340, ease: "Quad.easeOut" };
        break;
      default:
        shape = this.add.rectangle(originX + boardW / 2, originY + boardH / 2, boardW, boardH, THEME.skySoft, 0.7);
        props = { targets: shape, alpha: 0, duration: 420, ease: "Quad.easeOut" };
        break;
    }
    shape.setDepth(DEPTH.fx);
    void this.tween(props).then(() => shape.destroy());
  }


  private async playSpawnSpecial(step: SpawnSpecialStep): Promise<void> {
    this.session.applyStep(step); // counts toward "make specials" goals
    const view = this.views.get(step.uid);
    if (!view) return;
    view.special = step.special;
    this.drawView(view);
    view.container.setScale(1.55);
    await this.tween({ targets: view.container, scale: 1, duration: ANIMATION.specialPop, ease: "Back.easeOut" });
  }

  private durationFor(rows: number): number {
    return ANIMATION.fallBase + ANIMATION.fallPerRow * rows;
  }

  private async playFall(step: FallStep): Promise<void> {
    await Promise.all(
      step.moves.map((move) => {
        const view = this.views.get(move.uid);
        if (!view) return Promise.resolve();
        const { x, y } = this.cellCenter(move.to.row, move.to.col);
        return this.tween({
          targets: view.container,
          x,
          y,
          duration: this.durationFor(move.to.row - move.from.row),
          ease: "Quad.easeIn",
        });
      })
    );
  }

  private async playRefill(step: RefillStep): Promise<void> {
    await Promise.all(
      step.spawns.map((spawn) => {
        const start = this.cellCenter(spawn.startRow, spawn.cell.col);
        const end = this.cellCenter(spawn.cell.row, spawn.cell.col);
        const view = this.createView(spawn.tile, start.x, start.y);
        return this.tween({
          targets: view.container,
          x: end.x,
          y: end.y,
          duration: this.durationFor(spawn.cell.row - spawn.startRow),
          ease: "Quad.easeIn",
        });
      })
    );
  }

  private async playReshuffle(step: ReshuffleStep): Promise<void> {
    const { x, y } = this.cellCenter(this.gridSize / 2 - 0.5, this.gridSize / 2 - 0.5);
    // English is only the fallback text: the React layer renders the translated `system.reshuffle`
    this.emitCallout("system", "No moves left — reshuffling!", x, y, { key: "system.reshuffle" });

    await Promise.all(
      [...this.views.values()].map((view) =>
        this.tween({ targets: view.container, alpha: 0, duration: ANIMATION.reshuffleFade })
      )
    );
    for (const view of this.views.values()) view.container.destroy();
    this.views.clear();

    const fades: Promise<void>[] = [];
    step.board.forEach((line, row) =>
      line.forEach((tile, col) => {
        if (!tile) return;
        const at = this.cellCenter(row, col);
        const view = this.createView(tile, at.x, at.y);
        view.container.setAlpha(0);
        fades.push(this.tween({ targets: view.container, alpha: 1, duration: ANIMATION.reshuffleFade }));
      })
    );
    await Promise.all(fades);
  }

  // ---- celebration beats & effects -------------------------------------------------

  private popConvertedTile(uid: number, special: SpecialType): void {
    const view = this.views.get(uid);
    if (!view) return;
    view.special = special;
    this.drawView(view);
    view.container.setScale(1.6);
    void this.tween({ targets: view.container, scale: 1, duration: 260, ease: "Back.easeOut" });
  }

  private starBurst(): void {
    const { cell, originX, originY } = this.layout;
    const x = originX + (cell * this.gridSize) / 2;
    const y = originY + (cell * this.gridSize) / 2;
    this.burst(x, y, THEME.gold, 26);
    this.cameras.main.shake(110, 0.003);
  }

  /** One lazily created emitter per colour; explodes a handful of dots at a point. */
  private burst(x: number, y: number, color: number, count: number): void {
    let emitter = this.burstEmitters.get(color);
    if (!emitter) {
      const dpr = this.dpr; // speeds and sizes are authored in CSS pixels
      emitter = this.add.particles(0, 0, DOT_TEXTURE_KEY, {
        speed: { min: 70 * dpr, max: 240 * dpr },
        lifespan: { min: 260, max: 560 },
        scale: { start: (0.9 * dpr * 8) / DOT_TEXTURE_SIZE, end: 0 }, // 0.9 x an 8px dot, in CSS pixels
        alpha: { start: 1, end: 0 },
        gravityY: 320 * dpr,
        tint: color,
        emitting: false,
      });
      emitter.setDepth(DEPTH.particles);
      this.burstEmitters.set(color, emitter);
    }
    emitter.explode(count, x, y);
  }

  /** `x`/`y` are game pixels; the React callout layer positions in CSS pixels, hence the division. */
  private emitCallout(
    kind: CalloutKind,
    text: string,
    x?: number,
    y?: number,
    extra?: { key?: CalloutKey; n?: number }
  ): void {
    const dpr = this.dpr;
    emitGameEvent(GameEvents.CALLOUT, {
      sessionId: this.session.sessionId,
      kind,
      text,
      ...extra,
      x: x === undefined ? undefined : x / dpr,
      y: y === undefined ? undefined : y / dpr,
    });
  }

  // ---- dev / e2e helpers -------------------------------------------------------------

  /** Read-only snapshot for debugging and browser-driven checks. Not used by the game itself. */
  debugSnapshot() {
    return {
      mode: this.mode,
      sessionId: this.session.sessionId,
      score: this.session.score,
      status: this.session.status,
      paused: this.paused,
      level: this.level?.id ?? null,
      goals: this.session.goalViews(),
      timeRemaining: this.session.timeRemaining,
      movesRemaining: this.session.movesRemaining,
      poolIds: this.session.activePool.map((c) => c.id),
      imageViewCount: [...this.views.values()].filter((v) => v.art instanceof Phaser.GameObjects.Image).length,
      layout: this.layout,
      locked: [...this.locks],
      ids: this.board.map((row) => row.map((tile) => tile?.characterId ?? null)),
      specials: this.board.map((row) => row.map((tile) => tile?.special ?? null)),
      validMove: findValidMove(this.board),
      viewCount: this.views.size,
    };
  }
}
