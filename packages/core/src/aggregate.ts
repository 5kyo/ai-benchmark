import type { Axis, MetricScore, Weights } from "./types.js";

/** 존재하는 지표만으로 가중치를 재정규화해 가중평균. 없으면 null. */
export function axisScore(scores: MetricScore[], axis: Axis, w: Weights): number | null {
  const metricWeights = w.metrics[axis] ?? {};
  const present = scores.filter((s) => s.axis === axis && metricWeights[s.metricKey] != null);
  if (present.length === 0) return null;
  const totalW = present.reduce((sum, s) => sum + metricWeights[s.metricKey], 0);
  if (totalW === 0) return null;
  const weighted = present.reduce((sum, s) => sum + s.score * metricWeights[s.metricKey], 0);
  return weighted / totalW;
}

/** 존재하는 축 점수만으로 축 가중치를 재정규화해 가중평균. 없으면 null. */
export function overallScore(scores: MetricScore[], w: Weights): number | null {
  const axes: Axis[] = ["A", "B", "C", "D"];
  const parts = axes
    .map((axis) => ({ axis, value: axisScore(scores, axis, w), weight: w.axes[axis] ?? 0 }))
    .filter((p): p is { axis: Axis; value: number; weight: number } => p.value != null && p.weight > 0);
  if (parts.length === 0) return null;
  const totalW = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalW === 0) return null;
  const weighted = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  return weighted / totalW;
}
