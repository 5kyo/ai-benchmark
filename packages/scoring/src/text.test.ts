import { describe, it, expect } from "vitest";
import { extractText } from "./text.js";

describe("extractText", () => {
  it("strips script/style and collapses whitespace", () => {
    const html = `<html><head><style>.a{}</style></head>
      <body><script>var x=1;</script><h1>Acme</h1>   <p>We build\n\n chains.</p></body></html>`;
    const t = extractText(html);
    expect(t).toContain("Acme");
    expect(t).toContain("We build chains.");
    expect(t).not.toContain("var x");
    expect(t).not.toContain(".a{}");
  });

  it("truncates to maxChars", () => {
    const html = `<body>${"a".repeat(500)}</body>`;
    expect(extractText(html, 100).length).toBe(100);
  });
});
