/**
 * Numeric mirror of the design tokens in `app/globals.css`, for the few places the Phaser canvas
 * needs them. Keep the two in sync: the CSS file is the source of truth.
 *
 * Colour roles: red = a normal elimination, gold = a combo (chain) elimination and nothing else,
 * sky blue = everything interactive (selection, special-tile markers).
 */
export const THEME = {
  primary: 0x2e8fea,
  primaryPress: 0x1a6fc2,
  skySoft: 0xd6eaff,
  well: 0xeef5fe,
  border: 0xd6e6f7,
  text: 0x1f3a5f,
  white: 0xffffff,
  red: 0xff4d4f,
  redSoft: 0xff8e8f,
  gold: 0xffc933,
} as const;

/** The same colours as CSS strings, for Phaser text styles. */
export const THEME_CSS = {
  text: "#1f3a5f",
  white: "#ffffff",
  well: "#eef5fe",
} as const;
