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
import { CompanySummary } from "./CompanySummary.js";
import { modelColor } from "../lib/modelColor.js";
import { AXIS_INFO } from "../lib/glossary.js";
import { scoreColor } from "../lib/scoreColor.js";

const AXES: Axis[] = ["A", "B", "C", "D"];

export function CompanyDetailView({ company, weights, models }: { company: CompanyRecord; weights: Weights; models: string[] }) {
  const [view, setView] = useState<ScoreView>("average");
  const overall = useMemo(() => overallForView(company.scores, weights, view), [company, weights, view]);
  const rows = useMemo(() => metricRowsForView(company.scores, view), [company, view]);
  const axisScores = useMemo(
    () => AXES.map((axis) => ({ axis, score: axisForView(company.scores, axis, weights, view) })),
    [company, weights, view]
  );

  const series: RadarSeries[] = useMemo(() => {
    const list: RadarSeries[] = models.map((m) => ({
      label: m,
      color: modelColor(m),
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
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-semibold">{company.name}</h1>
          <a href={company.homepageUrl} className="mono text-sm" style={{ color: "var(--muted)" }} target="_blank" rel="noreferrer">
            {company.homepageUrl}
          </a>
          {company.description ? (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>{company.description}</p>
          ) : null}
        </div>
        <div className="text-right">
          <ScorePill score={overall} size="lg" />
          <div className="mt-2"><ModelToggle models={models} value={view} onChange={setView} /></div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(280px,340px)_1fr] md:items-start">
        <div className="flex flex-col gap-6 md:sticky md:top-6 md:self-start">
          <div className="panel p-4">
            <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>축별 (모델 오버레이)</h2>
            <AxisRadar series={series} />
            <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: "var(--line)" }}>
              {axisScores.map((a) => (
                <a
                  key={a.axis}
                  href={`#axis-${a.axis}`}
                  className="flex items-baseline gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  style={{ border: "1px solid var(--line)" }}
                  title={`${AXIS_INFO[a.axis].label}로 이동`}
                >
                  <span className="mono font-semibold" style={{ color: "var(--signal)" }}>{a.axis}</span>
                  <span style={{ color: "var(--muted)" }}>{AXIS_INFO[a.axis].label}</span>
                  <span className="mono tabular-nums" style={{ color: scoreColor(a.score) }}>
                    {a.score == null ? "—" : Math.round(a.score)}
                  </span>
                </a>
              ))}
            </div>
          </div>
          <CompanySummary rows={rows} overall={overall} axisScores={axisScores} />
        </div>
        <div>
          <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>지표</h2>
          <MetricTable rows={rows} axisScores={axisScores} />
        </div>
      </div>
    </div>
  );
}
