import type { MetricScore } from "@ai-benchmark/core";

export interface MetricScoreRow {
  scan_id: string;
  axis: string;
  metric_key: string;
  model: string;
  score: number;
  evidence: string | null;
  raw_detail: unknown;
}

export interface ImprovementRow {
  scan_id: string;
  axis: string;
  metric_key: string;
  severity: number;
  message: string;
  suggestion: string;
}

export interface ImprovementLike {
  axis: string;
  metricKey: string;
  severity: number;
  message: string;
  suggestion: string;
}

export function toMetricScoreRows(scanId: string, scores: MetricScore[]): MetricScoreRow[] {
  return scores.map((s) => ({
    scan_id: scanId,
    axis: s.axis,
    metric_key: s.metricKey,
    model: s.model,
    score: s.score,
    evidence: s.evidence ?? null,
    raw_detail: s.rawDetail ?? null,
  }));
}

export function toImprovementRows(scanId: string, imps: ImprovementLike[]): ImprovementRow[] {
  return imps.map((i) => ({
    scan_id: scanId,
    axis: i.axis,
    metric_key: i.metricKey,
    severity: i.severity,
    message: i.message,
    suggestion: i.suggestion,
  }));
}
