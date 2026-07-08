import { describe, it, expect } from "vitest";
import { scoreAccessibility, isServerRendered } from "./accessibility.js";
import type { RawSnapshot } from "../snapshot.js";
import type { FetchResult } from "../fetcher.js";

function fr(status: number, body = "", url = "https://t.example"): FetchResult {
  return { url, status, headers: {}, body, elapsedMs: 10 };
}

function snap(over: Partial<RawSnapshot>): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: fr(200, "<html><body><h1>Hi</h1><p>content here</p></body></html>"),
    robots: fr(200, "User-agent: *\nAllow: /"),
    sitemap: fr(200, "<urlset/>"),
    llmsTxt: fr(200, "# llms"),
    ...over,
  };
}

function get(scores: ReturnType<typeof scoreAccessibility>, key: string) {
  const m = scores.find((s) => s.metricKey === key);
  if (!m) throw new Error(`missing metric ${key}`);
  return m.score;
}

describe("isServerRendered", () => {
  it("true when body has substantial text", () => {
    expect(isServerRendered("<body><p>" + "word ".repeat(80) + "</p></body>")).toBe(true);
  });
  it("false for empty SPA shell", () => {
    expect(isServerRendered('<body><div id="__next"></div><script src="app.js"></script></body>')).toBe(false);
  });
});

describe("scoreAccessibility", () => {
  it("gives full marks for a well-configured site", () => {
    const scores = scoreAccessibility(snap({}));
    expect(get(scores, "sitemap_present")).toBe(100);
    expect(get(scores, "llms_txt_present")).toBe(100);
    expect(get(scores, "not_bot_blocked")).toBe(100);
    expect(get(scores, "pages_reachable")).toBe(100);
    expect(get(scores, "robots_allowed")).toBe(100);
  });

  it("scores 0 for missing sitemap/llms and a 403 homepage", () => {
    const scores = scoreAccessibility(
      snap({ sitemap: fr(404), llmsTxt: fr(404), homepage: fr(403, "") }),
    );
    expect(get(scores, "sitemap_present")).toBe(0);
    expect(get(scores, "llms_txt_present")).toBe(0);
    expect(get(scores, "not_bot_blocked")).toBe(0);
    expect(get(scores, "pages_reachable")).toBe(0);
  });

  it("robots_allowed is 0 when root is disallowed for all agents", () => {
    const scores = scoreAccessibility(snap({ robots: fr(200, "User-agent: *\nDisallow: /") }));
    expect(get(scores, "robots_allowed")).toBe(0);
  });

  it("emits exactly six axis-A rule-based metrics", () => {
    const scores = scoreAccessibility(snap({}));
    expect(scores).toHaveLength(6);
    expect(scores.every((s) => s.axis === "A" && s.model === "rule-based")).toBe(true);
  });
});
