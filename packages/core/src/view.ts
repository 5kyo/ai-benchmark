import type { Axis, MetricScore, Weights } from "./types.js";
import { axisScore, overallScore } from "./aggregate.js";

export type ScoreView = "average" | { model: string };
export const RULE_MODEL = "rule-based";

export function isRuleBased(model: string): boolean {
  return model === RULE_MODEL;
}

/** 뷰에 따라 (axis, metricKey)당 점수 하나만 남긴다.
 * 규칙 점수는 항상 유지. LLM 점수는 average면 모델 평균, {model}이면 해당 모델만. */
export function collapseForView(scores: MetricScore[], view: ScoreView): MetricScore[] {
  const rule = scores.filter((s) => isRuleBased(s.model));
  const llm = scores.filter((s) => !isRuleBased(s.model));

  const groups = new Map<string, MetricScore[]>();
  for (const s of llm) {
    const key = `${s.axis}::${s.metricKey}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const collapsed: MetricScore[] = [];
  for (const group of groups.values()) {
    if (view === "average") {
      const avg = group.reduce((sum, s) => sum + s.score, 0) / group.length;
      // 단일 모델만 있으면 그 근거(evidence)를 유지한다(여러 모델이면 평균이라 특정 근거 없음).
      const evidence = group.length === 1 ? group[0].evidence : undefined;
      collapsed.push({ axis: group[0].axis, metricKey: group[0].metricKey, model: "average", score: avg, evidence });
    } else {
      const picked = group.find((s) => s.model === view.model);
      if (picked) collapsed.push(picked);
    }
  }
  return [...rule, ...collapsed];
}

export function axisForView(scores: MetricScore[], axis: Axis, w: Weights, view: ScoreView): number | null {
  return axisScore(collapseForView(scores, view), axis, w);
}

export function overallForView(scores: MetricScore[], w: Weights, view: ScoreView): number | null {
  return overallScore(collapseForView(scores, view), w);
}
