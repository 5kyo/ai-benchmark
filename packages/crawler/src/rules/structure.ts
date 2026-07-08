import * as cheerio from "cheerio";
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

const SEMANTIC_TAGS = ["header", "nav", "main", "article", "section", "footer"];

function m(metricKey: string, score: number, evidence?: string): MetricScore {
  return { axis: "B", metricKey, model: "rule-based", score, evidence };
}

function jsonLdScore($: cheerio.CheerioAPI): number {
  let valid = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      JSON.parse($(el).text());
      valid += 1;
    } catch {
      /* invalid JSON-LD ignored */
    }
  });
  return valid >= 1 ? 100 : 0;
}

function semanticRatioScore($: cheerio.CheerioAPI): number {
  const present = SEMANTIC_TAGS.filter((t) => $(t).length > 0).length;
  return Math.round((present / SEMANTIC_TAGS.length) * 100);
}

function metaCompletenessScore($: cheerio.CheerioAPI): number {
  const checks = [
    $("title").text().trim().length > 0,
    $('meta[name="description"]').attr("content")?.trim(),
    $('meta[property="og:title"]').attr("content")?.trim(),
    $('meta[property="og:description"]').attr("content")?.trim(),
  ].map(Boolean);
  const present = checks.filter(Boolean).length;
  return Math.round((present / checks.length) * 100);
}

function headingHierarchyScore($: cheerio.CheerioAPI): number {
  const h1 = $("h1").length;
  let score = 100;
  if (h1 !== 1) score -= 50; // 정확히 하나의 h1이 아니면 감점
  // 레벨 건너뜀 검사 (h1 없이 h2로 시작 등)
  const levels: number[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    levels.push(Number(el.tagName[1]));
  });
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      score -= 25;
      break;
    }
  }
  return Math.max(0, score);
}

function altCoverageScore($: cheerio.CheerioAPI): number {
  const imgs = $("img");
  if (imgs.length === 0) return 100;
  let withAlt = 0;
  imgs.each((_, el) => {
    if (($(el).attr("alt") ?? "").trim().length > 0) withAlt += 1;
  });
  return Math.round((withAlt / imgs.length) * 100);
}

export function scoreStructure(snap: RawSnapshot): MetricScore[] {
  const $ = cheerio.load(snap.homepage.body);
  return [
    m("json_ld_present", jsonLdScore($)),
    m("semantic_ratio", semanticRatioScore($)),
    m("meta_completeness", metaCompletenessScore($)),
    m("heading_hierarchy", headingHierarchyScore($)),
    m("alt_coverage", altCoverageScore($)),
  ];
}
