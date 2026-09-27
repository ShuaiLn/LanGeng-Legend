/**
 * The chosen language (`meme-match:language:v1`, "en" or "zh"). Chinese is the default: until the
 * player actually switches, nothing is stored and the browser language is not consulted, so the
 * server, the first client render and a returning player who never chose all agree.
 */
import { DEFAULT_LANG, isLang, type Lang } from "./i18n";
import { browserStorage, createPersistedStore, type StorageLike } from "./persistedStore";

export const LANGUAGE_KEY = "meme-match:language:v1";

export interface LanguageStore {
  get(): Lang;
  set(lang: Lang): void;
  subscribe(listener: () => void): () => void;
}

export function createLanguageStore(getStorage: () => StorageLike | null): LanguageStore {
  return createPersistedStore<Lang>({
    key: LANGUAGE_KEY,
    getStorage,
    // a missing or corrupt value falls back to the default; nothing is written back
    load: (raw) => ({ value: isLang(raw) ? raw : DEFAULT_LANG }),
    serialize: (lang) => lang,
  });
}

const defaultStore = createLanguageStore(browserStorage);

export const getLanguage = defaultStore.get;
export const getServerLanguage = (): Lang => DEFAULT_LANG;
export const subscribeLanguage = defaultStore.subscribe;
export const setLanguage = defaultStore.set;
