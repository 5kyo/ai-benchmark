import { describe, it, expect } from "vitest";
import { collectSnapshot } from "./snapshot.js";
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
});
