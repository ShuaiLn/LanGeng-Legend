import Link from "next/link";
import CustomTileUpload from "@/components/CustomTileUpload";
import { ACTIVE_POOL_SIZE } from "@/game/config/characters";
import { ENDLESS_DURATION_SECONDS } from "@/game/config/gameConfig";
import { DEMO_LEVEL } from "@/game/config/levels";

function ModeCard({
  href,
  title,
  badge,
  children,
}: {
  href: string;
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:bg-surface-2"
    >
      <span className="w-fit rounded-full bg-accent/15 px-3 py-0.5 text-xs font-black uppercase tracking-wider text-accent">
        {badge}
      </span>
      <span className="text-2xl font-black text-foreground">{title}</span>
      <span className="text-sm leading-relaxed text-muted">{children}</span>
      <span className="mt-2 font-black text-accent group-hover:underline">Play →</span>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <section className="text-center">
        <h1 className="text-5xl font-black tracking-tight text-foreground sm:text-6xl">
          烂梗<span className="text-accent">传奇</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
          Swap, match and blow up your favourite Chinese internet memes. Combine four, five or L/T shapes into special
          tiles and chain them into huge combos.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Game modes">
        <ModeCard href="/play?mode=endless" title={`${ENDLESS_DURATION_SECONDS}-Second Endless`} badge="Score attack">
          Rack up as many points as you can before the clock runs out. Chains and specials multiply your score.
        </ModeCard>
        <ModeCard href="/play?mode=level" title={DEMO_LEVEL.name} badge="Star rating">
          Reach {DEMO_LEVEL.objective.targetScore.toLocaleString()} points in {DEMO_LEVEL.moveLimit} moves. Every move
          you have left turns into a bonus blast, and the bigger the finale, the more stars you earn.
        </ModeCard>
      </section>

      <CustomTileUpload />

      <p className="text-center text-sm text-muted">
        Each game draws {ACTIVE_POOL_SIZE} characters from the roster.{" "}
        <Link href="/gallery" className="font-bold text-accent underline-offset-4 hover:underline">
          Meet the whole cast →
        </Link>
      </p>
    </div>
  );
}
