import type { MetricRow } from "../lib/data/metricRows.js";
import { scoreColor } from "../lib/scoreColor.js";

const AXIS_LABEL: Record<string, string> = { A: "접근성", B: "구조화", C: "콘텐츠", D: "기술위생" };

export function MetricTable({ rows }: { rows: MetricRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ color: "var(--muted)" }} className="text-left">
          <th className="py-2 font-normal">축</th>
          <th className="py-2 font-normal">지표</th>
          <th className="py-2 text-right font-normal">점수</th>
          <th className="py-2 font-normal">근거</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.axis}-${r.metricKey}`} className="border-t" style={{ borderColor: "var(--line)" }}>
            <td className="py-2" style={{ color: "var(--muted)" }}>{AXIS_LABEL[r.axis] ?? r.axis}</td>
            <td className="mono py-2">{r.metricKey}</td>
            <td className="mono py-2 text-right" style={{ color: scoreColor(r.score) }}>
              {r.score == null ? "—" : Math.round(r.score)}
            </td>
            <td className="py-2" style={{ color: "var(--muted)" }}>{r.evidence ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
