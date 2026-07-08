import type { Axis } from "@ai-benchmark/core";
import { loadWeights } from "@ai-benchmark/core";

export interface AxisInfo {
  axis: Axis;
  weight: number;
  label: string;
  metrics: { key: string; weight: number }[];
  scorer: "규칙" | "LLM";
}

const LABELS: Record<Axis, string> = { A: "크롤링/접근성", B: "구조화/시맨틱", C: "콘텐츠 품질", D: "응답성/기술 품질" };

export function loadMethodology(weightsPath: string): AxisInfo[] {
  const w = loadWeights(weightsPath);
  const axes: Axis[] = ["A", "B", "C", "D"];
  return axes.map((axis) => ({
    axis,
    weight: w.axes[axis],
    label: LABELS[axis],
    metrics: Object.entries(w.metrics[axis] ?? {}).map(([key, weight]) => ({ key, weight })),
    scorer: axis === "C" ? "LLM" : "규칙",
  }));
}
