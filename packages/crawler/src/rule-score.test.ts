import { describe, it, expect } from "vitest";
import { scoreRules, deriveImprovements } from "./rule-score.js";
import type { RawSnapshot } from "./snapshot.js";
import type { FetchResult } from "./fetcher.js";

function fr(status: number, body = "", url = "https://t.example", elapsedMs = 300): FetchResult {
  return { url, status, headers: {}, body, elapsedMs };
}
const goodBody = `<html lang="ko"><head><title>Acme</title>
  <meta name="description" content="d"><meta property="og:title" content="a">
  <meta property="og:description" content="d"><meta name="viewport" content="width=device-width">
  <script type="application/ld+json">{"@type":"Organization"}</script>
  <link rel="alternate" hreflang="en" href="/en"></head>
  <body><header></header><nav></nav><main><article><section>
  <h1>Acme</h1><h2>P</h2><img src="a" alt="a"></section></article></main><footer></footer>
  <p>${"content ".repeat(60)}</p></body></html>`;

function snap(over: Partial<RawSnapshot> = {}): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: fr(200, goodBody),
    robots: fr(200, "User-agent: *\nAllow: /"),
    sitemap: fr(200, "<urlset/>"),
    llmsTxt: fr(200, "# llms"),
    ...over,
  };
}

describe("scoreRules", () => {
  it("combines all three rule axes into 15 metrics", () => {
    const scores = scoreRules(snap());
    expect(scores).toHaveLength(15);
    expect(new Set(scores.map((s) => s.axis))).toEqual(new Set(["A", "B", "D"]));
    expect(scores.every((s) => s.model === "rule-based")).toBe(true);
  });
});

describe("deriveImprovements", () => {
  it("creates one improvement per sub-100 metric with severity = 100 - score", () => {
    const withGaps = scoreRules(snap({ sitemap: fr(404), llmsTxt: fr(404) }));
    const imps = deriveImprovements(withGaps);
    const sitemap = imps.find((i) => i.metricKey === "sitemap_present");
    expect(sitemap).toBeDefined();
    expect(sitemap!.severity).toBe(100);
    expect(imps.every((i) => i.severity > 0)).toBe(true);
  });

  it("produces no improvements for a perfect page", () => {
    const perfect = scoreRules(snap({ homepage: fr(200, goodBody, "https://t.example", 200) }));
    const imps = deriveImprovements(perfect);
    expect(imps).toHaveLength(0);
  });
});
