# Character art (not built yet)

Real art lands here later. Next.js only serves static files from `public/`, so a file at
`public/assets/characters/nailong/normal.webp` is reachable at `/assets/characters/nailong/normal.webp`.

## Spec

- Path: `public/assets/characters/<id>/normal.webp` (ids are in `game/config/characters.ts`).
- Square **256×256**, transparent-background **WebP**, flat modern meme-illustration style, bust portrait.
- Only `normal.webp` is needed per character. Special and explode states use shared generic overlays
  (`overlays/striped.webp`, `wrapped.webp`, `super.webp`, `explode-sheet.webp`) to keep the workload down.

## Wiring it up

Set `assets.normal` on the character in `game/config/characters.ts`:

```ts
{ id: "nailong", label: "奶龙", color: 0xf2b632,
  assets: { normal: "/assets/characters/nailong/normal.webp", special: null, explode: null } }
```

`BootScene` preloads it and `BoardScene` renders the image instead of the text placeholder: the exact same
code path the player-uploaded custom tile already uses.

## Characters (11)

奶龙, 蔡徐坤/坤坤, 劳大, 嘉豪, 牛来, mj, 熊大, 美团袋鼠, 妙脆角小猫, 曼波, 67 (`sixseven`)
