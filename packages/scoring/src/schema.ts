import type { Axis, MetricScore } from "@ai-benchmark/core";

export interface ScoreEntry {
  metricKey: string;
  score: number;
  evidence: string;
}

export interface ScoreOutput {
  slug: string;
  model: string;
  rubricVersion: string;
  scores: ScoreEntry[];
}

/** LLM 출력 JSON을 파싱·검증한다. 형식/범위/지표 집합 불일치 시 throw. */
export function parseAndValidate(raw: string, expectedMetricKeys: string[]): ScoreOutput {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new Error("invalid JSON");
  }
  const d = doc as Record<string, unknown>;
  if (typeof d.slug !== "string" || d.slug.length === 0) throw new Error("missing slug");
  if (typeof d.model !== "string" || d.model.length === 0) throw new Error("missing model");
  if (typeof d.rubricVersion !== "string") throw new Error("missing rubricVersion");
  if (!Array.isArray(d.scores)) throw new Error("missing scores array");

  const seen = new Set<string>();
  for (const entry of d.scores as unknown[]) {
    const e = entry as Record<string, unknown>;
    if (typeof e.metricKey !== "string") throw new Error("score entry missing metricKey");
    if (typeof e.score !== "number" || e.score < 0 || e.score > 100) {
      throw new Error(`score out of range for ${String(e.metricKey)}`);
    }
    if (typeof e.evidence !== "string") throw new Error(`missing evidence for ${String(e.metricKey)}`);
    if (seen.has(e.metricKey)) throw new Error(`duplicate metric ${e.metricKey}`);
    seen.add(e.metricKey);
  }
  for (const key of expectedMetricKeys) {
    if (!seen.has(key)) throw new Error(`missing metric ${key}`);
  }
  const extra = [...seen].filter((k) => !expectedMetricKeys.includes(k));
  if (extra.length) throw new Error(`unexpected metric(s): ${extra.join(", ")}`);

  return d as unknown as ScoreOutput;
}

/** 검증된 출력을 MetricScore[]로 매핑. 각 지표는 axisByKey로 축을 배정(모델 태그 부여). */
export function toLlmScores(output: ScoreOutput, axisByKey: Record<string, Axis>): MetricScore[] {
  return output.scores.map((s) => {
    const axis = axisByKey[s.metricKey];
    if (!axis) throw new Error(`unknown axis for metric ${s.metricKey}`);
    return {
      axis,
      metricKey: s.metricKey,
      model: output.model,
      score: s.score,
      evidence: s.evidence,
    };
  });
}
