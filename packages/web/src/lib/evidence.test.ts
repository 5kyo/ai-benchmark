import { describe, it, expect } from "vitest";
import type { Axis } from "@ai-benchmark/core";
import type { MetricRow } from "./data/metricRows.js";
import { firstSentence, pickRowEvidence } from "./evidence.js";

function row(p: Partial<MetricRow> & { axis: Axis; metricKey: string; score: number | null }): MetricRow {
  return p as MetricRow;
}

describe("firstSentence", () => {
  it("2문장 근거에서 첫 문장만 취한다", () => {
    expect(firstSentence("슬로건이 20회 반복된다. 후처리하면 쓸 수 있다.")).toBe("슬로건이 20회 반복된다.");
  });
  it("문장 구분 마침표가 없으면 전체를 반환한다", () => {
    expect(firstSentence("표 없이 문단만 나열됨")).toBe("표 없이 문단만 나열됨");
  });
  it("소수점은 문장 끝으로 보지 않는다", () => {
    expect(firstSentence("응답에 약 4.5초 걸린다. 느리다.")).toBe("응답에 약 4.5초 걸린다.");
  });
});

describe("pickRowEvidence", () => {
  it("행 evidence의 첫 문장을 고른다", () => {
    const r = row({ axis: "A", metricKey: "content_extractability", score: 60, evidence: "핵심은 텍스트로 추출된다. 다만 반복이 많다." });
    expect(pickRowEvidence(r)).toBe("핵심은 텍스트로 추출된다.");
  });
  it("perModel이 있으면 행 점수에 가장 가까운 모델 근거를 고른다", () => {
    const r = row({
      axis: "C",
      metricKey: "clarity",
      score: 45,
      perModel: [
        { model: "hi", score: 80, evidence: "높음 근거." },
        { model: "lo", score: 40, evidence: "낮음 근거." },
      ],
    });
    expect(pickRowEvidence(r)).toBe("낮음 근거.");
  });
  it("근거가 없으면 undefined", () => {
    expect(pickRowEvidence(row({ axis: "A", metricKey: "robots_allowed", score: 100 }))).toBeUndefined();
  });
});
