"use client";
import { useMemo, useState } from "react";
import type { ScoreView } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { losingMetrics } from "../lib/data/compare.js";
import { scoreColor } from "../lib/scoreColor.js";

export function CompareView({ self, others }: { self: CompanyRecord; others: CompanyRecord[] }) {
  const [view] = useState<ScoreView>("average");
  const gaps = useMemo(() => losingMetrics(self, others, view), [self, others, view]);
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">우리 vs 경쟁사</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        경쟁사가 앞서는 지표(개선 우선순위) — {self.name} 기준, 모델 평균.
      </p>
      <div className="panel divide-y" style={{ borderColor: "var(--line)" }}>
        {gaps.length === 0 && <p className="p-4 mono text-sm" style={{ color: "var(--muted)" }}>뒤처지는 지표 없음.</p>}
        {gaps.map((g) => (
          <div key={`${g.axis}-${g.metricKey}`} className="flex items-center justify-between p-3">
            <span className="mono text-sm">{g.metricKey}</span>
            <span className="flex items-center gap-4 text-sm">
              <span className="mono" style={{ color: scoreColor(g.self) }}>우리 {g.self == null ? "—" : Math.round(g.self)}</span>
              <span className="mono" style={{ color: scoreColor(g.best) }}>{g.bestName} {Math.round(g.best ?? 0)}</span>
              <span className="mono font-semibold" style={{ color: "var(--score-low)" }}>−{Math.round(g.gap)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
