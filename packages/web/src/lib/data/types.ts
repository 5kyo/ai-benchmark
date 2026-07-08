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
}
