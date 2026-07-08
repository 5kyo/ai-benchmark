import type { Axis, MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "./snapshot.js";
import { scoreAccessibility } from "./rules/accessibility.js";
import { scoreStructure } from "./rules/structure.js";
import { scoreHygiene } from "./rules/hygiene.js";

export function scoreRules(snap: RawSnapshot): MetricScore[] {
  return [...scoreAccessibility(snap), ...scoreStructure(snap), ...scoreHygiene(snap)];
}

export interface Improvement {
  axis: Axis;
  metricKey: string;
  severity: number;
  message: string;
  suggestion: string;
}

const SUGGESTIONS: Record<string, string> = {
  robots_allowed: "robots.txt에서 크롤러 접근을 허용하세요.",
  sitemap_present: "sitemap.xml을 추가해 주요 페이지를 노출하세요.",
  llms_txt_present: "llms.txt를 추가해 AI 에이전트용 안내를 제공하세요.",
  ssr_rendered: "핵심 콘텐츠를 서버 렌더링(SSR)하거나 정적으로 제공하세요.",
  not_bot_blocked: "봇 차단(403)을 완화해 정상 크롤러 접근을 허용하세요.",
  pages_reachable: "홈페이지가 200으로 응답하도록 가용성을 확보하세요.",
  json_ld_present: "Schema.org JSON-LD 구조화 데이터를 추가하세요.",
  semantic_ratio: "header/nav/main/article/section/footer 시맨틱 태그를 사용하세요.",
  meta_completeness: "title·description·og 태그를 채우세요.",
  heading_hierarchy: "정확히 하나의 h1과 순차적 heading 계층을 유지하세요.",
  alt_coverage: "이미지에 의미 있는 alt 텍스트를 추가하세요.",
  load_time: "페이지 로드 시간을 줄이세요.",
  mobile_ready: "viewport 메타 태그로 모바일 대응을 하세요.",
  https_secure: "HTTPS로 서비스하세요.",
  multilingual: "hreflang로 다국어(한/영) 대응을 명시하세요.",
};

export function deriveImprovements(scores: MetricScore[]): Improvement[] {
  return scores
    .filter((s) => s.score < 100)
    .map((s) => ({
      axis: s.axis,
      metricKey: s.metricKey,
      severity: Math.round(100 - s.score),
      message: `${s.metricKey} 점수 ${Math.round(s.score)} (감점)`,
      suggestion: SUGGESTIONS[s.metricKey] ?? "개선이 필요합니다.",
    }))
    .sort((a, b) => b.severity - a.severity);
}
