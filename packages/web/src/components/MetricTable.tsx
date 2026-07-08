import type { Axis } from "@ai-benchmark/core";
import type { MetricRow } from "../lib/data/metricRows.js";
import { scoreColor } from "../lib/scoreColor.js";
import { AXIS_INFO, metricLabel, metricDescription } from "../lib/glossary.js";

const AXIS_ORDER: Axis[] = ["A", "B", "C", "D"];

function groupByAxis(rows: MetricRow[]): { axis: Axis; rows: MetricRow[] }[] {
  return AXIS_ORDER.map((axis) => ({ axis, rows: rows.filter((r) => r.axis === axis) })).filter(
    (g) => g.rows.length > 0
  );
}

export function MetricTable({ rows }: { rows: MetricRow[] }) {
  const groups = groupByAxis(rows);
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const info = AXIS_INFO[g.axis];
        return (
          <section key={g.axis}>
            <div className="mb-2 border-b pb-1.5" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-baseline gap-2">
                <span className="mono text-xs" style={{ color: "var(--signal)" }}>{g.axis}</span>
                <h3 className="font-display text-sm font-semibold">{info.label}</h3>
              </div>
              <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--muted)" }}>{info.summary}</p>
            </div>
            <ul className="space-y-2.5">
              {g.rows.map((r) => (
                <li key={`${r.axis}-${r.metricKey}`} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm">{metricLabel(r.metricKey)}</span>
                      <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>{r.metricKey}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--muted)" }}>
                      {metricDescription(r.metricKey)}
                    </p>
                    {r.evidence ? (
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
