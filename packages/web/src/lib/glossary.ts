// 축·지표 사람이 읽는 설명 사전. 서버/클라이언트 공용(순수 데이터, node 의존 없음).
import type { Axis } from "@ai-benchmark/core";

export interface AxisInfo {
  label: string; // 짧은 한글 이름
  summary: string; // 한 줄 요약 (무엇을 보는 축인가)
}

export interface MetricInfo {
  label: string; // 짧은 한글 이름
  description: string; // 이 지표가 무엇을 측정하는가
  suggestion: string; // 점수가 낮을 때의 개선 방법
}

export const AXIS_INFO: Record<Axis, AxisInfo> = {
  A: { label: "접근성", summary: "AI 크롤러·에이전트가 접근해 콘텐츠를 가져오고 핵심 정보를 찾을 수 있는가 (규칙+LLM)" },
  B: { label: "구조화", summary: "기계가 문서의 구조·의미를 이해하기 쉽게 조직·마크업됐는가 (규칙+LLM)" },
  C: { label: "콘텐츠", summary: "읽었을 때 회사·제품 정보가 충실하고 명확한가 (LLM)" },
  D: { label: "기술 품질", summary: "속도·보안·모바일 등 기술 품질과 기술적 신뢰 신호 (규칙+LLM)" },
};

export const METRIC_INFO: Record<string, MetricInfo> = {
  // A 접근성 — LLM
  agent_findability: { label: "에이전트 발견성", description: "AI 에이전트가 회사·제품 핵심 정보를 쉽게 찾도록 전면·상단에 노출했는가.", suggestion: "핵심 소개·제품 정보를 첫 화면 상단에 명확히 노출하세요." },
  content_extractability: { label: "콘텐츠 추출성", description: "본문이 팝업·이미지텍스트·인터랙션 의존 없이 텍스트로 깔끔히 추출되는가.", suggestion: "핵심 내용을 이미지가 아닌 실제 텍스트로 제공하고 반복·팝업 장벽을 줄이세요." },
  // A 접근성 — 규칙
  robots_allowed: { label: "robots 허용", description: "robots.txt가 크롤러의 접근을 막지 않는가.", suggestion: "robots.txt에서 크롤러 접근을 허용하세요." },
  sitemap_present: { label: "사이트맵", description: "사이트맵을 제공해 페이지 목록을 알려주는가. robots.txt의 Sitemap 지시자와 sitemap.xml·sitemap-index.xml·sitemap_index.xml을 확인한다.", suggestion: "사이트맵을 추가하고 robots.txt에 Sitemap 지시자로 위치를 알리세요." },
  llms_txt_present: { label: "llms.txt", description: "AI 에이전트용 안내 파일 /llms.txt 를 제공하는가.", suggestion: "/llms.txt를 추가해 AI 에이전트용 사이트 안내를 제공하세요." },
  ssr_rendered: { label: "SSR 렌더", description: "JS 실행 없이도 서버 응답 HTML에 본문이 담겨 있는가.", suggestion: "핵심 콘텐츠를 서버 렌더링(SSR)하거나 정적으로 제공하세요." },
  not_bot_blocked: { label: "봇 미차단", description: "봇 User-Agent를 403 등으로 차단하지 않는가.", suggestion: "정상 크롤러의 접근 차단(403)을 완화하세요." },
  pages_reachable: { label: "페이지 응답", description: "핵심 페이지가 정상(200)으로 응답하는가.", suggestion: "홈페이지가 200으로 안정적으로 응답하도록 하세요." },
  // B 구조화 — LLM
  logical_organization: { label: "논리적 구성", description: "콘텐츠가 논리적 순서·제목 위계로 조직돼 기계가 흐름을 파악하기 쉬운가.", suggestion: "정보를 논리적 순서와 명확한 제목 위계로 구성하세요." },
  info_scannability: { label: "스캔 용이성", description: "핵심 정보가 목록·표·구획으로 구조화돼 빠르게 스캔·파싱되는가.", suggestion: "핵심 정보를 긴 문단 대신 목록·표·구획으로 구조화하세요." },
  // B 구조화 — 규칙
  json_ld_present: { label: "JSON-LD", description: "schema.org 구조화 데이터(JSON-LD)를 넣어 기계가 회사·제품을 인식하게 하는가.", suggestion: "schema.org JSON-LD 구조화 데이터(Organization·Product)를 추가하세요." },
  semantic_ratio: { label: "시맨틱 태그", description: "div 남발 대신 main·section·article 등 의미 있는 HTML5 태그를 쓰는가.", suggestion: "main·section·article 등 시맨틱 태그로 구조를 표현하세요." },
  meta_completeness: { label: "메타 태그", description: "title·description·Open Graph 등 메타 정보가 갖춰졌는가.", suggestion: "title·description·Open Graph 메타 태그를 채우세요." },
  heading_hierarchy: { label: "제목 계층", description: "하나의 h1 아래 h2~h6이 올바른 계층으로 구성됐는가.", suggestion: "h1을 하나만 두고 h2~h6 계층을 정리하세요." },
  alt_coverage: { label: "이미지 alt", description: "이미지에 대체텍스트(alt)가 얼마나 채워졌는가. aria-hidden·role=presentation으로 장식용임을 명시한 이미지는 세지 않는다.", suggestion: "콘텐츠 이미지에 의미 있는 alt를 넣고, 장식용 이미지는 aria-hidden으로 명시하세요." },
  // C 콘텐츠
  clarity: { label: "명확성", description: "무엇을 하는 회사인지 홈페이지만으로 분명히 알 수 있는가.", suggestion: "첫 화면에 '무엇을 하는 회사인지'를 한 문장으로 명시하세요." },
  product_depth: { label: "제품 구체성", description: "제품·서비스 설명이 충분히 구체적인가.", suggestion: "제품·서비스별 기능과 사례를 구체적으로 보강하세요." },
  key_info_present: { label: "핵심 정보", description: "팀·연락처·문서·토크노믹스 등 핵심 정보가 있는가.", suggestion: "팀·연락처·문서(백서/독스) 링크 등 핵심 정보를 노출하세요." },
  freshness_clarity: { label: "최신성", description: "최신성이 있고 모호·과장 없는 서술인가.", suggestion: "최신 소식·날짜를 갱신하고 과장 표현을 줄이세요." },
  // D 기술 품질 — LLM
  technical_depth: { label: "기술 신뢰 신호", description: "문서·API·SDK·보안·인증·규제 준수 등 기술적 깊이·신뢰 신호가 콘텐츠에 드러나는가.", suggestion: "문서·API·보안/인증 등 기술적 근거와 신뢰 신호를 콘텐츠로 제시하세요." },
  content_polish: { label: "완성도", description: "서술·번역·용어의 일관성과 전문성 — 오탈자·어색한 번역·과장이 없는가.", suggestion: "오탈자·어색한 번역을 교정하고 용어를 일관되게 다듬으세요." },
  // D 기술 품질 — 규칙
  load_time: { label: "로딩 속도", description: "홈페이지 응답·로딩이 빠른가.", suggestion: "이미지·스크립트를 최적화해 로딩 속도를 높이세요." },
  mobile_ready: { label: "모바일 대응", description: "모바일 뷰포트 대응이 되어 있는가.", suggestion: "viewport 메타 태그로 모바일 대응을 하세요." },
  https_secure: { label: "HTTPS", description: "HTTPS 보안 연결을 사용하는가.", suggestion: "HTTPS로 서비스하세요." },
  multilingual: { label: "다국어", description: "다국어(예: 한/영) 지원이 있는가.", suggestion: "hreflang로 다국어(한/영) 대응을 명시하세요." },
};

// 사업 카테고리 한글 라벨.
export const CATEGORY_LABEL: Record<string, string> = {
  Infra: "인프라",
  Custody: "커스터디",
  Enterprise: "엔터프라이즈",
};

export function categoryLabel(category?: string): string {
  if (!category) return "";
  return CATEGORY_LABEL[category] ?? category;
}

export function metricLabel(key: string): string {
  return METRIC_INFO[key]?.label ?? key;
}

export function metricDescription(key: string): string {
  return METRIC_INFO[key]?.description ?? "";
}

export function metricSuggestion(key: string): string {
  return METRIC_INFO[key]?.suggestion ?? "";
}

// LLM이 채점하는 지표(나머지는 규칙 기반). 채점 파이프라인의 LLM_METRIC_KEYS와 일치.
export const LLM_METRIC_KEYS = new Set<string>([
  "agent_findability", "content_extractability",
  "logical_organization", "info_scannability",
  "clarity", "product_depth", "key_info_present", "freshness_clarity",
  "technical_depth", "content_polish",
]);

export function metricScorer(key: string): "규칙" | "LLM" {
  return LLM_METRIC_KEYS.has(key) ? "LLM" : "규칙";
}
