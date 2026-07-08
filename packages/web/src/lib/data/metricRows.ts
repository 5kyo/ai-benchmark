import type { Axis, MetricScore, ScoreView } from "@ai-benchmark/core";
import { collapseForView } from "@ai-benchmark/core";

export interface MetricRow {
  axis: Axis;
  metricKey: string;
  score: number | null;
  evidence?: string;
}

export function metricRowsForView(scores: MetricScore[], view: ScoreView): MetricRow[] {
  const collapsed = collapseForView(scores, view);
  const rows: MetricRow[] = collapsed.map((s) => ({
    axis: s.axis,
    metricKey: s.metricKey,
    score: s.score,
    evidence: s.evidence,
  }));
  const axisOrder: Record<Axis, number> = { A: 0, B: 1, C: 2, D: 3 };
  return rows.sort((a, b) => axisOrder[a.axis] - axisOrder[b.axis] || a.metricKey.localeCompare(b.metricKey));
}
