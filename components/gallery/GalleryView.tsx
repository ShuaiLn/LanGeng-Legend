"use client";

import { CHARACTER_LIBRARY } from "@/game/config/characters";
import { useT } from "../hooks/useT";
import { TitleSync } from "../LanguageSync";
import PageHeader from "../ui/PageHeader";
import GalleryGrid from "./GalleryGrid";

export default function GalleryView() {
  const t = useT();
  return (
    <>
      <TitleSync titleKey="title.gallery" />
      <PageHeader title={t("gallery.title")} subtitle={t("gallery.subtitle", { n: CHARACTER_LIBRARY.length })} />
      <GalleryGrid />
    </>
  );
}
