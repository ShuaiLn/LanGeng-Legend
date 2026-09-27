import { en, type MessageKey } from "./messages/en";
import { zh } from "./messages/zh";

/**
 * A tiny typed translation layer (no library). `en` is the source of truth for the keys; `zh` is
 * compiled against it. `t` falls back zh -> en -> the key itself, so a missing string is visible in
 * development but never blank in production.
 */

export type { MessageKey };

export const LANGS = ["en", "zh"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "zh";

export const MESSAGES: Record<Lang, Partial<Record<MessageKey, string>>> = { en, zh };

export type Params = Readonly<Record<string, string | number>>;

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "zh";
}

/** `{name}` placeholders; one that has no value is left as written so it is easy to spot. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}

export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const message = MESSAGES[lang][key] ?? en[key];
  if (message === undefined) {
    if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing message "${key}"`);
    return key;
  }
  return interpolate(message, params);
}

/** English plurals: the caller passes the two keys and gets the one that fits `n`. */
export function plural<One extends MessageKey, Other extends MessageKey>(n: number, one: One, other: Other): One | Other {
  return n === 1 ? one : other;
}

/** The `<html lang>` value for a language. */
export function htmlLang(lang: Lang): string {
  return lang === "zh" ? "zh-CN" : "en";
}

/**
 * A character's display name: library characters have a `char.<id>` message (so a translated name
 * is a one-file edit later); anything else, the custom tile, keeps the label it came with.
 */
export function characterName(lang: Lang, id: string, fallback: string): string {
  const key = `char.${id}`;
  return key in en ? t(lang, key as MessageKey) : fallback;
}

/**
 * What a callout says. The scene sends verbatim text (scores, meme phrases, the combo shout, BOOM!) plus,
 * for the one that is a word of the interface (the reshuffle notice), a key: this is the only place that
 * turns one into the other, so the scene owns no copy at all.
 */
export function calloutLabel(lang: Lang, callout: { text: string; key?: MessageKey }): string {
  return callout.key ? t(lang, callout.key) : callout.text;
}
