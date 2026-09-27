"use client";

import { en } from "@/lib/i18n/messages/en";
import { useT } from "./hooks/useT";

// The two lines are two separate block elements and are never joined. The English text is pinned by
// footer.test.ts; the credit is verbatim in both languages, the copyright line is translated.
export const FOOTER_LINES = [en["footer.copyright"], en["footer.credit"]] as const;

export default function Footer() {
  const t = useT();
  return (
    <footer className="mt-auto flex flex-col items-center gap-1 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 text-center text-xs leading-relaxed text-ink-2">
      <p className="max-w-xl text-balance">{t("footer.copyright")}</p>
      <p>{t("footer.credit")}</p>
    </footer>
  );
}
