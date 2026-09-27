import HowToPlayView from "@/components/how/HowToPlayView";
import PageShell from "@/components/ui/PageShell";

export const metadata = { title: "How to Play · 烂梗传奇" };

export default function HowToPlayPage() {
  return (
    <PageShell>
      <HowToPlayView />
    </PageShell>
  );
}
