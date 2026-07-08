import type { Axis, MetricScore, ScoreView } from "@ai-benchmark/core";
import { collapseForView } from "@ai-benchmark/core";

export interface ModelEvidence {
  model: string;
  score: number | null;
  evidence?: string;
}

export interface MetricRow {
  axis: Axis;
  metricKey: string;
  score: number | null;
  evidence?: string;
  // 평균 뷰에서 LLM 지표를 여러 모델이 채점한 경우, 모델별 점수·근거를 함께 노출.
  perModel?: ModelEvidence[];
}

export function metricRowsForView(scores: MetricScore[], view: ScoreView): MetricRow[] {
  const collapsed = collapseForView(scores, view);

  // metricKey별 LLM(비규칙) 모델 점수·근거 모음
  const llmByKey = new Map<string, ModelEvidence[]>();
  for (const s of scores) {
    if (s.model === "rule-based") continue;
    const arr = llmByKey.get(s.metricKey) ?? [];
    arr.push({ model: s.model, score: s.score, evidence: s.evidence });
    llmByKey.set(s.metricKey, arr);
  }

  const rows: MetricRow[] = collapsed.map((s) => {
    const models = llmByKey.get(s.metricKey);
    const perModel = view === "average" && models && models.length > 1 ? models : undefined;
    return { axis: s.axis, metricKey: s.metricKey, score: s.score, evidence: s.evidence, perModel };
  });

  const axisOrder: Record<Axis, number> = { A: 0, B: 1, C: 2, D: 3 };
  return rows.sort((a, b) => axisOrder[a.axis] - axisOrder[b.axis] || a.metricKey.localeCompare(b.metricKey));
}
