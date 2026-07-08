import { describe, it, expect } from "vitest";
import { metricRowsForView } from "../lib/data/metricRows.js";
import type { MetricScore } from "@ai-benchmark/core";

const scores: MetricScore[] = [
  { axis: "A", metricKey: "robots_allowed", model: "rule-based", score: 100 },
  { axis: "C", metricKey: "clarity", model: "claude-x", score: 60, evidence: "cl" },
  { axis: "C", metricKey: "clarity", model: "gpt-x", score: 80, evidence: "gp" },
];

describe("metricRowsForView", () => {
  it("collapses to one row per metric for the average view", () => {
    const rows = metricRowsForView(scores, "average");
    const clarity = rows.find((r) => r.metricKey === "clarity")!;
    expect(clarity.score).toBe(70);
    expect(rows.filter((r) => r.metricKey === "clarity")).toHaveLength(1);
  });
  it("uses the selected model for the model view", () => {
    const rows = metricRowsForView(scores, { model: "gpt-x" });
    expect(rows.find((r) => r.metricKey === "clarity")!.score).toBe(80);
    expect(rows.find((r) => r.metricKey === "clarity")!.evidence).toBe("gp");
  });
  it("sorts by axis then metricKey", () => {
    const rows = metricRowsForView(scores, "average");
    expect(rows[0].axis).toBe("A");
  });
});
