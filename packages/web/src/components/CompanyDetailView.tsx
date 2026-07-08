"use client";
import { useMemo, useState } from "react";
import type { Axis, ScoreView, Weights } from "@ai-benchmark/core";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { metricRowsForView } from "../lib/data/metricRows.js";
import { ModelToggle } from "./ModelToggle.js";
import { MetricTable } from "./MetricTable.js";
import { ScorePill } from "./ScorePill.js";
import { AxisRadar, type RadarSeries } from "./AxisRadar.js";

const AXES: Axis[] = ["A", "B", "C", "D"];

export function CompanyDetailView({ company, weights, models }: { company: CompanyRecord; weights: Weights; models: string[] }) {
  const [view, setView] = useState<ScoreView>("average");
  const overall = useMemo(() => overallForView(company.scores, weights, view), [company, weights, view]);
  const rows = useMemo(() => metricRowsForView(company.scores, view), [company, view]);

  const series: RadarSeries[] = useMemo(() => {
    const colors: Record<string, string> = { "claude-opus-4-8": "#57C7D4", "gpt-4o": "#F5A524" };
    const list: RadarSeries[] = models.map((m, i) => ({
      label: m,
      color: colors[m] ?? (i === 0 ? "#57C7D4" : "#8B7CF6"),
      values: AXES.map((axis) => ({ axis, score: axisForView(company.scores, axis, weights, { model: m }) })),
    }));
    return list.length ? list : [{
      label: "평균", color: "#57C7D4",
      values: AXES.map((axis) => ({ axis, score: axisForView(company.scores, axis, weights, "average") })),
    }];
  }, [company, weights, models]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{company.name}</h1>
          <a href={company.homepageUrl} className="mono text-sm" style={{ color: "var(--muted)" }} target="_blank" rel="noreferrer">
            {company.homepageUrl}
          </a>
        </div>
        <div className="text-right">
          <ScorePill score={overall} size="lg" />
          <div className="mt-2"><ModelToggle models={models} value={view} onChange={setView} /></div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>축별 (모델 오버레이)</h2>
          <AxisRadar series={series} />
        </div>
        <div className="panel p-4">
          <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>지표</h2>
          <MetricTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
