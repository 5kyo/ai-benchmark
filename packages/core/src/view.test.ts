import { describe, it, expect } from "vitest";
import { collapseForView, axisForView, overallForView } from "./view.js";
import type { MetricScore, Weights } from "./types.js";

const w: Weights = {
  axes: { A: 0.5, B: 0, C: 0.5, D: 0 },
  metrics: { A: { m1: 1.0 }, B: {}, C: { c1: 0.5, c2: 0.5 }, D: {} },
};

function ms(axis: MetricScore["axis"], metricKey: string, model: string, score: number): MetricScore {
  return { axis, metricKey, model, score };
}

describe("collapseForView", () => {
  const scores: MetricScore[] = [
    ms("A", "m1", "rule-based", 80),
    ms("C", "c1", "claude-x", 60),
    ms("C", "c1", "gpt-x", 100),
    ms("C", "c2", "claude-x", 40),
    ms("C", "c2", "gpt-x", 60),
  ];

  it("average view collapses each C metric to the model mean and keeps rule scores", () => {
    const out = collapseForView(scores, "average");
    const c1 = out.find((s) => s.axis === "C" && s.metricKey === "c1")!;
    expect(c1.score).toBe(80); // (60+100)/2
    expect(c1.model).toBe("average");
    expect(out.find((s) => s.metricKey === "m1")!.score).toBe(80); // rule kept
    // 지표당 1점만 남는다: C c1,c2 각각 1개 + A m1 1개 = 3
    expect(out).toHaveLength(3);
  });

  it("model view keeps only that model's C scores", () => {
    const out = collapseForView(scores, { model: "gpt-x" });
    expect(out.find((s) => s.metricKey === "c1")!.score).toBe(100);
    expect(out.find((s) => s.metricKey === "c2")!.score).toBe(60);
    expect(out.some((s) => s.model === "claude-x")).toBe(false);
  });
});

describe("axisForView / overallForView", () => {
  const scores: MetricScore[] = [
    ms("A", "m1", "rule-based", 80),
    ms("C", "c1", "claude-x", 60),
    ms("C", "c1", "gpt-x", 100),
    ms("C", "c2", "claude-x", 40),
    ms("C", "c2", "gpt-x", 60),
  ];

  it("axis C differs by view", () => {
    // claude: c1=60,c2=40 → 0.5*60+0.5*40=50 ; gpt: c1=100,c2=60 → 80 ; average: 65
    expect(axisForView(scores, "C", w, { model: "claude-x" })).toBe(50);
    expect(axisForView(scores, "C", w, { model: "gpt-x" })).toBe(80);
    expect(axisForView(scores, "C", w, "average")).toBe(65);
  });

  it("overall combines rule axis A with the chosen C view (no double counting)", () => {
    // axes A:0.5 C:0.5 → average: 0.5*80 + 0.5*65 = 72.5
    expect(overallForView(scores, w, "average")).toBe(72.5);
    // claude: 0.5*80 + 0.5*50 = 65
    expect(overallForView(scores, w, { model: "claude-x" })).toBe(65);
  });
});
