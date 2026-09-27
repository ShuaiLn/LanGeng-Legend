import Phaser from "phaser";
import { CHARACTER_LIBRARY, textureKeyFor } from "../config/characters";
import { loadCustomTile } from "../../lib/customTileStorage";

export const DOT_TEXTURE_KEY = "dot";
/** Generated large so sparkles stay round when scaled up on HiDPI screens (the old dot was 8px). */
export const DOT_TEXTURE_SIZE = 32;

/**
 * Loads the tile textures (library art plus the player's uploaded tile) and hands over to
 * BoardScene. The startup preloader has already fetched these files, so this mostly hits the
 * browser cache; a character whose art failed to load falls back to a text tile.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    const customTile = loadCustomTile();
    this.registry.set("customTile", customTile);

    const characters = customTile ? [...CHARACTER_LIBRARY, customTile] : CHARACTER_LIBRARY;
    for (const character of characters) {
      if (character.assets.normal) this.load.image(textureKeyFor(character.id), character.assets.normal);
    }
  }

  create(): void {
    // A generated solid dot for particle effects: no art asset needed.
    if (!this.textures.exists(DOT_TEXTURE_KEY)) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(DOT_TEXTURE_SIZE / 2, DOT_TEXTURE_SIZE / 2, DOT_TEXTURE_SIZE / 2);
      graphics.generateTexture(DOT_TEXTURE_KEY, DOT_TEXTURE_SIZE, DOT_TEXTURE_SIZE);
      graphics.destroy();
    }
    this.scene.start("BoardScene");
  }
}
