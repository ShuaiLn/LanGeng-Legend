import { describe, expect, it } from "vitest";
import { CHARACTER_LIBRARY } from "../../config/characters";
import { computeLabelLayout } from "../labelFit";

describe("computeLabelLayout", () => {
  it("keeps short labels on one line", () => {
    expect(computeLabelLayout("奶龙", 60)).toMatchObject({ lines: 1, text: "奶龙" });
    expect(computeLabelLayout("mj", 60)).toMatchObject({ lines: 1, text: "mj" });
    expect(computeLabelLayout("蔡徐坤", 60)).toMatchObject({ lines: 1 });
  });

  it("splits longer labels into exactly two balanced lines", () => {
    expect(computeLabelLayout("美团袋鼠", 60).text).toBe("美团\n袋鼠");
    const five = computeLabelLayout("妙脆角小猫", 60);
    expect(five.lines).toBe(2);
    expect(five.text.replace("\n", "")).toBe("妙脆角小猫");
  });

  it("never needs more than 2 lines for any library character, at any cell size", () => {
    for (const size of [30, 40, 64, 96]) {
      for (const character of CHARACTER_LIBRARY) {
        expect(computeLabelLayout(character.label, size).lines).toBeLessThanOrEqual(2);
      }
    }
  });

  it("fits inside the cell: widest line and total height stay within the cell", () => {
    for (const size of [30, 40, 64, 96]) {
      for (const character of CHARACTER_LIBRARY) {
        const { text, fontSize, lines } = computeLabelLayout(character.label, size);
        const widest = Math.max(...text.split("\n").map((l) => [...l].length));
        // CJK glyphs are ~1em wide; the estimate is conservative for Latin text
        if (/[一-鿿]/.test(character.label)) expect(widest * fontSize).toBeLessThanOrEqual(size);
        expect(lines * fontSize * 1.2).toBeLessThanOrEqual(size);
      }
    }
  });

  it("shrinks as the cell shrinks but never below a legible floor", () => {
    const big = computeLabelLayout("妙脆角小猫", 96).fontSize;
    const small = computeLabelLayout("妙脆角小猫", 40).fontSize;
    expect(small).toBeLessThan(big);
    expect(computeLabelLayout("妙脆角小猫", 12).fontSize).toBeGreaterThanOrEqual(8);
  });
});
