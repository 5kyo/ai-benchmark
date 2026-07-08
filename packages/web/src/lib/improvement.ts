// 자사(파라메타)를 종합 1·2위와 비교해 가중 격차 영향도 순으로 개선 항목을 산출한다.
// 읽기 전용·결정론적: measured 데이터가 갱신되면 격차·순위·항목이 자동으로 움직인다.
import type { Axis, Weights } from "@ai-benchmark/core";
import type { CompanyRecord } from "./data/types.js";
import type { MetricRow } from "./data/metricRows.js";
import { buildRanking } from "./data/build.js";
import { metricRowsForView } from "./data/metricRows.js";
import { metricLabel, metricSuggestion } from "./glossary.js";
import { pickRowEvidence } from "./evidence.js";

export type Tier = "high" | "mid" | "low";

const TIER_HIGH = 1.0; // 예상 종합점수 상승 ≥ 1.0점
const TIER_MID = 0.3; // ≥ 0.3점

export interface ImprovementItem {
  axis: Axis;
  metricKey: string;
  label: string;
  selfScore: number;
  leaderScores: { name: string; score: number | null }[];
  target: number;
  gap: number;
  projectedGain: number; // 격차 × 실효가중치 = 예상 종합점수 상승분
  tier: Tier;
  suggestion: string;
  selfEvidence?: string;
  leaderEvidence?: string;
  leaderName?: string;
}

export interface ImprovementPlan {
  self: { name: string; overall: number | null; rank: number; total: number };
  leaders: { name: string; overall: number | null }[];
  gapToTop: number | null;
  items: ImprovementItem[];
  projectedOverallIfHigh: number | null;
}

function tierOf(gain: number): Tier {
  if (gain >= TIER_HIGH) return "high";
  if (gain >= TIER_MID) return "mid";
  return "low";
}

function rowMap(company: CompanyRecord): Map<string, MetricRow> {
  const m = new Map<string, MetricRow>();
  for (const r of metricRowsForView(company.scores, "average")) m.set(`${r.axis}::${r.metricKey}`, r);
  return m;
}

export function buildImprovementPlan(companies: CompanyRecord[], weights: Weights): ImprovementPlan {
  const ranking = buildRanking(companies, weights, "average");
  const total = ranking.length;
  const selfRow = ranking.find((r) => r.isSelf);
  const leaderRows = ranking.filter((r) => !r.isSelf).slice(0, 2);
  const leaders = leaderRows.map((r) => ({ name: r.name, overall: r.overall }));

  const empty: ImprovementPlan = {
    self: { name: selfRow?.name ?? "", overall: selfRow?.overall ?? null, rank: 0, total },
    leaders,
    gapToTop: null,
    items: [],
    projectedOverallIfHigh: selfRow?.overall ?? null,
  };

  const self = companies.find((c) => c.isSelf);
  if (!self || !selfRow) return empty;

  const rank = ranking.indexOf(selfRow) + 1;
  const selfMap = rowMap(self);
  const leaderMaps = leaderRows.map((lr) => ({
    name: lr.name,
    map: rowMap(companies.find((c) => c.slug === lr.slug)!),
  }));

  // 축별 실효가중치 정규화 분모: 자사에 점수가 있는 축내 지표들의 가중치 합.
  const axisPresentWeight = new Map<Axis, number>();
  for (const [, r] of selfMap) {
    if (r.score == null) continue;
    const w = weights.metrics[r.axis]?.[r.metricKey];
    if (w == null) continue;
    axisPresentWeight.set(r.axis, (axisPresentWeight.get(r.axis) ?? 0) + w);
  }

  const items: ImprovementItem[] = [];
  for (const [key, r] of selfMap) {
    if (r.score == null) continue;
    const metricW = weights.metrics[r.axis]?.[r.metricKey];
    const axisW = weights.axes[r.axis] ?? 0;
    if (metricW == null || axisW <= 0) continue;

    const leaderScores = leaderMaps.map((lm) => ({ name: lm.name, score: lm.map.get(key)?.score ?? null }));
    const present = leaderScores.filter((l): l is { name: string; score: number } => l.score != null);
    if (present.length === 0) continue;
    const target = Math.max(...present.map((l) => l.score));
    const gap = target - r.score;
    if (gap <= 0) continue;

    const denom = axisPresentWeight.get(r.axis) ?? metricW;
    const effWeight = axisW * (metricW / denom);
    const projectedGain = gap * effWeight;

    const targetLeader = present.find((l) => l.score === target)!;
    const leaderRow = leaderMaps.find((lm) => lm.name === targetLeader.name)?.map.get(key);

    items.push({
      axis: r.axis,
      metricKey: r.metricKey,
      label: metricLabel(r.metricKey),
      selfScore: Math.round(r.score),
      leaderScores,
      target: Math.round(target),
      gap: Math.round(gap),
      projectedGain,
      tier: tierOf(projectedGain),
      suggestion: metricSuggestion(r.metricKey),
      selfEvidence: pickRowEvidence(r),
      leaderEvidence: leaderRow ? pickRowEvidence(leaderRow) : undefined,
      leaderName: targetLeader.name,
    });
  }

  items.sort((a, b) => b.projectedGain - a.projectedGain);

  const highSum = items.filter((i) => i.tier === "high").reduce((s, i) => s + i.projectedGain, 0);
  const projectedOverallIfHigh = selfRow.overall == null ? null : selfRow.overall + highSum;
  const gapToTop = selfRow.overall != null && leaders[0]?.overall != null ? leaders[0].overall - selfRow.overall : null;

  return {
    self: { name: selfRow.name, overall: selfRow.overall, rank, total },
    leaders,
    gapToTop,
    items,
    projectedOverallIfHigh,
  };
}
