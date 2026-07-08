// 축·지표 사람이 읽는 설명 사전. 서버/클라이언트 공용(순수 데이터, node 의존 없음).
import type { Axis } from "@ai-benchmark/core";

export interface AxisInfo {
  label: string; // 짧은 한글 이름
  summary: string; // 한 줄 요약 (무엇을 보는 축인가)
}

export interface MetricInfo {
  label: string; // 짧은 한글 이름
  description: string; // 이 지표가 무엇을 측정하는가
}

export const AXIS_INFO: Record<Axis, AxisInfo> = {
  A: { label: "접근성", summary: "AI 크롤러·에이전트가 페이지에 접근해 콘텐츠를 가져올 수 있는가" },
  B: { label: "구조화", summary: "기계가 문서의 구조와 의미를 이해하기 쉽게 마크업됐는가" },
  C: { label: "콘텐츠", summary: "읽었을 때 회사·제품 정보가 충실하고 명확한가 (LLM 채점)" },
  D: { label: "기술위생", summary: "속도·보안·모바일·다국어 등 기본 기술 품질" },
};

export const METRIC_INFO: Record<string, MetricInfo> = {
  // A 접근성
  robots_allowed: { label: "robots 허용", description: "robots.txt가 크롤러의 접근을 막지 않는가." },
  sitemap_present: { label: "사이트맵", description: "sitemap.xml을 제공해 페이지 목록을 알려주는가." },
  llms_txt_present: { label: "llms.txt", description: "AI 에이전트용 안내 파일 /llms.txt 를 제공하는가." },
  ssr_rendered: { label: "SSR 렌더", description: "JS 실행 없이도 서버 응답 HTML에 본문이 담겨 있는가." },
  not_bot_blocked: { label: "봇 미차단", description: "봇 User-Agent를 403 등으로 차단하지 않는가." },
  pages_reachable: { label: "페이지 응답", description: "핵심 페이지가 정상(200)으로 응답하는가." },
  // B 구조화
  json_ld_present: { label: "JSON-LD", description: "schema.org 구조화 데이터(JSON-LD)를 넣어 기계가 회사·제품을 인식하게 하는가." },
  semantic_ratio: { label: "시맨틱 태그", description: "div 남발 대신 main·section·article 등 의미 있는 HTML5 태그를 쓰는가." },
  meta_completeness: { label: "메타 태그", description: "title·description·Open Graph 등 메타 정보가 갖춰졌는가." },
  heading_hierarchy: { label: "제목 계층", description: "하나의 h1 아래 h2~h6이 올바른 계층으로 구성됐는가." },
  alt_coverage: { label: "이미지 alt", description: "이미지에 대체텍스트(alt)가 얼마나 채워졌는가." },
  // C 콘텐츠
  clarity: { label: "명확성", description: "무엇을 하는 회사인지 홈페이지만으로 분명히 알 수 있는가." },
  product_depth: { label: "제품 구체성", description: "제품·서비스 설명이 충분히 구체적인가." },
  key_info_present: { label: "핵심 정보", description: "팀·연락처·문서·토크노믹스 등 핵심 정보가 있는가." },
  freshness_clarity: { label: "최신성", description: "최신성이 있고 모호·과장 없는 서술인가." },
  // D 기술위생
  load_time: { label: "로딩 속도", description: "홈페이지 응답·로딩이 빠른가." },
  mobile_ready: { label: "모바일 대응", description: "모바일 뷰포트 대응이 되어 있는가." },
  https_secure: { label: "HTTPS", description: "HTTPS 보안 연결을 사용하는가." },
  multilingual: { label: "다국어", description: "다국어(예: 한/영) 지원이 있는가." },
};

export function metricLabel(key: string): string {
  return METRIC_INFO[key]?.label ?? key;
}

export function metricDescription(key: string): string {
  return METRIC_INFO[key]?.description ?? "";
}
