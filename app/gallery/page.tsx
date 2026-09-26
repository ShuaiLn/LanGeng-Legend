import { ACTIVE_POOL_SIZE, CHARACTER_LIBRARY } from "@/game/config/characters";

export const metadata = { title: "Gallery · 烂梗传奇" };

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

// Always the full fixed library; a custom upload or a session's active pool never trims this.
export default function GalleryPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-black text-foreground">Character gallery</h1>
        <p className="mt-1 text-muted">
          All {CHARACTER_LIBRARY.length} characters. Each game picks {ACTIVE_POOL_SIZE} of them at random. Final art is
          on its way; these are placeholders.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {CHARACTER_LIBRARY.map((character) => (
          <li key={character.id} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4">
            <div
              className="flex aspect-square w-full items-center justify-center rounded-2xl p-2 text-center text-xl font-black leading-tight text-white [text-shadow:0_2px_0_rgba(18,11,36,0.7)]"
              style={{ backgroundColor: hex(character.color) }}
            >
              {character.label}
            </div>
            <span className="text-xs font-semibold text-muted">{character.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
