import type { Axis, MetricScore, ScoreView } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";
import { metricRowsForView } from "./metricRows.js";

export interface GapRow {
  axis: Axis;
  metricKey: string;
  self: number | null;
  best: number | null;
  bestName: string;
  gap: number;
}

export function losingMetrics(self: CompanyRecord, others: CompanyRecord[], view: ScoreView): GapRow[] {
  const selfRows = metricRowsForView(self.scores, view);
  const gaps: GapRow[] = [];
  for (const sr of selfRows) {
    let best = sr.score ?? 0;
    let bestName = self.name;
    let bestVal: number | null = sr.score;
    for (const o of others) {
      const orow = metricRowsForView(o.scores, view).find((r) => r.axis === sr.axis && r.metricKey === sr.metricKey);
      if (orow?.score != null && orow.score > best) {
        best = orow.score;
        bestName = o.name;
        bestVal = orow.score;
      }
    }
    const selfScore = sr.score ?? 0;
    if (best > selfScore) {
      gaps.push({ axis: sr.axis, metricKey: sr.metricKey, self: sr.score, best: bestVal, bestName, gap: best - selfScore });
    }
  }
  return gaps.sort((a, b) => b.gap - a.gap);
}

export interface ModelDelta {
  axis: Axis;
  metricKey: string;
  a: number | null;
  b: number | null;
  delta: number;
}

export function modelDeltas(company: CompanyRecord, modelA: string, modelB: string): ModelDelta[] {
  const pick = (m: string) => (s: MetricScore) => s.model === m && s.axis === "C";
  const keys = [...new Set(company.scores.filter((s) => s.axis === "C").map((s) => s.metricKey))];
  const out: ModelDelta[] = keys.map((k) => {
    const a = company.scores.find((s) => pick(modelA)(s) && s.metricKey === k)?.score ?? null;
    const b = company.scores.find((s) => pick(modelB)(s) && s.metricKey === k)?.score ?? null;
    return { axis: "C" as Axis, metricKey: k, a, b, delta: (b ?? 0) - (a ?? 0) };
  });
  return out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}
