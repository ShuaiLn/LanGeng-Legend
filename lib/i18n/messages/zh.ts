import type { MessageKey } from "./en";

/**
 * 简体中文. Typed against the English keys: a missing or extra key does not compile. The meme
 * callouts, "Developed by Ning" and the characters' display names are content and stay verbatim.
 */
export const zh: Record<MessageKey, string> = {
  // ---- common ----
  "common.close": "关闭",
  "common.dismiss": "知道了",
  "common.home": "首页",

  // ---- page titles ----
  "title.home": "烂梗传奇 · Meme Match",
  "title.play": "游戏 · 烂梗传奇",
  "title.levels": "关卡 · 烂梗传奇",
  "title.settings": "设置 · 烂梗传奇",
  "title.howToPlay": "玩法说明 · 烂梗传奇",
  "title.gallery": "图鉴 · 烂梗传奇",

  // ---- opening, cover, loading ----
  "open.tap": "点击开始",
  "open.loading": "加载中…",
  "open.logoAlt": "烂梗传奇 Meme Match",
  "load.assets": "正在加载资源…",
  "load.aria": "加载资源",
  "error.assets.one": "有 {n} 个资源加载失败。游戏仍可正常游玩，部分图片或声音可能缺失。",
  "error.assets.other": "有 {n} 个资源加载失败。游戏仍可正常游玩，部分图片或声音可能缺失。",

  // ---- footer ----
  "footer.copyright": "如有任何侵权，请联系 ShuaiLn@gmail.com，我们将立即处理。",
  "footer.credit": "Developed by Ning",

  // ---- language ----
  "lang.aria": "语言",

  // ---- main menu ----
  "menu.aria": "主菜单",
  "menu.play": "开始游戏",
  "menu.settings": "设置",
  "menu.howToPlay": "玩法说明",

  // ---- mode picker ----
  "mode.title": "选择模式",
  "mode.endless.badge": "冲分挑战",
  "mode.endless.title": "{s} 秒无尽模式",
  "mode.endless.desc": "在倒计时结束前，尽可能多地得分。",
  "mode.endless.best": "最高分 {n}",
  "mode.level.badge": "星级挑战",
  "mode.level.title": "关卡模式",
  "mode.level.desc": "共 20 关。选择难度，每关最多可获得 3 颗星。",
  "mode.level.stars": "已获得 {n} 颗星",

  // ---- difficulty ----
  "diff.easy": "简单",
  "diff.normal": "普通",
  "diff.hard": "困难",
  "diff.easy.desc": "步数更多，目标更低",
  "diff.normal.desc": "标准平衡",
  "diff.hard.desc": "步数更少，目标更高",

  // ---- difficulty selection + level select ----
  "levels.stars": "{n} / {max}",
  "levels.backHome": "首页",
  "levels.title": "关卡",
  "levels.levelN": "第 {n} 关",
  "levels.startLevel": "开始关卡",
  "levels.difficultyLabel": "难度",
  "levels.lockedHint": "请先通关第 {n} 关。",
  "levels.best": "最高分 {n}",
  "levels.notCleared": "尚未通关",
  "levels.moves": "{n} 步",
  "levels.starLines": "星级分数线 {one} · {two} · {three}",
  "levels.starLinesClear": "通关得 1 星 · {two} · {three}",
  "levels.goals": "目标",
  "levels.grid": "关卡",
  "a11y.levelCell": "第 {n} 关，最高 {stars}/3 颗星",
  "a11y.levelCellNew": "第 {n} 关，尚未通关",
  "a11y.levelCellLocked": "第 {n} 关，未解锁",
  "a11y.stars": "{total} 颗星中的 {n} 颗",
  "a11y.goalDone": "目标完成：{goal}",

  // ---- chapters ----
  "chapter.1": "热身",
  "chapter.2": "连锁",
  "chapter.3": "精准",
  "chapter.4": "大师",

  // ---- goals ----
  "goal.score": "得分 {n}",
  "goal.collect": "消除 {n} 个高亮角色",
  "goal.specials.one": "制造 {n} 个特殊方块",
  "goal.specials.other": "制造 {n} 个特殊方块",
  "goal.chain": "达成 ×{n} 连锁",
  "goalShort.score": "得分",
  "goalShort.collect": "消除",
  "goalShort.specials": "特殊方块",
  "goalShort.chain": "连锁 ×{n}",
  "level.hint.swap": "滑动或依次点击相邻的方块来交换，凑齐 3 个即可消除。",
  "level.hint.specials": "连成 4 个，或 L 形、T 形，可以生成特殊方块。",
  "level.hint.collect": "消除高亮的角色，每次挑战的角色都会不同。",
  "level.hint.chain": "连锁：一次消除后落下的方块又形成新的消除。",
  "level.hint.eight": "这一关有 8 种角色，能消除的组合更少，请提前规划。",

  // ---- play screen, HUD ----
  "play.title.endless": "{s} 秒无尽模式",
  "play.title.level": "第 {n} 关 · {difficulty}",
  "play.loading": "正在加载游戏…",
  "hud.status": "游戏状态",
  "hud.score": "得分",
  "hud.time": "时间",
  "hud.moves": "步数",
  "hud.combo": "连击",
  "hud.best": "最高分",
  "hud.goals": "目标",
  "hud.timeValue": "{n} 秒",
  "hud.newBest": "新纪录",

  // ---- pause ----
  "pause.button": "暂停",
  "pause.title": "已暂停",
  "pause.resume": "继续",
  "pause.home": "返回首页",

  // ---- callouts ----
  "system.reshuffle": "没有可消除的了，重新洗牌！",

  // ---- celebration ----
  "reveal.finalScore": "最终得分",
  "reveal.newBest": "新纪录！",

  // ---- results ----
  "result.clear.aria": "关卡结果",
  "result.level": "第 {n} 关 · {difficulty}",
  "result.newBest": "新纪录！",
  "result.scoreAria": "得分 {n}",
  "result.stat.best": "最高分",
  "result.stat.combo": "最佳连击",
  "result.stat.moves": "已用步数",
  "result.stat.bonus": "奖励分",
  "result.next": "下一关",
  "result.nextUnlocked": "第 {n} 关已解锁",
  "result.replay": "重玩本关",
  "result.home": "首页",
  "result.levelSelect": "选择关卡",
  "result.allCleared": "最后一关，拿下！",
  "result.totalStars": "{difficulty}难度已获得 {n} / {max} 颗星",
  "result.defeat.title": "步数用完了",
  "result.defeat.aria": "关卡失败",
  "result.defeat.score": "得分",
  "result.defeat.goals": "目标进度",
  "result.retry": "重试",
  "endless.over.title": "时间到！",
  "endless.over.aria": "游戏结束",
  "endless.finalScore": "最终得分",
  "endless.best": "最高分",
  "endless.combo": "最佳连击",
  "endless.again": "再玩一次",

  // ---- settings ----
  "settings.title": "设置",
  "settings.language": "语言",
  "settings.language.desc": "切换所有界面和文字。",
  "settings.sound": "声音",
  "settings.sfx": "音效",
  "settings.sfx.desc": "游戏中的方块音效，以及胜利音乐。",
  "settings.tileSounds": "方块音效",
  "settings.enableAll": "全部开启",
  "settings.muteAll": "全部静音",
  "settings.tileSoundAria": "{name} 音效",
  "settings.sfxOff": "音效已关闭，重新开启后才会播放这些声音。",
  "settings.yourTile": "你的方块",
  "settings.yourTileName": "你的方块",
  "settings.noCustomSound": "暂无自定义音效",
  "custom.desc":
    "上传任意图片，它就会作为一个角色加入棋盘。它会占用一个角色名额，所以每局会少用一个内置角色。图片会被缩小到 256×256，只保存在当前浏览器中，不会同步到其他设备，清除网站数据后也会消失。",
  "custom.alt": "你上传的方块",
  "custom.none": "暂无",
  "custom.choose": "选择图片",
  "custom.replace": "更换图片",
  "custom.processing": "处理中…",
  "custom.remove": "移除",
  "custom.errNotImage": "请选择图片文件。",
  "custom.errStorage": "浏览器拒绝保存这张图片（存储已满或被禁用）。",
  "custom.errProcess": "无法处理这张图片。",

  // ---- gallery ----
  "gallery.title": "图鉴",
  "gallery.subtitle": "共 {n} 个角色，每局会随机选用其中几个。点击方块即可听它的声音。",
  "gallery.state.play": "点击播放",
  "gallery.state.off": "音效已关闭",
  "gallery.state.none": "没有声音",
  "gallery.aria": "{name}：{state}",
  "gallery.mutedIn": "已在设置中静音",
  "gallery.custom": "自定义方块",
  "gallery.yourTile": "你的方块",

  // ---- how to play ----
  "how.title": "玩法说明",
  "how.subtitle": "交换、消除、连锁，引爆你喜欢的烂梗。",
  "how.basics.title": "基本玩法",
  "how.basics.p1":
    "滑动，或依次点击两个相邻的方块来交换它们，让 3 个或更多相同的梗排成一行或一列。消除的方块会消失，其余方块落下，新的方块补进来。",
  "how.basics.p2": "只有能形成消除的交换才算一步，否则方块会滑回原位。如果没有可走的步子，棋盘会自动洗牌，洗牌不会消耗步数。",
  "how.specials.title": "特殊方块",
  "how.striped.name": "条纹方块",
  "how.striped.rule": "连成 4 个",
  "how.striped.effect": "根据你消除的方向，清除整行或整列。",
  "how.wrapped.name": "包裹方块",
  "how.wrapped.rule": "L 形或 T 形",
  "how.wrapped.effect": "清除它周围 3×3 的方块。",
  "how.super.name": "超级方块",
  "how.super.rule": "连成 5 个",
  "how.super.effect": "清除棋盘上所有同一角色的方块。",
  "how.specials.note": "特殊方块被再次消除，或被其他爆炸波及时会引爆，所以它们可以连锁。",
  "how.combos.title": "连击",
  "how.combos.body":
    "一次消除让方块落下并形成新的消除，就是一次连锁。每多一步，得分倍数增加 {step}（×1、×{two}、×{three}……），连锁消除的方块会闪金色而不是红色。玩的时候留意“连击”框。",
  "how.modes.title": "模式",
  "how.endless": "{s} 秒无尽模式：在倒计时结束前尽可能多地得分，最高分会被保存。",
  "how.level":
    "关卡模式：共 20 关，分为四个章节。每关有 1 到 3 个目标（达到分数、消除高亮角色、制造特殊方块或达成连锁）和步数限制，需要在步数用完前完成所有目标。剩余的每一步都会变成奖励爆破，最终得分决定 1、2 或 3 颗星。",
  "how.difficulty.title": "难度",
  "how.difficulty.body":
    "简单模式步数更多、目标更低；困难模式步数更少、目标更高。通关一个关卡会为所有难度解锁下一关，但星星和最高分在每个难度中分别记录。",
  "how.pause.title": "暂停",
  "how.pause.body": "随时点击“暂停”（或按 Esc）。游戏会精确地停在当下，点击“继续”后从同一时刻接着玩。",
  "how.soundNote": "方块音效可以在{link}中开关。",
  "how.soundNote.link": "设置",
  "how.galleryNote": "在{link}里认识所有角色。",
  "how.galleryNote.link": "图鉴",
  "how.disclaimer": "本作品为粉丝同人，和原作公司无关，所有角色版权归各自原作者",

  // ---- characters ----
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
};
