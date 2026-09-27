import SettingsView from "@/components/settings/SettingsView";
import PageShell from "@/components/ui/PageShell";

export const metadata = { title: "Settings · 烂梗传奇" };

export default function SettingsPage() {
  return (
    <PageShell>
      <SettingsView />
    </PageShell>
  );
}
