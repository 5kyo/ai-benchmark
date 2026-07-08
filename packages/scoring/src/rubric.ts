import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface AxisCMetric {
  key: string;
  weight: number;
}

/** config/weights.yaml의 축 C 지표 키·가중치를 읽는다 (단일 출처). */
export function loadAxisCMetrics(weightsPath: string): AxisCMetric[] {
  const doc = parse(readFileSync(weightsPath, "utf8")) as {
    metrics?: { C?: Record<string, number> };
  };
  const c = doc.metrics?.C ?? {};
  return Object.entries(c).map(([key, weight]) => ({ key, weight }));
}

export function loadRubricText(rubricPath: string): string {
  return readFileSync(rubricPath, "utf8");
}
