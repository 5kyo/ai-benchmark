import type { Axis, MetricScore } from "@ai-benchmark/core";

export interface CompanyRecord {
  slug: string;
  name: string;
  homepageUrl: string;
  isSelf: boolean;
  category?: string;
  region?: string;
  description?: string;
  scores: MetricScore[];
}

export interface AxisScore {
  axis: Axis;
  score: number | null;
}

export interface RankingRow {
  slug: string;
  name: string;
  isSelf: boolean;
  category?: string;
  region?: string;
  overall: number | null;
  axes: AxisScore[];
  // 종합을 모델별로 분해(모든 축에 LLM이 반영돼 모델마다 다름). 모델 2개 이상일 때 표시.
  overallByModel: { model: string; score: number | null }[];
}
