import type { Axis } from "@ai-benchmark/core";
import type { MetricRow } from "../lib/data/metricRows.js";
import type { AxisScore } from "../lib/data/types.js";
import { scoreColor } from "../lib/scoreColor.js";
import { AXIS_INFO, metricLabel, metricDescription } from "../lib/glossary.js";
import { modelColor, modelShort } from "../lib/modelColor.js";

const AXIS_ORDER: Axis[] = ["A", "B", "C", "D"];

function groupByAxis(rows: MetricRow[]): { axis: Axis; rows: MetricRow[] }[] {
  return AXIS_ORDER.map((axis) => ({ axis, rows: rows.filter((r) => r.axis === axis) })).filter(
    (g) => g.rows.length > 0
  );
}

export function MetricTable({ rows, axisScores }: { rows: MetricRow[]; axisScores: AxisScore[] }) {
  const groups = groupByAxis(rows);
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const info = AXIS_INFO[g.axis];
        const axisScore = axisScores.find((a) => a.axis === g.axis)?.score ?? null;
        return (
          <section key={g.axis} id={`axis-${g.axis}`} className="panel scroll-mt-6">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--ink)" }}>
              <div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="mono rounded px-1.5 py-0.5 text-xs font-semibold leading-none"
                    style={{ color: "var(--signal)", border: "1px solid var(--signal)" }}
                  >
                    {g.axis}
                  </span>
                  <h3 className="font-display text-base font-semibold">{info.label}</h3>
                </div>
                <p className="mt-1 text-xs leading-snug" style={{ color: "var(--muted)" }}>{info.summary}</p>
              </div>
              <span className="mono shrink-0 text-2xl tabular-nums leading-none" style={{ color: scoreColor(axisScore) }}>
                {axisScore == null ? "—" : Math.round(axisScore)}
              </span>
            </div>
            <ul className="px-4">
              {g.rows.map((r, i) => (
                <li
                  key={`${r.axis}-${r.metricKey}`}
                  className="flex items-center gap-3 border-t py-3.5 first:border-t-0"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span
                    className="mono self-start pt-0.5 text-xs tabular-nums"
                    style={{ color: "var(--muted)", minWidth: "2ch" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-semibold">{metricLabel(r.metricKey)}</span>
                      <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{r.metricKey}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--muted)" }}>
                      {metricDescription(r.metricKey)}
                    </p>
                    {r.perModel ? (
                      // 평균 뷰의 LLM 지표: 모델별 근거를 각각 표시
                      <div className="mt-1.5 space-y-1">
                        {r.perModel.map((pm) => (
                          <div
                            key={pm.model}
                            className="flex gap-2 rounded px-2.5 py-1.5 text-xs leading-snug"
                            style={{ background: "var(--ink)", borderLeft: `2px solid ${scoreColor(pm.score)}`, color: "var(--text)" }}
                          >
                            <span
                              className="mono shrink-0 text-[10px]"
                              style={{ color: modelColor(pm.model), paddingTop: "1px" }}
                              title={pm.model}
                            >
                              {modelShort(pm.model)} {pm.score == null ? "—" : Math.round(pm.score)}
                            </span>
                            <span>{pm.evidence}</span>
                          </div>
                        ))}
                      </div>
                    ) : r.evidence ? (
                      <div
                        className="mt-1.5 flex gap-2 rounded px-2.5 py-1.5 text-xs leading-snug"
                        style={{ background: "var(--ink)", borderLeft: `2px solid ${scoreColor(r.score)}`, color: "var(--text)" }}
                      >
                        <span
                          className="mono shrink-0 text-[10px] uppercase tracking-wide"
                          style={{ color: "var(--muted)", paddingTop: "1px" }}
                        >
                          근거
                        </span>
                        <span>{r.evidence}</span>
                      </div>
                    ) : null}
                  </div>
                  <span
                    className="mono shrink-0 text-lg tabular-nums"
                    style={{ color: scoreColor(r.score), minWidth: "3ch", textAlign: "right" }}
                  >
                    {r.score == null ? "—" : Math.round(r.score)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
