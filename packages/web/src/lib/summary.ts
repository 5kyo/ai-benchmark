// 지표 점수에서 강점/약점/총평을 결정론적으로 계산한다(뷰가 바뀌면 함께 갱신).
import type { Axis } from "@ai-benchmark/core";
import type { MetricRow } from "./data/metricRows.js";
import type { AxisScore } from "./data/types.js";
import { AXIS_INFO, metricLabel, metricSuggestion, metricScorer } from "./glossary.js";

const STRONG = 85; // 이 이상이면 강점
const WEAK = 60; // 이 미만이면 개선 대상

export interface SummaryItem {
  axis: Axis;
  metricKey: string;
  label: string;
  score: number;
  evidence?: string; // 근거 첫 문장(합성용)
  suggestion?: string; // 약점 항목 개선 제안
  grouped?: boolean; // 규칙 만점 묶음 항목(렌더에서 점수 숨김)
}

export interface Summary {
  headline: string;
  strengths: SummaryItem[];
  weaknesses: SummaryItem[];
  weakIsFallback: boolean; // 약점 임계 미달 항목이 없어 하위 항목으로 대체했는가
}

type ScoredRow = MetricRow & { score: number };

// 근거 서술의 첫 문장만 취한다(전문은 옆 지표 표에 있음). 소수점(4.5)은 문장 끝으로 보지 않는다.
function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?。](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

// 근거 선택: 평균 뷰 perModel이면 합쳐진 점수에 가장 가까운 모델, 아니면 행 자체 evidence.
function pickEvidence(r: ScoredRow): string | undefined {
  if (r.perModel && r.perModel.length > 0) {
    const withEv = r.perModel.filter(
      (p): p is { model: string; score: number; evidence: string } => p.evidence != null && p.score != null
    );
    if (withEv.length > 0) {
      const best = withEv.reduce((a, b) =>
        Math.abs(b.score - r.score) < Math.abs(a.score - r.score) ? b : a
      );
      return firstSentence(best.evidence);
    }
  }
  return r.evidence ? firstSentence(r.evidence) : undefined;
}

function toItem(r: ScoredRow): SummaryItem {
  return {
    axis: r.axis,
    metricKey: r.metricKey,
    label: metricLabel(r.metricKey),
    score: Math.round(r.score),
    evidence: pickEvidence(r),
  };
}

// 강점 선별: LLM·비만점 규칙은 개별, 같은 축 규칙 만점(100) 2개 이상은 '기본기' 한 항목으로 묶는다.
function buildStrengths(scored: ScoredRow[]): SummaryItem[] {
  const strongAll = scored.filter((r) => r.score >= STRONG).sort((a, b) => b.score - a.score);

  const individuals: SummaryItem[] = [];
  const rulePerfectByAxis = new Map<Axis, ScoredRow[]>();
  for (const r of strongAll) {
    const isRulePerfect = metricScorer(r.metricKey) === "규칙" && Math.round(r.score) === 100;
    if (isRulePerfect) {
      const arr = rulePerfectByAxis.get(r.axis) ?? [];
      arr.push(r);
      rulePerfectByAxis.set(r.axis, arr);
    } else {
      individuals.push(toItem(r));
    }
  }

  const grouped: SummaryItem[] = [];
  for (const [axis, items] of rulePerfectByAxis) {
    if (items.length >= 2) {
      const labels = items.map((r) => metricLabel(r.metricKey));
      grouped.push({
        axis,
        metricKey: `basics-${axis}`,
        label: `${AXIS_INFO[axis].label} 기본기`,
        score: 100,
        grouped: true,
        evidence: `${labels.join("·")} 등 기본 신호를 갖췄습니다.`,
      });
    } else {
      individuals.push(toItem(items[0]));
    }
  }

  // 개별(점수 내림차순) 먼저, 묶음 '기본기'는 뒤에.
  individuals.sort((a, b) => b.score - a.score);
  return [...individuals, ...grouped].slice(0, 5);
}

export function buildSummary(rows: MetricRow[], overall: number | null, axisScores: AxisScore[]): Summary {
  const scored = rows.filter((r): r is ScoredRow => r.score != null);

  const strengths = buildStrengths(scored);

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
