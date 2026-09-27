"use client";

import { useCallback, useSyncExternalStore } from "react";
import { t as translate, type Lang, type MessageKey, type Params } from "@/lib/i18n";
import { getLanguage, getServerLanguage, setLanguage, subscribeLanguage } from "@/lib/languageStorage";

/** The current language. Server and first client render both see English (the loading gate covers the swap). */
export function useLanguage(): Lang {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getServerLanguage);
}

export type TFunction = (key: MessageKey, params?: Params) => string;

/** `const t = useT()`: a translate function bound to the current language. */
export function useT(): TFunction {
  const lang = useLanguage();
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

export { setLanguage };
