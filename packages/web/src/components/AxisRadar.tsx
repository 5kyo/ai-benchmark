"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import type { Axis } from "@ai-benchmark/core";

export interface RadarSeries {
  label: string;
  color: string;
  values: { axis: Axis; score: number | null }[];
}
const AXIS_LABEL: Record<Axis, string> = { A: "접근성", B: "구조화", C: "콘텐츠", D: "기술위생" };

export function AxisRadar({ series }: { series: RadarSeries[] }) {
  const axes: Axis[] = ["A", "B", "C", "D"];
  const data = axes.map((axis) => {
    const row: Record<string, string | number> = { axis: AXIS_LABEL[axis] };
    series.forEach((s) => (row[s.label] = s.values.find((v) => v.axis === axis)?.score ?? 0));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--line)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted)", fontSize: 12 }} />
        {series.map((s) => (
          <Radar key={s.label} dataKey={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
