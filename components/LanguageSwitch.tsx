"use client";

import type { Lang } from "@/lib/i18n";
import { setLanguage, useLanguage, useT } from "./hooks/useT";
import Segmented from "./ui/Segmented";

/**
 * 中文 | English. Each option is written in its own language, so it can be found from either state.
 * On the main menu (top right) and at the top of Settings; not in-game, where a re-render mid-run
 * is not wanted (the value is global, so it is already applied when a game starts).
 */
export default function LanguageSwitch({ className = "" }: { className?: string }) {
  const lang = useLanguage();
  const t = useT();
  return (
    <Segmented<Lang>
      value={lang}
      onChange={setLanguage}
      label={t("lang.aria")}
      className={className}
      options={[
        { value: "zh", label: "中文", lang: "zh-CN" },
        { value: "en", label: "English", lang: "en" },
      ]}
    />
  );
}
