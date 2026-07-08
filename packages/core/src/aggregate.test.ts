import { describe, it, expect } from "vitest";
import { axisScore, overallScore } from "./aggregate.js";
import type { MetricScore, Weights } from "./types.js";

const w: Weights = {
  axes: { A: 0.5, B: 0.5, C: 0, D: 0 },
  metrics: {
    A: { m1: 0.5, m2: 0.5 },
    B: { m3: 1.0 },
    C: {},
    D: {},
  },
};

function s(axis: MetricScore["axis"], metricKey: string, score: number): MetricScore {
  return { axis, metricKey, model: "rule-based", score };
}

describe("axisScore", () => {
  it("weighted-averages present metrics", () => {
    const scores = [s("A", "m1", 80), s("A", "m2", 40)];
    expect(axisScore(scores, "A", w)).toBe(60);
  });

  it("renormalizes over present metrics when some are missing", () => {
    const scores = [s("A", "m1", 80)]; // m2 없음 → m1 가중치 재정규화 → 80
    expect(axisScore(scores, "A", w)).toBe(80);
  });

  it("returns null when axis has no scores", () => {
    expect(axisScore([], "A", w)).toBeNull();
  });
});

describe("overallScore", () => {
  it("weighted-averages present axes, renormalizing axis weights", () => {
    // A=60, B=90. axis weights A:0.5 B:0.5 → 75
    const scores = [s("A", "m1", 80), s("A", "m2", 40), s("B", "m3", 90)];
    expect(overallScore(scores, w)).toBe(75);
  });

  it("renormalizes when an axis is absent (e.g. C not scored yet)", () => {
    // A만 존재(=60) → 재정규화 → 60
    const scores = [s("A", "m1", 80), s("A", "m2", 40)];
    expect(overallScore(scores, w)).toBe(60);
  });
});
