import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

/** SPA 셸 여부 휴리스틱: 본문 텍스트가 충분하면 SSR로 간주. */
export function isServerRendered(html: string): boolean {
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return bodyText.length >= 200;
}

/** robots.txt에서 모든 에이전트에 대해 루트(/)가 Disallow 되는지. */
function rootDisallowedForAll(robotsBody: string): boolean {
  const lines = robotsBody.split(/\r?\n/).map((l) => l.trim().toLowerCase());
  let inStar = false;
  for (const line of lines) {
    if (line.startsWith("user-agent:")) inStar = line.includes("*");
    else if (inStar && line === "disallow: /") return true;
  }
  return false;
}

function m(metricKey: string, score: number, evidence?: string): MetricScore {
  return { axis: "A", metricKey, model: "rule-based", score, evidence };
}

export function scoreAccessibility(snap: RawSnapshot): MetricScore[] {
  const robotsOk = snap.robots?.status === 200 ? snap.robots.body : "";
  const robotsAllowed = rootDisallowedForAll(robotsOk) ? 0 : 100;
  const sitemap = snap.sitemap?.status === 200 ? 100 : 0;
  const llms = snap.llmsTxt?.status === 200 ? 100 : 0;
  const ssr = isServerRendered(snap.homepage.body) ? 100 : 0;
  const notBlocked = snap.homepage.status === 403 ? 0 : snap.homepage.status === 200 ? 100 : 50;
  const reachable = snap.homepage.status === 200 ? 100 : 0;

  return [
    m("robots_allowed", robotsAllowed),
    m("sitemap_present", sitemap),
    m("llms_txt_present", llms),
    m("ssr_rendered", ssr),
    m("not_bot_blocked", notBlocked),
    m("pages_reachable", reachable),
  ];
}
