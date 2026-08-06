import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

/** 본문 텍스트 길이(스크립트/스타일/태그 제거 후). */
function bodyTextLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** SPA 셸 여부 휴리스틱: 본문 텍스트가 충분하면 SSR로 간주. */
export function isServerRendered(html: string): boolean {
  return bodyTextLength(html) >= 200;
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

function m(metricKey: string, score: number, evidence: string): MetricScore {
  return { axis: "A", metricKey, model: "rule-based", score, evidence };
}

export function scoreAccessibility(snap: RawSnapshot): MetricScore[] {
  const robotsPresent = snap.robots?.status === 200;
  const robotsBody = robotsPresent ? snap.robots!.body : "";
  const disallowed = rootDisallowedForAll(robotsBody);
  const robotsAllowed = disallowed ? 0 : 100;
  const sitemap = snap.sitemap?.status === 200 ? 100 : 0;
  const llms = snap.llmsTxt?.status === 200 ? 100 : 0;
  const textLen = bodyTextLength(snap.homepage.body);
  const ssr = textLen >= 200 ? 100 : 0;
  const status = snap.homepage.status;
  const notBlocked = status === 403 ? 0 : status === 200 ? 100 : 50;
  const reachable = status === 200 ? 100 : 0;

  return [
    m(
      "robots_allowed",
      robotsAllowed,
      disallowed
        ? "robots.txt가 모든 봇의 루트(/) 접근을 차단합니다."
        : robotsPresent
          ? "robots.txt가 존재하며 크롤러 접근을 막지 않습니다."
          : "robots.txt가 없어 기본 허용으로 간주합니다."
    ),
    m(
      "sitemap_present",
      sitemap,
      sitemap
        ? // 어느 경로에서 찾았는지 남긴다 — /sitemap.xml 외에 sitemap-index.xml 등도 후보라
          // 근거만 보고 "왜 만점인지" 판단할 수 있어야 한다.
          `sitemap을 정상(200) 제공합니다 (${new URL(snap.sitemap!.url).pathname}).`
        : "sitemap을 찾지 못했습니다(robots.txt의 Sitemap 지시자·관례 경로 모두 확인)."
    ),
    m("llms_txt_present", llms, llms ? "/llms.txt를 제공합니다." : "/llms.txt가 없습니다(404 등)."),
    m(
      "ssr_rendered",
      ssr,
      ssr
        ? `서버 응답 HTML에 본문 약 ${textLen.toLocaleString()}자가 담겨 있어 SSR로 판단합니다.`
        : `서버 응답 본문이 약 ${textLen.toLocaleString()}자로 빈약해 JS 렌더링 의존으로 추정합니다.`
    ),
    m(
      "not_bot_blocked",
      notBlocked,
      status === 403
        ? "봇 User-Agent를 403으로 차단합니다."
        : status === 200
          ? "봇 차단 없이 정상(200) 응답합니다."
          : `비정상 응답(status ${status})입니다.`
    ),
    m(
      "pages_reachable",
      reachable,
      reachable ? "홈페이지가 정상(200) 응답합니다." : `홈페이지 응답 실패(status ${status})입니다.`
    ),
  ];
}
