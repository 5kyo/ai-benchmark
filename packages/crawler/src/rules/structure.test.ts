import { describe, it, expect } from "vitest";
import { scoreStructure } from "./structure.js";
import type { RawSnapshot } from "../snapshot.js";
import type { FetchResult } from "../fetcher.js";

function homepage(body: string): FetchResult {
  return { url: "https://t.example", status: 200, headers: {}, body, elapsedMs: 10 };
}
function snap(body: string): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: homepage(body),
    robots: null, sitemap: null, llmsTxt: null,
  };
}
function get(scores: ReturnType<typeof scoreStructure>, key: string) {
  const s = scores.find((x) => x.metricKey === key);
  if (!s) throw new Error(`missing ${key}`);
  return s.score;
}

const RICH = `<html lang="ko"><head>
  <title>Acme</title>
  <meta name="description" content="d">
  <meta property="og:title" content="Acme">
  <meta property="og:description" content="d">
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head><body>
  <header></header><nav></nav>
  <main><article><section>
    <h1>Acme</h1><h2>Product</h2>
    <img src="a.png" alt="a"><img src="b.png" alt="b">
  </section></article></main>
  <footer></footer>
</body></html>`;

describe("scoreStructure", () => {
  it("gives full json_ld and meta marks for a rich page", () => {
    const s = scoreStructure(snap(RICH));
    expect(get(s, "json_ld_present")).toBe(100);
    expect(get(s, "meta_completeness")).toBe(100);
    expect(get(s, "alt_coverage")).toBe(100);
    expect(get(s, "heading_hierarchy")).toBe(100);
  });

  it("json_ld_present is 0 when absent", () => {
    const s = scoreStructure(snap("<html><head><title>x</title></head><body><p>hi</p></body></html>"));
    expect(get(s, "json_ld_present")).toBe(0);
  });

  it("alt_coverage reflects fraction of images with alt", () => {
    const body = `<body><img src="a" alt="a"><img src="b"></body>`;
    const s = scoreStructure(snap(body));
    expect(get(s, "alt_coverage")).toBe(50);
  });

  it("alt_coverage is 100 when there are no images", () => {
    const s = scoreStructure(snap("<body><p>no images</p></body>"));
    expect(get(s, "alt_coverage")).toBe(100);
  });

  it("alt_coverage excludes images inside an aria-hidden ancestor", () => {
    // 마퀴·캐러셀은 같은 로고를 한 벌 더 깔고 그 사본을 aria-hidden으로 감춘다.
    // 사본의 alt=""는 올바른 마크업이므로 분모에 넣으면 안 된다.
    const body = `<body><img src="a" alt="a">
      <span aria-hidden="true"><img src="a" alt=""></span></body>`;
    expect(get(scoreStructure(snap(body)), "alt_coverage")).toBe(100);
  });

  it("alt_coverage excludes role=presentation images", () => {
    const body = `<body><img src="a" alt="a"><img src="deco" role="presentation" alt=""></body>`;
    expect(get(scoreStructure(snap(body)), "alt_coverage")).toBe(100);
  });

  it("alt_coverage still penalizes a content image left with an empty alt", () => {
    const body = `<body><img src="a" alt="a"><img src="hero" alt=""></body>`;
    expect(get(scoreStructure(snap(body)), "alt_coverage")).toBe(50);
  });

  it("alt_coverage is 100 when every image is declared decorative", () => {
    const body = `<body><span aria-hidden="true"><img src="a" alt=""></span></body>`;
    expect(get(scoreStructure(snap(body)), "alt_coverage")).toBe(100);
  });

  it("heading_hierarchy penalizes missing or multiple h1", () => {
    const s = scoreStructure(snap("<body><h2>no h1</h2><h3>x</h3></body>"));
    expect(get(s, "heading_hierarchy")).toBeLessThan(100);
  });

  it("emits exactly five axis-B rule-based metrics", () => {
    const s = scoreStructure(snap(RICH));
    expect(s).toHaveLength(5);
    expect(s.every((x) => x.axis === "B" && x.model === "rule-based")).toBe(true);
  });
});
