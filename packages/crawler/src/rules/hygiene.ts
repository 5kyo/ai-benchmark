import * as cheerio from "cheerio";
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

function m(metricKey: string, score: number, evidence: string): MetricScore {
  return { axis: "D", metricKey, model: "rule-based", score, evidence };
}

/** 500ms 이하 100점, 3000ms 이상 0점, 사이는 선형 보간. */
function loadTimeScore(elapsedMs: number): number {
  const fast = 500;
  const slow = 3000;
  if (elapsedMs <= fast) return 100;
  if (elapsedMs >= slow) return 0;
  return Math.round(100 * (1 - (elapsedMs - fast) / (slow - fast)));
}

export function scoreHygiene(snap: RawSnapshot): MetricScore[] {
  const $ = cheerio.load(snap.homepage.body);
  const ms = snap.homepage.elapsedMs;
  const load = loadTimeScore(ms);
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const https = snap.company.homepageUrl.startsWith("https://");
  const hreflang = $("link[rel='alternate'][hreflang]").length;

  return [
    m("load_time", load, `홈페이지 응답에 약 ${Math.round(ms).toLocaleString()}ms 걸렸습니다.`),
    m(
      "mobile_ready",
      hasViewport ? 100 : 0,
      hasViewport ? "viewport 메타 태그가 있어 모바일 대응이 됩니다." : "viewport 메타 태그가 없습니다."
    ),
    m(
      "https_secure",
      https ? 100 : 0,
      https ? "HTTPS 보안 연결을 사용합니다." : "HTTPS를 사용하지 않습니다."
    ),
    m(
      "multilingual",
      hreflang > 0 ? 100 : 0,
      hreflang > 0
        ? `hreflang 대체 링크 ${hreflang}개로 다국어를 명시합니다.`
        : "hreflang 다국어 표기가 없습니다."
    ),
  ];
}
