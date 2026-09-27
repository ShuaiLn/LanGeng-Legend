"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { COMBO_STEP, ENDLESS_DURATION_SECONDS } from "@/game/config/gameConfig";
import { useT } from "../hooks/useT";
import { TitleSync } from "../LanguageSync";
import Card from "../ui/Card";
import PageHeader from "../ui/PageHeader";

/** A card whose heading is always visible. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-base leading-relaxed text-ink-2">{children}</div>
    </Card>
  );
}

/** The same card, folded away until asked for, so the page is not one long wall of text on a phone. */
function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="details" className="group p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xl font-extrabold text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden className="text-lg text-primary transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="mt-2 space-y-2 text-base leading-relaxed text-ink-2">{children}</div>
    </Card>
  );
}

function Special({ name, rule, effect }: { name: string; rule: string; effect: string }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-item bg-well px-4 py-3">
      <span className="font-bold text-ink">
        {name} <span className="font-semibold text-ink-2">· {rule}</span>
      </span>
      <span className="text-[15px]">{effect}</span>
    </li>
  );
}

/** Puts a link where a translated sentence has its `{link}` slot: word order differs per language. */
function WithLink({ template, href, label }: { template: string; href: string; label: string }) {
  const [before, after = ""] = template.split("{link}");
  return (
    <>
      {before}
      <Link href={href} className="font-bold text-primary-ink underline-offset-4 hover:underline">
        {label}
      </Link>
      {after}
    </>
  );
}

export default function HowToPlayView() {
  const t = useT();

  return (
    <>
      <TitleSync titleKey="title.howToPlay" />
      <PageHeader title={t("how.title")} subtitle={t("how.subtitle")} />

      <div className="flex flex-col gap-4 pb-6">
        <Section title={t("how.basics.title")}>
          <p>{t("how.basics.p1")}</p>
          <p>{t("how.basics.p2")}</p>
        </Section>

        <Section title={t("how.modes.title")}>
          <p>{t("how.endless", { s: ENDLESS_DURATION_SECONDS })}</p>
          <p>{t("how.level")}</p>
        </Section>

        <Section title={t("how.difficulty.title")}>
          <p>{t("how.difficulty.body")}</p>
        </Section>

        <Fold title={t("how.specials.title")}>
          <ul className="space-y-2">
            <Special name={t("how.striped.name")} rule={t("how.striped.rule")} effect={t("how.striped.effect")} />
            <Special name={t("how.wrapped.name")} rule={t("how.wrapped.rule")} effect={t("how.wrapped.effect")} />
            <Special name={t("how.super.name")} rule={t("how.super.rule")} effect={t("how.super.effect")} />
          </ul>
          <p>{t("how.specials.note")}</p>
        </Fold>

        <Fold title={t("how.combos.title")}>
          <p>
            {t("how.combos.body", {
              step: COMBO_STEP,
              two: 1 + COMBO_STEP,
              three: 1 + 2 * COMBO_STEP,
            })}
          </p>
        </Fold>

        <Section title={t("how.pause.title")}>
          <p>{t("how.pause.body")}</p>
        </Section>

        <p className="px-1 text-center text-[15px] text-ink-2">
          <WithLink template={t("how.soundNote")} href="/settings" label={t("how.soundNote.link")} />{" "}
          <WithLink template={t("how.galleryNote")} href="/gallery" label={t("how.galleryNote.link")} />
        </p>

        <p className="px-1 pt-2 text-center text-xs leading-relaxed text-ink-2">{t("how.disclaimer")}</p>
      </div>
    </>
  );
}
