import LevelSelect from "@/components/levels/LevelSelect";
import PageShell from "@/components/ui/PageShell";

export const metadata = { title: "Levels · 烂梗传奇" };

/** Level Mode: the level grid. The difficulty is chosen in the popup a level opens. */
export default function LevelsPage() {
  return (
    <PageShell>
      <LevelSelect />
    </PageShell>
  );
}
