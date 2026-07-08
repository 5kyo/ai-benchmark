import type { MetricScore } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";

function rule(axis: MetricScore["axis"], k: string, score: number): MetricScore {
  return { axis, metricKey: k, model: "rule-based", score };
}
function llm(k: string, model: string, score: number, evidence: string): MetricScore {
  return { axis: "C", metricKey: k, model, score, evidence };
}

/** 한 기업의 축 C 점수(두 모델)를 생성하는 헬퍼. */
function cScores(base: number, claudeDelta: number, gptDelta: number): MetricScore[] {
  const keys = ["clarity", "product_depth", "key_info_present", "freshness_clarity"];
  const out: MetricScore[] = [];
  keys.forEach((k, i) => {
    out.push(llm(k, "claude-opus-4-8", clamp(base + claudeDelta - i * 5), `Claude 근거: ${k}`));
    out.push(llm(k, "gpt-4o", clamp(base + gptDelta - i * 4), `GPT 근거: ${k}`));
  });
  return out;
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
function abd(a: Partial<Record<string, number>>): MetricScore[] {
  // 축 A/B/D 대표 지표에 점수 부여
  return [
    rule("A", "robots_allowed", a.robots ?? 100),
    rule("A", "sitemap_present", a.sitemap ?? 100),
    rule("A", "llms_txt_present", a.llms ?? 0),
    rule("A", "ssr_rendered", a.ssr ?? 100),
    rule("A", "not_bot_blocked", 100),
    rule("A", "pages_reachable", 100),
    rule("B", "json_ld_present", a.jsonld ?? 0),
    rule("B", "semantic_ratio", a.semantic ?? 67),
    rule("B", "meta_completeness", a.meta ?? 75),
    rule("B", "heading_hierarchy", a.heading ?? 100),
    rule("B", "alt_coverage", a.alt ?? 50),
    rule("D", "load_time", a.load ?? 80),
    rule("D", "mobile_ready", a.mobile ?? 100),
    rule("D", "https_secure", 100),
    rule("D", "multilingual", a.multi ?? 0),
  ];
}

export function fixtureCompanies(): CompanyRecord[] {
  return [
    {
      slug: "our-company", name: "우리회사", homepageUrl: "https://our.example", isSelf: true, category: "L1",
      scores: [...abd({ llms: 0, jsonld: 0, multi: 0 }), ...cScores(62, 6, -4)],
    },
    {
      slug: "chain-alpha", name: "체인알파", homepageUrl: "https://alpha.example", isSelf: false, category: "L1",
      scores: [...abd({ llms: 100, jsonld: 100, multi: 100, alt: 90 }), ...cScores(84, 4, 2)],
    },
    {
      slug: "block-beta", name: "블록베타", homepageUrl: "https://beta.example", isSelf: false, category: "DeFi",
      scores: [...abd({ sitemap: 0, ssr: 0, jsonld: 0, meta: 50 }), ...cScores(48, 8, -6)],
    },
    {
      slug: "ledger-gamma", name: "레저감마", homepageUrl: "https://gamma.example", isSelf: false, category: "Infra",
      scores: [...abd({ llms: 100, jsonld: 100, semantic: 100, multi: 100 }), ...cScores(73, 2, 10)],
    },
  ];
}
