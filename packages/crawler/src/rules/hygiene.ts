import * as cheerio from "cheerio";
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

function m(metricKey: string, score: number, evidence?: string): MetricScore {
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
  const load = loadTimeScore(snap.homepage.elapsedMs);
  const mobile = $('meta[name="viewport"]').length > 0 ? 100 : 0;
  const https = snap.company.homepageUrl.startsWith("https://") ? 100 : 0;
  const multilingual = $("link[rel='alternate'][hreflang]").length > 0 ? 100 : 0;

  return [
    m("load_time", load),
    m("mobile_ready", mobile),
    m("https_secure", https),
    m("multilingual", multilingual),
  ];
}
