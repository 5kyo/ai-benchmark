import type { CompanyConfig } from "./companies.js";
import type { Fetcher, FetchResult } from "./fetcher.js";

export interface RawSnapshot {
  company: CompanyConfig;
  scannedAt: string;
  homepage: FetchResult;
  robots: FetchResult | null;
  sitemap: FetchResult | null;
  llmsTxt: FetchResult | null;
}

function auxUrl(homepageUrl: string, path: string): string {
  return new URL(path, homepageUrl).toString();
}

export async function collectSnapshot(
  company: CompanyConfig,
  fetcher: Fetcher,
  now: () => string,
): Promise<RawSnapshot> {
  const [homepage, robots, sitemap, llmsTxt] = await Promise.all([
    fetcher.fetch(company.homepageUrl),
    fetcher.fetch(auxUrl(company.homepageUrl, "/robots.txt")),
    fetcher.fetch(auxUrl(company.homepageUrl, "/sitemap.xml")),
    fetcher.fetch(auxUrl(company.homepageUrl, "/llms.txt")),
  ]);
  return { company, scannedAt: now(), homepage, robots, sitemap, llmsTxt };
}
