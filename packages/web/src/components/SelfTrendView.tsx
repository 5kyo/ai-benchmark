"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Axis } from "@ai-benchmark/core";
import { AXIS_INFO } from "../lib/glossary.js";
import type { TrendPoint } from "../lib/data/history.js";

type Metric = "overall" | Axis;

const METRICS: { key: Metric; label: string }[] = [
  { key: "overall", label: "종합" },
  { key: "A", label: AXIS_INFO.A.label },
  { key: "B", label: AXIS_INFO.B.label },
  { key: "C", label: AXIS_INFO.C.label },
  { key: "D", label: AXIS_INFO.D.label },
];

export function SelfTrendView({ trend }: { trend: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>("overall");

  if (trend.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">자사 추이</h1>
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          아직 추이 데이터가 없습니다. 다음을 1회 이상 실행하세요:
          <code className="mono ml-1">pnpm exec tsx packages/scoring/scripts/gen-measured.ts</code>
        </p>
      </div>
    );
  }

  const label = METRICS.find((m) => m.key === metric)!.label;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">자사 추이</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        측정 시점별 자사(파라메타) 점수 변화. 항상 현재 평가 기준으로 재계산됩니다.
      </p>

      <div className="mt-6 inline-flex overflow-hidden rounded-md border" style={{ borderColor: "var(--line)" }} role="tablist">
        {METRICS.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={metric === m.key}
            onClick={() => setMetric(m.key)}
            className="mono px-3 py-1.5 text-xs"
            style={{
              background: metric === m.key ? "var(--signal)" : "transparent",
              color: metric === m.key ? "#0e1116" : "var(--muted)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {trend.length === 1 && (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          측정이 1회뿐입니다. 추이 선은 2회차 측정부터 그려집니다.
        </p>
      )}

      <div className="mt-6">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "var(--bg)", border: "1px solid var(--line)", fontSize: 12 }}
              formatter={(v: number | string | (number | string)[]) => [v ?? "—", label]}
            />
            <Line
              type="monotone"
              dataKey={metric}
              name={label}
              stroke="var(--signal)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
