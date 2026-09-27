import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Footer, { FOOTER_LINES } from "@/components/Footer";
import { zh } from "@/lib/i18n/messages/zh";

describe("footer copy", () => {
  it("has exactly the two required lines", () => {
    expect(FOOTER_LINES).toEqual([
      "If there is any copyright infringement, please contact ShuaiLn@gmail.com and it will be addressed immediately.",
      "Developed by Ning",
    ]);
  });

  it("renders them as two separate block elements, never one joined string (Chinese is the default language)", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
    expect(paragraphs).toEqual([zh["footer.copyright"], FOOTER_LINES[1]]);
    expect(html).toMatch(/^<footer/);
    // the first line does not swallow the second
    expect(paragraphs[0]).not.toContain("Developed by Ning");
  });
});
