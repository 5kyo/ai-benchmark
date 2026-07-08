import type { Axis, Weights, ScoreView, MetricScore } from "@ai-benchmark/core";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord, RankingRow } from "./types.js";

const AXES: Axis[] = ["A", "B", "C", "D"];

export function buildRanking(companies: CompanyRecord[], w: Weights, view: ScoreView): RankingRow[] {
  const rows: RankingRow[] = companies.map((c) => ({
    slug: c.slug,
    name: c.name,
    isSelf: c.isSelf,
    category: c.category,
    region: c.region,
    overall: overallForView(c.scores, w, view),
    axes: AXES.map((axis) => ({ axis, score: axisForView(c.scores, axis, w, view) })),
  }));
  return rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
}

export function listModels(companies: CompanyRecord[]): string[] {
  const set = new Set<string>();
  for (const c of companies) {
    for (const s of c.scores as MetricScore[]) {
      if (s.model !== "rule-based" && s.model !== "average") set.add(s.model);
    }
  }
  return [...set].sort();
}

export function industryAverage(rows: RankingRow[]): number | null {
  const vals = rows.map((r) => r.overall).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
