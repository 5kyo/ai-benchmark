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

/**
 * sitemap 관례 경로. 프레임워크마다 다르다 —
 * Astro·Next.js는 sitemap-index.xml, WordPress SEO 플러그인은 sitemap_index.xml을 낸다.
 * /sitemap.xml 하나만 확인하면 sitemap을 제대로 갖춘 사이트를 "없음"으로 오판한다.
 */
const SITEMAP_PATHS = ["/sitemap.xml", "/sitemap-index.xml", "/sitemap_index.xml"];

/**
 * 확인할 sitemap URL 목록을 우선순위대로 만든다.
 * robots.txt의 `Sitemap:` 지시자가 표준 발견 경로이므로 먼저 오고, 그다음이 관례 경로다.
 */
export function sitemapCandidates(homepageUrl: string, robotsBody: string): string[] {
  const declared = robotsBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^sitemap\s*:/i.test(line))
    .map((line) => line.slice(line.indexOf(":") + 1).trim())
    .filter(Boolean)
    .flatMap((value) => {
      // 상대 경로로 적는 사이트도 있다. 절대 URL로 정규화하고, 파싱 불가면 버린다.
      try {
        return [new URL(value, homepageUrl).toString()];
      } catch {
        return [];
      }
    });
  return [...new Set([...declared, ...SITEMAP_PATHS.map((p) => auxUrl(homepageUrl, p))])];
}

/** 후보를 순서대로 훑어 첫 200을 반환한다. 전부 실패하면 첫 시도 결과(=404 기록)를 남긴다. */
async function findSitemap(
  fetcher: Fetcher,
  candidates: string[],
): Promise<FetchResult | null> {
  let first: FetchResult | null = null;
  for (const url of candidates) {
    const res = await fetcher.fetch(url);
    first ??= res;
    if (res.status === 200) return res;
  }
  return first;
}

export async function collectSnapshot(
  company: CompanyConfig,
  fetcher: Fetcher,
  now: () => string,
): Promise<RawSnapshot> {
  const [homepage, robots, llmsTxt] = await Promise.all([
    fetcher.fetch(company.homepageUrl),
    fetcher.fetch(auxUrl(company.homepageUrl, "/robots.txt")),
    fetcher.fetch(auxUrl(company.homepageUrl, "/llms.txt")),
  ]);
  // sitemap은 robots.txt를 읽은 뒤에야 어디를 볼지 정해지므로 병렬 묶음 밖이다.
  const sitemap = await findSitemap(
    fetcher,
    sitemapCandidates(company.homepageUrl, robots.status === 200 ? robots.body : ""),
  );
  return { company, scannedAt: now(), homepage, robots, sitemap, llmsTxt };
}
