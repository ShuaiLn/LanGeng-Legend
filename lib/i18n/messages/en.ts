/**
 * English: the source of truth for every message key. `zh.ts` is typed against this file, so a
 * missing or extra key in the Chinese dictionary is a compile error, and `messages.test.ts` checks
 * the rest (no empty values, identical {placeholders}).
 *
 * Placeholders are written {name}. Plurals are two keys, `.one` and `.other`, chosen by the caller.
 * Words that are content rather than interface stay as they are in both languages: the meme callouts,
 * the "Developed by Ning" credit and the characters' display names.
 */
export const en = {
  // ---- common ----
  "common.close": "Close",
  "common.dismiss": "Dismiss",
  "common.home": "Home",

  // ---- page titles (document.title) ----
  "title.home": "烂梗传奇 · Meme Match",
  "title.play": "Play · 烂梗传奇",
  "title.levels": "Levels · 烂梗传奇",
  "title.settings": "Settings · 烂梗传奇",
  "title.howToPlay": "How to Play · 烂梗传奇",
  "title.gallery": "Gallery · 烂梗传奇",

  // ---- opening, cover, loading ----
  "open.tap": "Tap to start",
  "open.loading": "Loading…",
  "open.logoAlt": "烂梗传奇 Meme Match",
  "load.assets": "Loading assets…",
  "load.aria": "Loading assets",
  "error.assets.one": "{n} asset could not be loaded. The game still works; some art or sounds may be missing.",
  "error.assets.other": "{n} assets could not be loaded. The game still works; some art or sounds may be missing.",

  // ---- footer (the credit line is verbatim in both languages) ----
  "footer.copyright":
    "If there is any copyright infringement, please contact ShuaiLn@gmail.com and it will be addressed immediately.",
  "footer.credit": "Developed by Ning",

  // ---- language ----
  "lang.aria": "Language",

  // ---- main menu ----
  "menu.aria": "Main menu",
  "menu.play": "Play",
  "menu.settings": "Settings",
  "menu.howToPlay": "How to Play",

  // ---- mode picker ----
  "mode.title": "Choose a mode",
  "mode.endless.badge": "Score attack",
  "mode.endless.title": "{s}-Second Endless",
  "mode.endless.desc": "Score as much as you can before the clock runs out.",
  "mode.endless.best": "Best {n}",
  "mode.level.badge": "Star rating",
  "mode.level.title": "Level Mode",
  "mode.level.desc": "20 levels. Pick a difficulty and earn up to 3 stars on each.",
  "mode.level.stars": "{n} stars earned",

  // ---- difficulty ----
  "diff.easy": "Easy",
  "diff.normal": "Normal",
  "diff.hard": "Hard",
  "diff.easy.desc": "More moves, lower goals",
  "diff.normal.desc": "The intended balance",
  "diff.hard.desc": "Fewer moves, higher goals",

  // ---- level select (the grid, and the popup where the difficulty is chosen) ----
  "levels.stars": "{n} / {max}",
  "levels.backHome": "Home",
  "levels.title": "Levels",
  "levels.levelN": "Level {n}",
  "levels.startLevel": "Start level",
  "levels.difficultyLabel": "Difficulty",
  "levels.lockedHint": "Clear level {n} first.",
  "levels.best": "Best {n}",
  "levels.notCleared": "Not cleared yet",
  "levels.moves": "{n} moves",
  "levels.starLines": "Stars at {one} · {two} · {three}",
  "levels.starLinesClear": "1 star for clearing it · {two} · {three}",
  "levels.goals": "Goals",
  "levels.grid": "Levels",
  "a11y.levelCell": "Level {n}, best {stars} of 3 stars",
  "a11y.levelCellNew": "Level {n}, not cleared",
  "a11y.levelCellLocked": "Level {n}, locked",
  "a11y.stars": "{n} of {total} stars",
  "a11y.goalDone": "Goal complete: {goal}",

  // ---- chapters ----
  "chapter.1": "Warm-up",
  "chapter.2": "Chains",
  "chapter.3": "Precision",
  "chapter.4": "Mastery",

  // ---- goals ----
  "goal.score": "Score {n}",
  "goal.collect": "Clear {n} of the highlighted character",
  "goal.specials.one": "Make {n} special tile",
  "goal.specials.other": "Make {n} special tiles",
  "goal.chain": "Reach a chain of ×{n}",
  "goalShort.score": "Score",
  "goalShort.collect": "Clear",
  "goalShort.specials": "Specials",
  "goalShort.chain": "Chain ×{n}",
  "level.hint.swap": "Swipe, or tap two neighbouring tiles, to swap them and line up 3.",
  "level.hint.specials": "Match 4 in a line, or an L or T shape, to make a special tile.",
  "level.hint.collect": "Clear the highlighted character. It changes every attempt.",
  "level.hint.chain": "A chain is a clear that makes tiles fall into a new match.",
  "level.hint.eight": "Eight characters this time: matches are rarer, so plan ahead.",

  // ---- play screen, HUD ----
  "play.title.endless": "{s}-Second Endless",
  "play.title.level": "Level {n} · {difficulty}",
  "play.loading": "Loading game…",
  "hud.status": "Game status",
  "hud.score": "Score",
  "hud.time": "Time",
  "hud.moves": "Moves",
  "hud.combo": "Combo",
  "hud.best": "Best",
  "hud.goals": "Goals",
  "hud.timeValue": "{n}s",
  "hud.newBest": "New best",

  // ---- pause ----
  "pause.button": "Pause",
  "pause.title": "Paused",
  "pause.resume": "Resume",
  "pause.home": "Return to Home",

  // ---- callouts (the meme phrases, the combo shout and Clear！！ live in game/config/callouts.ts) ----
  "system.reshuffle": "No moves left — reshuffling!",

  // ---- celebration ----
  "reveal.finalScore": "Final Score",
  "reveal.newBest": "New Best!",

  // ---- results ----
  "result.clear.aria": "Level result",
  "result.level": "Level {n} · {difficulty}",
  "result.newBest": "New Best!",
  "result.scoreAria": "Score {n}",
  "result.stat.best": "Best score",
  "result.stat.combo": "Best combo",
  "result.stat.moves": "Moves used",
  "result.stat.bonus": "Bonus",
  "result.next": "Next Level",
  "result.nextUnlocked": "Level {n} unlocked",
  "result.replay": "Replay",
  "result.home": "Home",
  "result.levelSelect": "Level Select",
  "result.allCleared": "That was the last level!",
  "result.totalStars": "{n} / {max} stars on {difficulty}",
  "result.defeat.title": "Out of moves",
  "result.defeat.aria": "Level failed",
  "result.defeat.score": "Score",
  "result.defeat.goals": "Goals",
  "result.retry": "Retry",
  "endless.over.title": "Time's up!",
  "endless.over.aria": "Game over",
  "endless.finalScore": "Final score",
  "endless.best": "Best",
  "endless.combo": "Best combo",
  "endless.again": "Play again",

  // ---- settings ----
  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.language.desc": "Switches every screen and label.",
  "settings.sound": "Sound",
  "settings.sfx": "Sound effects",
  "settings.sfx.desc": "Tile sounds while you play, and the victory jingle.",
  "settings.tileSounds": "Tile sounds",
  "settings.enableAll": "Enable all",
  "settings.muteAll": "Mute all",
  "settings.tileSoundAria": "{name} sound",
  "settings.sfxOff": "Sound effects are off, so none of these will play until you turn them back on.",
  "settings.yourTile": "Your Tile",
  "settings.yourTileName": "Your tile",
  "settings.noCustomSound": "No custom sound yet",
  "custom.desc":
    "Upload any picture and it joins the board as a character. It takes one character slot, so each game then uses one fewer library character. The image is downscaled to 256×256 and stays in this browser only, so it will not follow you to another device or survive clearing site data.",
  "custom.alt": "Your uploaded tile",
  "custom.none": "none yet",
  "custom.choose": "Choose image",
  "custom.replace": "Replace image",
  "custom.processing": "Processing…",
  "custom.remove": "Remove",
  "custom.errNotImage": "Please choose an image file.",
  "custom.errStorage": "Your browser refused to store the image (storage full or blocked).",
  "custom.errProcess": "Could not process that image.",

  // ---- gallery ----
  "gallery.title": "Gallery",
  "gallery.subtitle": "All {n} characters. Each game picks some of them at random. Tap a tile to hear its sound.",
  "gallery.state.play": "Tap to play",
  "gallery.state.off": "Sound off",
  "gallery.state.none": "No sound",
  "gallery.aria": "{name}: {state}",
  "gallery.mutedIn": "Muted in Settings",
  "gallery.custom": "Custom tile",
  "gallery.yourTile": "Your tile",

  // ---- how to play ----
  "how.title": "How to Play",
  "how.subtitle": "Swap, match, chain, and blow up your favourite memes.",
  "how.basics.title": "The basics",
  "how.basics.p1":
    "Swap two neighbouring tiles, by swiping or by tapping one and then the other, so that 3 or more of the same meme line up in a row or column. Matched tiles disappear, the rest fall down and new ones drop in.",
  "how.basics.p2":
    "A swap only counts as a move if it makes a match; otherwise the tiles slide back. If no moves are left the board reshuffles, and that never costs you a move.",
  "how.specials.title": "Special tiles",
  "how.striped.name": "Striped tile",
  "how.striped.rule": "match 4 in a line",
  "how.striped.effect": "Clears its whole row or column, depending on which way you matched.",
  "how.wrapped.name": "Wrapped tile",
  "how.wrapped.rule": "match an L or T shape",
  "how.wrapped.effect": "Clears the 3×3 block around it.",
  "how.super.name": "Super tile",
  "how.super.rule": "match 5 in a line",
  "how.super.effect": "Clears every tile of its own character on the board.",
  "how.specials.note": "Special tiles go off when they are matched again or swept up by another blast, so they can chain.",
  "how.combos.title": "Combos",
  "how.combos.body":
    "When a clear makes tiles fall into a new match, that is a chain. The score multiplier climbs by {step} with every step (×1, ×{two}, ×{three}, …), and chained tiles flash gold instead of red. Watch the Combo box while you play.",
  "how.modes.title": "Modes",
  "how.endless": "{s}-Second Endless: score as much as you can before the clock runs out. Your best score is saved.",
  "how.level":
    "Level Mode: 20 levels in four chapters. Each level has one to three goals (reach a score, clear a highlighted character, make special tiles, or reach a chain) and a limit on moves. Clear every goal before the moves run out. Every move you have left turns into a bonus blast, and your final score earns 1, 2 or 3 stars.",
  "how.difficulty.title": "Difficulty",
  "how.difficulty.body":
    "Easy gives you more moves and lower goals; Hard gives you fewer moves and higher goals. Clearing a level unlocks the next one for every difficulty, but your stars and best scores are kept separately for each.",
  "how.pause.title": "Pause",
  "how.pause.body":
    "Tap Pause (or press Esc) at any time. The game freezes exactly where it is, and Resume carries on from the same moment.",
  "how.soundNote": "Tile sounds can be switched on and off in {link}.",
  "how.soundNote.link": "Settings",
  "how.galleryNote": "Meet the whole cast in the {link}.",
  "how.galleryNote.link": "Gallery",
  "how.disclaimer":
    "This is a fan work. It is not affiliated with the original rights holders, and every character belongs to its original creators.",

  // ---- characters (display names; the same in both languages until English names are supplied) ----
  "char.nailong": "奶龙",
  "char.kunkun": "蔡徐坤",
  "char.laoda": "劳大",
  "char.jiahao": "嘉豪",
  "char.niulai": "牛来",
  "char.mj": "mj",
  "char.xiongda": "熊大",
  "char.meituan": "美团袋鼠",
  "char.miaocui": "妙脆角小猫",
  "char.manbo": "曼波",
  "char.sixseven": "67",
} as const;

export type MessageKey = keyof typeof en;
