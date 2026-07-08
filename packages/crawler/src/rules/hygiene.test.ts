import { describe, it, expect } from "vitest";
import { scoreHygiene } from "./hygiene.js";
import type { RawSnapshot } from "../snapshot.js";
import type { FetchResult } from "../fetcher.js";

function homepage(over: Partial<FetchResult>): FetchResult {
  return { url: "https://t.example", status: 200, headers: {}, body: "", elapsedMs: 300, ...over };
}
function snap(over: Partial<FetchResult>, url = "https://t.example"): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: url, isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: { ...homepage(over), url },
    robots: null, sitemap: null, llmsTxt: null,
  };
}
function get(scores: ReturnType<typeof scoreHygiene>, key: string) {
  const s = scores.find((x) => x.metricKey === key);
  if (!s) throw new Error(`missing ${key}`);
  return s.score;
}

describe("scoreHygiene", () => {
  it("fast load (<=500ms) scores 100, slow (>=3000ms) scores 0", () => {
    expect(get(scoreHygiene(snap({ elapsedMs: 400 })), "load_time")).toBe(100);
    expect(get(scoreHygiene(snap({ elapsedMs: 3500 })), "load_time")).toBe(0);
  });

  it("mobile_ready requires a viewport meta tag", () => {
    const withVp = `<head><meta name="viewport" content="width=device-width"></head>`;
    const noVp = `<head></head>`;
    expect(get(scoreHygiene(snap({ body: withVp })), "mobile_ready")).toBe(100);
    expect(get(scoreHygiene(snap({ body: noVp })), "mobile_ready")).toBe(0);
  });

  it("https_secure is 100 for https, 0 for http", () => {
    expect(get(scoreHygiene(snap({}, "https://t.example")), "https_secure")).toBe(100);
    expect(get(scoreHygiene(snap({}, "http://t.example")), "https_secure")).toBe(0);
  });

  it("multilingual is 100 when hreflang alternates exist", () => {
    const body = `<head><link rel="alternate" hreflang="en" href="/en"></head>`;
    expect(get(scoreHygiene(snap({ body })), "multilingual")).toBe(100);
    expect(get(scoreHygiene(snap({ body: "<head></head>" })), "multilingual")).toBe(0);
  });

  it("emits exactly four axis-D rule-based metrics", () => {
    const s = scoreHygiene(snap({}));
    expect(s).toHaveLength(4);
    expect(s.every((x) => x.axis === "D" && x.model === "rule-based")).toBe(true);
  });
});
