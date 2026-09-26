import Link from "next/link";

// Static and non-interactive: stays a Server Component.
export default function Header() {
  return (
    <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-black tracking-tight text-accent">
          烂梗传奇 <span className="text-sm font-semibold text-muted">Meme Match</span>
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/play?mode=endless" className="text-foreground/90 hover:text-accent">
            Play
          </Link>
          <Link href="/gallery" className="text-foreground/90 hover:text-accent">
            Gallery
          </Link>
        </div>
      </nav>
    </header>
  );
}
