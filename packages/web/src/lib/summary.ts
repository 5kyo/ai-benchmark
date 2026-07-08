// 지표 점수에서 강점/약점/총평을 결정론적으로 계산한다(뷰가 바뀌면 함께 갱신).
import type { Axis } from "@ai-benchmark/core";
import type { MetricRow } from "./data/metricRows.js";
import type { AxisScore } from "./data/types.js";
import { AXIS_INFO, metricLabel, metricSuggestion } from "./glossary.js";

const STRONG = 85; // 이 이상이면 강점
const WEAK = 60; // 이 미만이면 개선 대상

export interface SummaryItem {
  axis: Axis;
  metricKey: string;
  label: string;
  score: number;
  suggestion?: string;
}

export interface Summary {
  headline: string;
  strengths: SummaryItem[];
  weaknesses: SummaryItem[];
  weakIsFallback: boolean; // 약점 임계 미달 항목이 없어 하위 항목으로 대체했는가
}

function toItem(r: MetricRow & { score: number }): SummaryItem {
  return { axis: r.axis, metricKey: r.metricKey, label: metricLabel(r.metricKey), score: Math.round(r.score) };
}

export function buildSummary(rows: MetricRow[], overall: number | null, axisScores: AxisScore[]): Summary {
  const scored = rows.filter((r): r is MetricRow & { score: number } => r.score != null);

  const strengths = scored
    .filter((r) => r.score >= STRONG)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(toItem);

  let weakIsFallback = false;
  let weakPool = scored.filter((r) => r.score < WEAK).sort((a, b) => a.score - b.score);
  if (weakPool.length === 0) {
    weakIsFallback = true;
    weakPool = [...scored].sort((a, b) => a.score - b.score).slice(0, 3);
  }
  const weaknesses = weakPool.slice(0, 5).map((r) => ({ ...toItem(r), suggestion: metricSuggestion(r.metricKey) }));

  // 총평: 가장 강한 축 / 가장 약한 축
  const ranked = axisScores
    .filter((a): a is { axis: Axis; score: number } => a.score != null)
    .sort((a, b) => b.score - a.score);
  const overallTxt = overall == null ? "" : `종합 ${Math.round(overall)}점. `;
  let headline = overallTxt;
  if (ranked.length >= 2) {
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    headline += `강점은 ${AXIS_INFO[top.axis].label}(${Math.round(top.score)}), 개선 우선순위는 ${AXIS_INFO[bottom.axis].label}(${Math.round(bottom.score)})입니다.`;
  } else {
    headline += "축별 점수를 확인하세요.";
  }

  return { headline, strengths, weaknesses, weakIsFallback };
}
