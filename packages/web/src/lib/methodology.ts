import type { Axis } from "@ai-benchmark/core";
import { loadWeights } from "@ai-benchmark/core";
import { metricScorer } from "./glossary.js";

export interface MethodologyMetric {
  key: string;
  weight: number;
  scorer: "규칙" | "LLM";
}

export interface AxisInfo {
  axis: Axis;
  weight: number;
  metrics: MethodologyMetric[];
  scorer: "규칙" | "LLM" | "규칙+LLM"; // 축 전체 채점 방식 요약
}

export function loadMethodology(weightsPath: string): AxisInfo[] {
  const w = loadWeights(weightsPath);
  const axes: Axis[] = ["A", "B", "C", "D"];
  return axes.map((axis) => {
    const metrics = Object.entries(w.metrics[axis] ?? {}).map(([key, weight]) => ({
      key,
      weight,
      scorer: metricScorer(key),
    }));
    const hasRule = metrics.some((m) => m.scorer === "규칙");
    const hasLlm = metrics.some((m) => m.scorer === "LLM");
    const scorer: AxisInfo["scorer"] = hasRule && hasLlm ? "규칙+LLM" : hasLlm ? "LLM" : "규칙";
    return { axis, weight: w.axes[axis], metrics, scorer };
  });
}
