import GalleryView from "@/components/gallery/GalleryView";
import PageShell from "@/components/ui/PageShell";

export const metadata = { title: "Gallery · 烂梗传奇" };

// Always the full fixed library; a custom upload or a session's active pool never trims this.
export default function GalleryPage() {
  return (
    <PageShell width="wide">
      <GalleryView />
    </PageShell>
  );
}
