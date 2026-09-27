"use client";

import { useEffect } from "react";
import { htmlLang, type MessageKey } from "@/lib/i18n";
import { useLanguage, useT } from "./hooks/useT";

/** Keeps `<html lang>` in step with the chosen language (screen readers pick the voice from it). Renders nothing. */
export function LanguageSync() {
  const lang = useLanguage();
  useEffect(() => {
    document.documentElement.lang = htmlLang(lang);
  }, [lang]);
  return null;
}

/** Sets `document.title` from a message key, and again whenever the language changes. Renders nothing. */
export function TitleSync({ titleKey }: { titleKey: MessageKey }) {
  const t = useT();
  const title = t(titleKey);
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
