import Phaser from "phaser";
import { CHARACTER_LIBRARY, textureKeyFor } from "../config/characters";
import { loadCustomTile } from "../../lib/customTileStorage";

export const DOT_TEXTURE_KEY = "dot";

/**
 * Preloads whatever art exists (all library assets are `null` for now, so placeholders are
 * text) plus the player's uploaded tile, then hands over to BoardScene.
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
      graphics.fillCircle(4, 4, 4);
      graphics.generateTexture(DOT_TEXTURE_KEY, 8, 8);
      graphics.destroy();
    }
    this.scene.start("BoardScene");
  }
}
