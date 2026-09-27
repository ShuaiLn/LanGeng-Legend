"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "../hooks/useT";

interface PageHeaderProps {
  title: string;
  /** One line under the title. */
  subtitle?: ReactNode;
  backHref?: string;
  /** Defaults to "Home". */
  backLabel?: string;
}

/** Back-header for Settings, How to Play, the Gallery and the level screens (the start screen has no header). */
export default function PageHeader({ title, subtitle, backHref = "/", backLabel }: PageHeaderProps) {
  const t = useT();
  return (
    <header className="pb-4 pt-4">
      <Link
        href={backHref}
        className="-ml-3 inline-flex h-11 items-center gap-1 rounded-btn-sm px-3 text-[15px] font-bold text-ink-2 no-underline transition-colors hover:bg-well hover:text-ink"
      >
        <span aria-hidden>←</span> {backLabel ?? t("common.home")}
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-base leading-relaxed text-ink-2">{subtitle}</p>}
    </header>
  );
}
