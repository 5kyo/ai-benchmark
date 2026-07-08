import type { MetricRow } from "../lib/data/metricRows.js";
import type { AxisScore } from "../lib/data/types.js";
import { buildSummary, type SummaryItem } from "../lib/summary.js";
import { AXIS_INFO } from "../lib/glossary.js";
import { scoreColor } from "../lib/scoreColor.js";

function AxisTag({ axis }: { axis: SummaryItem["axis"] }) {
  return (
    <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>
      {axis} {AXIS_INFO[axis].label}
    </span>
  );
}

export function CompanySummary({
  rows,
  overall,
  axisScores,
}: {
  rows: MetricRow[];
  overall: number | null;
  axisScores: AxisScore[];
}) {
  const { headline, strengths, weaknesses, weakIsFallback } = buildSummary(rows, overall, axisScores);

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="font-display text-sm font-semibold">진단 요약</h2>
        <span className="text-xs" style={{ color: "var(--muted)" }}>점수 기준 자동 분석</span>
      </div>
      <p className="mb-4 text-sm leading-relaxed">{headline}</p>

      <div className="space-y-5">
        {/* 잘하고 있는 점 */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span style={{ color: "var(--score-high)" }}>▲</span> 잘하고 있는 점
          </h3>
          {strengths.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>85점 이상 항목이 아직 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {strengths.map((s) => (
                <li key={`${s.axis}-${s.metricKey}`} className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm">{s.label}</span>
                    <AxisTag axis={s.axis} />
                  </span>
                  <span className="mono shrink-0 text-sm tabular-nums" style={{ color: scoreColor(s.score) }}>{s.score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 개선하면 좋은 점 */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span style={{ color: "var(--score-low)" }}>▼</span> 개선하면 좋은 점
            {weakIsFallback && (
              <span className="text-[10px] font-normal" style={{ color: "var(--muted)" }}>(상대적으로 낮은 항목)</span>
            )}
          </h3>
          <ul className="space-y-2.5">
            {weaknesses.map((w) => (
              <li key={`${w.axis}-${w.metricKey}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm">{w.label}</span>
                    <AxisTag axis={w.axis} />
                  </span>
                  <span className="mono shrink-0 text-sm tabular-nums" style={{ color: scoreColor(w.score) }}>{w.score}</span>
                </div>
                {w.suggestion && (
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--muted)" }}>→ {w.suggestion}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
