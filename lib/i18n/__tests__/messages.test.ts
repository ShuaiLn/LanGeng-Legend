import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LEVEL_DEFS } from "@/game/config/levels";
import { en } from "../messages/en";
import { zh } from "../messages/zh";
import {
  calloutLabel,
  characterName,
  htmlLang,
  interpolate,
  isLang,
  MESSAGES,
  plural,
  t,
  type MessageKey,
} from "..";
import { COMBO_MEME_POOL, LEVEL_CLEAR_CALLOUT } from "@/game/config/callouts";
import { CHARACTER_LIBRARY } from "@/game/config/characters";

const root = path.resolve(__dirname, "../../..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const UI_FILES = [...sourceFiles("components"), ...sourceFiles("app")];
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const enKeys = Object.keys(en) as MessageKey[];
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe("dictionaries", () => {
  it("English and Chinese have exactly the same keys", () => {
    expect(Object.keys(zh).sort()).toEqual([...enKeys].sort());
  });

  it("has no empty message in either language", () => {
    for (const key of enKeys) {
      expect(en[key].trim(), `en ${key}`).not.toBe("");
      expect(zh[key].trim(), `zh ${key}`).not.toBe("");
    }
  });

  it("uses the same {placeholders} in both languages for every key", () => {
    for (const key of enKeys) expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]));
  });

  it("keeps the plural pairs together and in step", () => {
    const bases = enKeys.filter((k) => k.endsWith(".one")).map((k) => k.slice(0, -4));
    expect(bases.length).toBeGreaterThan(0);
    for (const base of bases) {
      expect(enKeys, base).toContain(`${base}.other`);
      expect(placeholders(en[`${base}.one` as MessageKey]), base).toEqual(placeholders(en[`${base}.other` as MessageKey]));
    }
  });

  it("keeps the content that is verbatim in both languages", () => {
    expect(zh["footer.credit"]).toBe("Developed by Ning");
    expect(en["footer.credit"]).toBe("Developed by Ning");
    for (const character of CHARACTER_LIBRARY) {
      expect(en[`char.${character.id}` as MessageKey], character.id).toBe(character.label);
      expect(zh[`char.${character.id}` as MessageKey], character.id).toBe(character.label);
    }
  });

  it("keeps the fan-work disclaimer in Chinese and gives English readers a counterpart", () => {
    expect(zh["how.disclaimer"]).toBe("本作品为粉丝同人，和原作公司无关，所有角色版权归各自原作者");
    expect(en["how.disclaimer"]).toMatch(/fan work/i);
  });
});

describe("keys used in the source", () => {
  const literalKeys = new Map<string, string[]>(); // key -> files using it
  const dynamicPrefixes = new Set<string>(); // `diff.${...}` style families
  const note = (key: string, file: string) => literalKeys.set(key, [...(literalKeys.get(key) ?? []), file]);

  for (const file of UI_FILES) {
    const source = read(file);
    for (const m of source.matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g)) note(m[1], file);
    for (const m of source.matchAll(/\btitleKey=["']([\w.]+)["']/g)) note(m[1], file);
    for (const m of source.matchAll(/plural\([^,]+,\s*["']([\w.]+)["'],\s*["']([\w.]+)["']/g)) {
      note(m[1], file);
      note(m[2], file);
    }
    for (const m of source.matchAll(/`([a-zA-Z]+(?:\.[a-zA-Z]+)*\.)\$\{/g)) dynamicPrefixes.add(m[1]);
    for (const m of source.matchAll(/`(\w+\.)\$\{[^}]+\}(\.\w+)`/g)) dynamicPrefixes.add(m[1]);
  }
  // keys that live in data, not in a component: a level's hint
  for (const def of LEVEL_DEFS) if (def.hintKey) note(def.hintKey, "game/config/levels.ts");

  it("finds a healthy number of literal keys (the scan itself works)", () => {
    expect(literalKeys.size).toBeGreaterThan(100);
  });

  it("only refers to keys that exist in English", () => {
    for (const [key, files] of literalKeys) expect(enKeys, `${key} (${files[0]})`).toContain(key);
  });

  it("every key of a dynamic family exists (diff.*, chapter.*, goal.*, ...)", () => {
    for (const prefix of dynamicPrefixes) {
      expect(enKeys.some((key) => key.startsWith(prefix)), `no keys under ${prefix}`).toBe(true);
    }
  });

  it("has every key that a hint or a dynamic lookup can produce", () => {
    for (const d of ["easy", "normal", "hard"]) {
      expect(enKeys).toContain(`diff.${d}`);
      expect(enKeys).toContain(`diff.${d}.desc`);
    }
    for (const chapter of [1, 2, 3, 4]) expect(enKeys).toContain(`chapter.${chapter}`);
    for (const type of ["score", "collect", "chain"]) expect(enKeys).toContain(`goal.${type}`);
    expect(enKeys).toContain("goal.specials.one");
    expect(enKeys).toContain("goal.specials.other");
    for (const type of ["score", "collect", "specials", "chain"]) expect(enKeys).toContain(`goalShort.${type}`);
    for (const character of CHARACTER_LIBRARY) expect(enKeys).toContain(`char.${character.id}`);
  });

  it("has no unused keys (a dictionary that only grows stops being a source of truth)", () => {
    const used = (key: string) =>
      literalKeys.has(key) ||
      [...dynamicPrefixes].some((prefix) => key.startsWith(prefix)) ||
      key.startsWith("system.") || // sent by the scene as a key
      key.startsWith("char."); // looked up by characterName()
    expect(enKeys.filter((key) => !used(key))).toEqual([]);
  });

  it("does not hard-code English sentences in JSX text (the strings live in the dictionaries)", () => {
    // a rough guard: >>text with two or more capitalised English words in a row<< between tags
    const offenders: string[] = [];
    for (const file of UI_FILES) {
      const source = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(?<![:"'`])\/\/[^\n]*/g, "");
      for (const m of source.matchAll(/>\s*([A-Z][a-z]+(?:\s+[A-Za-z]+){1,6}[.!?]?)\s*</g)) {
        if (m[1] !== "Meme Match") offenders.push(`${file}: ${m[1]}`); // the brand name is not translated
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("t", () => {
  it("returns the message in the asked language", () => {
    expect(t("en", "menu.play")).toBe("Play");
    expect(t("zh", "menu.play")).toBe("开始游戏");
  });

  it("interpolates {name} placeholders, numbers included, and leaves an unknown one visible", () => {
    expect(t("en", "levels.levelN", { n: 7 })).toBe("Level 7");
    expect(t("zh", "levels.levelN", { n: 7 })).toBe("第 7 关");
    expect(interpolate("Hello {who}, {missing}", { who: "Ning" })).toBe("Hello Ning, {missing}");
    expect(interpolate("plain")).toBe("plain");
  });

  it("falls back zh -> en -> the key itself", () => {
    const saved = MESSAGES.zh["menu.play"];
    delete MESSAGES.zh["menu.play"];
    try {
      expect(t("zh", "menu.play")).toBe("Play"); // English fills the gap
    } finally {
      MESSAGES.zh["menu.play"] = saved;
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(t("en", "no.such.key" as MessageKey)).toBe("no.such.key");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("picks the plural key that fits the count", () => {
    expect(plural(1, "error.assets.one", "error.assets.other")).toBe("error.assets.one");
    expect(plural(0, "error.assets.one", "error.assets.other")).toBe("error.assets.other");
    expect(plural(3, "error.assets.one", "error.assets.other")).toBe("error.assets.other");
    expect(t("en", plural(1, "error.assets.one", "error.assets.other"), { n: 1 })).toMatch(/^1 asset could/);
    expect(t("en", plural(2, "error.assets.one", "error.assets.other"), { n: 2 })).toMatch(/^2 assets could/);
  });
});

describe("languages", () => {
  it("knows what a language is, and its html lang code", () => {
    expect(isLang("en")).toBe(true);
    expect(isLang("zh")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(htmlLang("zh")).toBe("zh-CN");
    expect(htmlLang("en")).toBe("en");
  });
});

describe("characterName", () => {
  it("uses the dictionary for library characters and the given label for anything else (the custom tile)", () => {
    expect(characterName("en", "nailong", "x")).toBe("奶龙");
    expect(characterName("zh", "sixseven", "x")).toBe("67");
    expect(characterName("en", "custom", "My tile")).toBe("My tile");
  });
});

describe("callout text", () => {
  it("renders a keyed callout through t() in the current language (the scene ships no copy)", () => {
    expect(calloutLabel("en", { text: "fallback", key: "system.reshuffle" })).toBe("No moves left — reshuffling!");
    expect(calloutLabel("zh", { text: "No moves left — reshuffling!", key: "system.reshuffle" })).toBe(
      "没有可消除的了，重新洗牌！"
    );
  });

  it("shows every combo phrase verbatim in both languages (memes are not translated)", () => {
    for (const text of COMBO_MEME_POOL) {
      expect(calloutLabel("en", { text })).toBe(text);
      expect(calloutLabel("zh", { text })).toBe(text);
    }
  });

  it("keeps the combo phrases and Clear！！ out of the dictionaries: they live in game/config/callouts.ts", () => {
    const shouts = [...COMBO_MEME_POOL, LEVEL_CLEAR_CALLOUT] as string[];
    for (const dictionary of [en, zh] as Record<string, string>[]) {
      for (const [key, value] of Object.entries(dictionary)) {
        for (const shout of shouts) expect(value, `${key} contains ${shout}`).not.toContain(shout);
      }
    }
    for (const key of ["banner.clear", "callout.combo", "result.clear.title"]) {
      expect(enKeys, key).not.toContain(key);
      expect(Object.keys(zh), key).not.toContain(key);
    }
  });

  it("leaves verbatim content (scores, meme phrases, BOOM!) untouched in every language", () => {
    for (const text of ["+120", "哎哟，你干嘛！", "AWSL", "BOOM!"]) {
      expect(calloutLabel("en", { text })).toBe(text);
      expect(calloutLabel("zh", { text })).toBe(text);
    }
  });
});
