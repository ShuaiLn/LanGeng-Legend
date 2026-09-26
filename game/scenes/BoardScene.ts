import Phaser from "phaser";
import { BOOM_CALLOUTS, comboCalloutText, memeCalloutFor } from "../config/callouts";
import {
  findCharacter,
  getActivePool,
  textureKeyFor,
  type CharacterConfig,
} from "../config/characters";
import {
  ANIMATION,
  BOARD_COLS,
  BOARD_ROWS,
  COMBO_CALLOUT_MIN,
  ENDLESS_DURATION_SECONDS,
  SWIPE_THRESHOLD_PX,
} from "../config/gameConfig";
import { DEMO_LEVEL } from "../config/levels";
import { findValidMove, generateBoard } from "../core/board";
import { inBounds, isAdjacent } from "../core/cells";
import { cancelAllCelebrations, startCelebrationListener, type CelebrationHost } from "../core/celebration";
import {
  emitGameEvent,
  GameEvents,
  onGameEvent,
  type CalloutKind,
  type GameEventDetailMap,
  type GameEventName,
  type PlayMode,
} from "../core/events";
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
import { GameSession, type SessionConfig } from "../core/session";
import type { Board, CellRef, CharacterId, SpecialType, Tile } from "../core/types";
import { DOT_TEXTURE_KEY } from "./BootScene";
import { computeLabelLayout } from "./labelFit";

type LockReason = "animating" | "timer" | "session" | "celebration";

interface TileView {
  uid: number;
  characterId: CharacterId;
  special: SpecialType | null;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  overlay: Phaser.GameObjects.Graphics;
  art: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
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
const IMAGE_TILE_COLOR = 0x1f2937;
const DEPTH = { selection: 10, particles: 15, fx: 20 } as const;

export class BoardScene extends Phaser.Scene {
  private mode: PlayMode = "endless";
  private session!: GameSession;
  private board!: Board;
  private views = new Map<number, TileView>();
  private layout: Layout = { cell: 0, originX: 0, originY: 0 };

  private backdrop!: Phaser.GameObjects.Graphics;
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

  constructor() {
    super("BoardScene");
  }

  private get inputLocked(): boolean {
    return this.locks.size > 0;
  }

  private lock(reason: LockReason): void {
    this.locks.add(reason);
    if (reason !== "animating") this.clearSelection();
  }

  private unlock(reason: LockReason): void {
    this.locks.delete(reason);
  }

  // ---- lifecycle ---------------------------------------------------------

  init(): void {
    // Scene instances survive `scene.restart()`, so every field must be reset here.
    this.mode = (this.registry.get("mode") as PlayMode | undefined) ?? "endless";
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
  }

  create(): void {
    const customTile = (this.registry.get("customTile") as CharacterConfig | null | undefined) ?? null;
    const rng = Math.random;

    // The active pool is rolled exactly once per session and reused for every refill/reshuffle.
    const pool = getActivePool(customTile, rng);
    const config: SessionConfig =
      this.mode === "level"
        ? { mode: "level", level: DEMO_LEVEL }
        : { mode: "endless", durationSeconds: ENDLESS_DURATION_SECONDS };
    this.session = new GameSession(config, pool, rng);
    this.board = generateBoard(BOARD_ROWS, BOARD_COLS, pool, rng);

    this.backdrop = this.add.graphics();
    this.selection = this.add.graphics().setDepth(DEPTH.selection);
    this.computeLayout();
    this.drawBackdrop();

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
    // Result-screen buttons only dispatch events; the scene owns the actual restart.
    this.cleanups.push(onGameEvent(GameEvents.RESTART_REQUESTED, this.handleRestart));
    this.cleanups.push(onGameEvent(GameEvents.NEXT_LEVEL_REQUESTED, this.handleRestart));

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

  // ---- layout & drawing ----------------------------------------------------

  private computeLayout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const padding = Math.max(6, Math.floor(Math.min(width, height) * 0.025));
    const cell = Math.floor(Math.min((width - padding * 2) / BOARD_COLS, (height - padding * 2) / BOARD_ROWS));
    this.layout = {
      cell: Math.max(cell, 0),
      originX: Math.floor((width - cell * BOARD_COLS) / 2),
      originY: Math.floor((height - cell * BOARD_ROWS) / 2),
    };
  }

  private cellCenter(row: number, col: number): { x: number; y: number } {
    const { cell, originX, originY } = this.layout;
    return { x: originX + col * cell + cell / 2, y: originY + row * cell + cell / 2 };
  }

  private drawBackdrop(): void {
    const { cell, originX, originY } = this.layout;
    this.backdrop.clear();
    if (cell < 4) return;
    const pad = Math.max(4, cell * 0.08);
    const boardW = cell * BOARD_COLS;
    const boardH = cell * BOARD_ROWS;
    this.backdrop.fillStyle(0x000000, 0.32);
    this.backdrop.fillRoundedRect(originX - pad, originY - pad, boardW + pad * 2, boardH + pad * 2, pad * 2);
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if ((row + col) % 2 === 0) continue;
        this.backdrop.fillStyle(0xffffff, 0.05);
        this.backdrop.fillRect(originX + col * cell, originY + row * cell, cell, cell);
      }
    }
  }

  private characterFor(id: CharacterId): CharacterConfig | undefined {
    return findCharacter(this.session.activePool, id);
  }

  private createView(tile: Tile, x: number, y: number): TileView {
    const character = this.characterFor(tile.characterId);
    const textureKey = textureKeyFor(tile.characterId);
    const useImage = Boolean(character?.assets.normal) && this.textures.exists(textureKey);

    const bg = this.add.graphics();
    const overlay = this.add.graphics();
    const art: TileView["art"] = useImage
      ? this.add.image(0, 0, textureKey)
      : this.add
          .text(0, 0, character?.label ?? tile.characterId, {
            fontFamily: FONT_FAMILY,
            fontStyle: "bold",
            color: "#ffffff",
            align: "center",
          })
          .setOrigin(0.5);

    // overlay sits under the art so labels stay readable on top of special markings
    const container = this.add.container(x, y, [bg, overlay, art]);
    const view: TileView = {
      uid: tile.uid,
      characterId: tile.characterId,
      special: tile.special,
      container,
      bg,
      overlay,
      art,
    };
    this.views.set(tile.uid, view);
    this.drawView(view);
    return view;
  }

  private drawView(view: TileView): void {
    const { cell } = this.layout;
    if (cell < 4) return;
    const character = this.characterFor(view.characterId);
    const size = cell * 0.92;
    const half = size / 2;
    const radius = size * 0.2;
    const isImage = view.art instanceof Phaser.GameObjects.Image;
    const color = isImage ? IMAGE_TILE_COLOR : (character?.color ?? 0x666666);

    view.bg.clear();
    view.bg.fillStyle(0x000000, 0.28);
    view.bg.fillRoundedRect(-half + 1, -half + size * 0.05, size, size, radius);
    view.bg.fillStyle(color, 1);
    view.bg.fillRoundedRect(-half, -half, size, size, radius);
    view.bg.fillStyle(0xffffff, 0.16);
    view.bg.fillRoundedRect(-half, -half, size, size * 0.42, { tl: radius, tr: radius, bl: 0, br: 0 });

    if (view.art instanceof Phaser.GameObjects.Image) {
      view.art.setDisplaySize(size * 0.86, size * 0.86);
    } else {
      const layout = computeLabelLayout(character?.label ?? view.characterId, cell);
      view.art.setText(layout.text);
      view.art.setFontSize(layout.fontSize);
      view.art.setLineSpacing(Math.round(layout.fontSize * 0.05));
      view.art.setStroke("#1a1030", Math.max(2, Math.round(layout.fontSize * 0.16)));
      view.art.setWordWrapWidth(size * 0.94);
    }

    this.drawSpecialOverlay(view, size);
    view.container.setSize(size, size);
  }

  private drawSpecialOverlay(view: TileView, size: number): void {
    const g = view.overlay;
    const half = size / 2;
    g.clear();
    switch (view.special) {
      case "striped-row":
        g.fillStyle(0xffffff, 0.55);
        for (let i = -1; i <= 1; i++) g.fillRect(-half + 3, i * size * 0.26 - size * 0.06, size - 6, size * 0.12);
        break;
      case "striped-col":
        g.fillStyle(0xffffff, 0.55);
        for (let i = -1; i <= 1; i++) g.fillRect(i * size * 0.26 - size * 0.06, -half + 3, size * 0.12, size - 6);
        break;
      case "wrapped":
        g.lineStyle(Math.max(3, size * 0.09), 0xffe066, 1);
        g.strokeRoundedRect(-half + 2, -half + 2, size - 4, size - 4, size * 0.2);
        g.fillStyle(0xffe066, 1);
        for (const [cx, cy] of [
          [-half + 3, -half + 3],
          [half - 3, -half + 3],
          [-half + 3, half - 3],
          [half - 3, half - 3],
        ]) {
          g.fillCircle(cx, cy, size * 0.09);
        }
        break;
      case "super": {
        const t = Math.max(3, size * 0.09);
        const colors = [0xff5c5c, 0xffd23f, 0x4cd964, 0x4c9aff];
        g.fillStyle(0xffffff, 0.22);
        g.fillCircle(0, 0, size * 0.42);
        g.fillStyle(colors[0], 1);
        g.fillRect(-half, -half, size, t);
        g.fillStyle(colors[1], 1);
        g.fillRect(half - t, -half, t, size);
        g.fillStyle(colors[2], 1);
        g.fillRect(-half, half - t, size, t);
        g.fillStyle(colors[3], 1);
        g.fillRect(-half, -half, t, size);
        break;
      }
      default:
        break;
    }
  }

  private relayout(): void {
    this.pendingRelayout = false;
    this.computeLayout();
    this.drawBackdrop();
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
      this.drawBackdrop();
    } else {
      this.relayout();
    }
  };

  private drawSelection(): void {
    this.selection.clear();
    if (!this.selectedCell || this.layout.cell < 4) return;
    const { x, y } = this.cellCenter(this.selectedCell.row, this.selectedCell.col);
    const size = this.layout.cell * 0.98;
    this.selection.lineStyle(Math.max(3, this.layout.cell * 0.07), 0xffffff, 0.95);
    this.selection.strokeRoundedRect(x - size / 2, y - size / 2, size, size, size * 0.2);
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
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD_PX) return;

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
        this.settle();
        this.unlock("animating");
      }
    }
  }

  /** After a fully settled loop (or an idle timer expiry): decide whether the session goes on. */
  private settle(): void {
    if (this.session.evaluateSettled() !== "continue") this.lock("session");
  }

  private handleTimerTick(): void {
    if (this.closed) return;
    if (this.session.tickSecond() > 0) return;

    // Time is up: refuse new swaps immediately, but let any in-flight cascade finish first.
    this.timerEvent?.remove();
    this.timerEvent = null;
    this.lock("timer");
    if (!this.locks.has("animating")) this.settle();
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
    this.session.addScore(step.scoreDelta);
    this.session.registerCombo(step.comboIndex);

    let sumX = 0;
    let sumY = 0;
    const tweens: Promise<void>[] = [];
    for (const cleared of step.cleared) {
      const view = this.views.get(cleared.uid);
      const { x, y } = this.cellCenter(cleared.cell.row, cleared.cell.col);
      sumX += x;
      sumY += y;
      if (!view) continue;
      this.views.delete(cleared.uid);
      this.burst(x, y, this.characterFor(cleared.characterId)?.color ?? 0xffffff, 5);
      tweens.push(
        this.tween({
          targets: view.container,
          scale: 0.15,
          alpha: 0,
          angle: Phaser.Math.Between(-40, 40),
          duration: ANIMATION.clear,
          ease: "Quad.easeIn",
        }).then(() => view.container.destroy())
      );
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
      this.emitCallout("combo", comboCalloutText(this.session.rng));
    }

    await Promise.all(tweens);
  }

  private playSpecialEffect(special: SpecialType, cell: CellRef): void {
    const { cell: size, originX, originY } = this.layout;
    const { x, y } = this.cellCenter(cell.row, cell.col);
    const boardW = size * BOARD_COLS;
    const boardH = size * BOARD_ROWS;
    let shape: Phaser.GameObjects.Shape;
    let props: Phaser.Types.Tweens.TweenBuilderConfig;

    switch (special) {
      case "striped-row":
        shape = this.add.rectangle(originX + boardW / 2, y, boardW, size * 0.9, 0xffffff, 0.8);
        props = { targets: shape, alpha: 0, scaleY: 0.15, duration: 320, ease: "Quad.easeOut" };
        break;
      case "striped-col":
        shape = this.add.rectangle(x, originY + boardH / 2, size * 0.9, boardH, 0xffffff, 0.8);
        props = { targets: shape, alpha: 0, scaleX: 0.15, duration: 320, ease: "Quad.easeOut" };
        break;
      case "wrapped":
        shape = this.add.circle(x, y, size * 0.7, 0xffe066, 0.75);
        props = { targets: shape, alpha: 0, scale: 3, duration: 340, ease: "Quad.easeOut" };
        break;
      default:
        shape = this.add.rectangle(originX + boardW / 2, originY + boardH / 2, boardW, boardH, 0xffffff, 0.7);
        props = { targets: shape, alpha: 0, duration: 420, ease: "Quad.easeOut" };
        break;
    }
    shape.setDepth(DEPTH.fx);
    void this.tween(props).then(() => shape.destroy());
  }

  private async playSpawnSpecial(step: SpawnSpecialStep): Promise<void> {
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
    const { x, y } = this.cellCenter(BOARD_ROWS / 2 - 0.5, BOARD_COLS / 2 - 0.5);
    this.emitCallout("system", "No moves left — reshuffling!", x, y);

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
    const x = originX + (cell * BOARD_COLS) / 2;
    const y = originY + (cell * BOARD_ROWS) / 2;
    this.burst(x, y, 0xffe066, 26);
    this.cameras.main.shake(110, 0.003);
  }

  /** One lazily created emitter per colour; explodes a handful of dots at a point. */
  private burst(x: number, y: number, color: number, count: number): void {
    let emitter = this.burstEmitters.get(color);
    if (!emitter) {
      emitter = this.add.particles(0, 0, DOT_TEXTURE_KEY, {
        speed: { min: 70, max: 240 },
        lifespan: { min: 260, max: 560 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 320,
        tint: color,
        emitting: false,
      });
      emitter.setDepth(DEPTH.particles);
      this.burstEmitters.set(color, emitter);
    }
    emitter.explode(count, x, y);
  }

  private emitCallout(kind: CalloutKind, text: string, x?: number, y?: number): void {
    emitGameEvent(GameEvents.CALLOUT, { sessionId: this.session.sessionId, kind, text, x, y });
  }

  // ---- dev / e2e helpers -------------------------------------------------------------

  /** Read-only snapshot for debugging and browser-driven checks. Not used by the game itself. */
  debugSnapshot() {
    return {
      mode: this.mode,
      sessionId: this.session.sessionId,
      score: this.session.score,
      status: this.session.status,
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
