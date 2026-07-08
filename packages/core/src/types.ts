export type Axis = "A" | "B" | "C" | "D";
export type ModelId = string; // 규칙 점수는 "rule-based"

export interface MetricScore {
  axis: Axis;
  metricKey: string;
  model: ModelId;
  score: number; // 0..100
  evidence?: string;
  rawDetail?: Record<string, unknown>;
}

export interface Weights {
  axes: Record<Axis, number>;
  metrics: Record<Axis, Record<string, number>>;
}
