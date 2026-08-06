import { describe, it, expect } from "vitest";
import { collectSnapshot, sitemapCandidates } from "./snapshot.js";
import type { CompanyConfig } from "./companies.js";
import type { Fetcher, FetchResult } from "./fetcher.js";

const company: CompanyConfig = {
  name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false,
};

function ok(url: string, body = "ok"): FetchResult {
  return { url, status: 200, headers: {}, body, elapsedMs: 10 };
}

class FakeFetcher implements Fetcher {
  constructor(private map: Record<string, FetchResult>) {}
  async fetch(url: string): Promise<FetchResult> {
    return this.map[url] ?? { url, status: 404, headers: {}, body: "", elapsedMs: 5 };
  }
}

const now = () => "2026-07-08T00:00:00.000Z";

describe("collectSnapshot", () => {
  it("fetches homepage + robots + sitemap + llms.txt at derived URLs", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
      "https://t.example/robots.txt": ok("https://t.example/robots.txt", "User-agent: *"),
      "https://t.example/sitemap.xml": ok("https://t.example/sitemap.xml", "<urlset/>"),
      "https://t.example/llms.txt": ok("https://t.example/llms.txt", "# llms"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.homepage.body).toContain("home");
    expect(snap.robots?.status).toBe(200);
    expect(snap.sitemap?.status).toBe(200);
    expect(snap.llmsTxt?.status).toBe(200);
    expect(snap.scannedAt).toBe("2026-07-08T00:00:00.000Z");
  });

  it("sets aux resources to a result object even when missing (status 404)", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.robots?.status).toBe(404);
    expect(snap.llmsTxt?.status).toBe(404);
  });

  it("finds sitemap-index.xml when /sitemap.xml is absent (Astro·Next 관례)", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
      "https://t.example/robots.txt": ok("https://t.example/robots.txt", "User-agent: *"),
      "https://t.example/sitemap-index.xml": ok("https://t.example/sitemap-index.xml", "<sitemapindex/>"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.sitemap?.status).toBe(200);
    expect(snap.sitemap?.url).toBe("https://t.example/sitemap-index.xml");
  });

  it("prefers the Sitemap: directive declared in robots.txt", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
      "https://t.example/robots.txt": ok(
        "https://t.example/robots.txt",
        "User-agent: *\nAllow: /\nSitemap: https://t.example/custom/sm.xml",
      ),
      "https://t.example/custom/sm.xml": ok("https://t.example/custom/sm.xml", "<urlset/>"),
      "https://t.example/sitemap.xml": ok("https://t.example/sitemap.xml", "<urlset/>"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.sitemap?.url).toBe("https://t.example/custom/sm.xml");
  });

  it("records the failed attempt when no candidate responds 200", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.sitemap?.status).toBe(404);
  });
});

describe("sitemapCandidates", () => {
  it("puts robots.txt declarations first, then the conventional paths", () => {
    const c = sitemapCandidates("https://t.example/", "Sitemap: https://t.example/a.xml");
    expect(c[0]).toBe("https://t.example/a.xml");
    expect(c).toContain("https://t.example/sitemap.xml");
    expect(c).toContain("https://t.example/sitemap-index.xml");
    expect(c).toContain("https://t.example/sitemap_index.xml");
  });

  it("resolves a relative Sitemap: value against the homepage", () => {
    expect(sitemapCandidates("https://t.example/", "sitemap: /sm/all.xml")[0]).toBe(
      "https://t.example/sm/all.xml",
    );
  });

  it("de-duplicates a declaration that repeats a conventional path", () => {
    const c = sitemapCandidates("https://t.example/", "Sitemap: https://t.example/sitemap.xml");
    expect(c.filter((u) => u.endsWith("/sitemap.xml"))).toHaveLength(1);
  });
});
