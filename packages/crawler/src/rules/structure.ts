import * as cheerio from "cheerio";
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

const SEMANTIC_TAGS = ["header", "nav", "main", "article", "section", "footer"];

interface Scored {
  score: number;
  evidence: string;
}

function m(metricKey: string, s: Scored): MetricScore {
  return { axis: "B", metricKey, model: "rule-based", score: s.score, evidence: s.evidence };
}

function jsonLdScore($: cheerio.CheerioAPI): Scored {
  let valid = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      JSON.parse($(el).text());
      valid += 1;
    } catch {
      /* invalid JSON-LD ignored */
    }
  });
  return {
    score: valid >= 1 ? 100 : 0,
    evidence: valid >= 1 ? `JSON-LD 블록 ${valid}개를 발견했습니다.` : "JSON-LD 구조화 데이터가 없습니다.",
  };
}

function semanticRatioScore($: cheerio.CheerioAPI): Scored {
  const present = SEMANTIC_TAGS.filter((t) => $(t).length > 0);
  const missing = SEMANTIC_TAGS.filter((t) => $(t).length === 0);
  return {
    score: Math.round((present.length / SEMANTIC_TAGS.length) * 100),
    evidence: `시맨틱 태그 ${SEMANTIC_TAGS.length}개 중 ${present.length}개 사용${
      missing.length ? ` (누락: ${missing.join(", ")})` : ""
    }.`,
  };
}

function metaCompletenessScore($: cheerio.CheerioAPI): Scored {
  const items: [string, boolean][] = [
    ["title", $("title").text().trim().length > 0],
    ["description", Boolean($('meta[name="description"]').attr("content")?.trim())],
    ["og:title", Boolean($('meta[property="og:title"]').attr("content")?.trim())],
    ["og:description", Boolean($('meta[property="og:description"]').attr("content")?.trim())],
  ];
  const present = items.filter(([, ok]) => ok).length;
  const missing = items.filter(([, ok]) => !ok).map(([k]) => k);
  return {
    score: Math.round((present / items.length) * 100),
    evidence: `메타 ${items.length}개 중 ${present}개 존재${missing.length ? ` (누락: ${missing.join(", ")})` : ""}.`,
  };
}

function headingHierarchyScore($: cheerio.CheerioAPI): Scored {
  const h1 = $("h1").length;
  let score = 100;
  if (h1 !== 1) score -= 50; // 정확히 하나의 h1이 아니면 감점
  const levels: number[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    levels.push(Number(el.tagName[1]));
  });
  let skipped = false;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      score -= 25;
      skipped = true;
      break;
    }
  }
  const notes = [
    h1 === 1 ? "h1 정확히 1개" : `h1 ${h1}개(1개 권장)`,
    skipped ? "제목 레벨 건너뜀 있음" : "레벨 건너뜀 없음",
  ];
  return { score: Math.max(0, score), evidence: `${notes.join(", ")}.` };
}

function altCoverageScore($: cheerio.CheerioAPI): Scored {
  const imgs = $("img");
  if (imgs.length === 0) return { score: 100, evidence: "이미지가 없어 감점 대상이 아닙니다." };
  let withAlt = 0;
  imgs.each((_, el) => {
    if (($(el).attr("alt") ?? "").trim().length > 0) withAlt += 1;
  });
  return {
    score: Math.round((withAlt / imgs.length) * 100),
    evidence: `이미지 ${imgs.length}개 중 ${withAlt}개에 alt 텍스트가 있습니다.`,
  };
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
