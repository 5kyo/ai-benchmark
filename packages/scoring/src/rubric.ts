import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Axis } from "@ai-benchmark/core";

export interface AxisCMetric {
  key: string;
  weight: number;
}

export interface LlmMetric {
  axis: Axis;
  key: string;
  weight: number;
}

/** LLM이 채점하는 지표 키(규칙 지표 제외). 축 A·B·D는 하이브리드, 축 C는 전부 LLM. */
export const LLM_METRIC_KEYS = new Set<string>([
  // A 접근성
  "agent_findability",
  "content_extractability",
  // B 구조화
  "logical_organization",
  "info_scannability",
  // C 콘텐츠
  "clarity",
  "product_depth",
  "key_info_present",
  "freshness_clarity",
  // D 기술 품질
  "technical_depth",
  "content_polish",
]);

const AXES: Axis[] = ["A", "B", "C", "D"];

function readMetrics(weightsPath: string): Record<string, Record<string, number>> {
  const doc = parse(readFileSync(weightsPath, "utf8")) as {
    metrics?: Record<string, Record<string, number>>;
  };
  return doc.metrics ?? {};
}

/** config/weights.yaml의 축 C 지표 키·가중치를 읽는다. */
export function loadAxisCMetrics(weightsPath: string): AxisCMetric[] {
  const c = readMetrics(weightsPath).C ?? {};
  return Object.entries(c).map(([key, weight]) => ({ key, weight }));
}

/** 전 축의 LLM 지표(축·키·가중치)를 weights.yaml에서 읽는다 (단일 출처). */
export function loadLlmMetrics(weightsPath: string): LlmMetric[] {
  const metrics = readMetrics(weightsPath);
  const out: LlmMetric[] = [];
  for (const axis of AXES) {
    for (const [key, weight] of Object.entries(metrics[axis] ?? {})) {
      if (LLM_METRIC_KEYS.has(key)) out.push({ axis, key, weight });
    }
  }
  return out;
}

/** LLM 지표 키 → 축 매핑. */
export function llmAxisByKey(weightsPath: string): Record<string, Axis> {
  const map: Record<string, Axis> = {};
  for (const m of loadLlmMetrics(weightsPath)) map[m.key] = m.axis;
  return map;
}

export function loadRubricText(rubricPath: string): string {
  return readFileSync(rubricPath, "utf8");
}
