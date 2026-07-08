import type { AxisScore } from "../lib/data/types.js";
import { scoreColor } from "../lib/scoreColor.js";

export function SignalBars({ axes }: { axes: AxisScore[] }) {
  return (
    <div className="flex items-end gap-1" aria-label="axis scores">
      {axes.map((a) => {
        const h = a.score == null ? 4 : 4 + (a.score / 100) * 28;
        return (
          <div key={a.axis} className="flex flex-col items-center gap-1">
            <div
              style={{ height: h, width: 8, background: scoreColor(a.score), borderRadius: 2 }}
              title={`${a.axis}: ${a.score == null ? "—" : Math.round(a.score)}`}
            />
            <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>{a.axis}</span>
          </div>
        );
      })}
    </div>
  );
}
