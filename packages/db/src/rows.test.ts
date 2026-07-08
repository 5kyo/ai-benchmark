import { describe, it, expect } from "vitest";
import { toMetricScoreRows, toImprovementRows } from "./rows.js";
import type { MetricScore } from "@ai-benchmark/core";

describe("toMetricScoreRows", () => {
  it("maps camelCase MetricScore to snake_case DB rows", () => {
    const scores: MetricScore[] = [
      { axis: "A", metricKey: "sitemap_present", model: "rule-based", score: 100, evidence: "found" },
      { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 0 },
    ];
    const rows = toMetricScoreRows("scan-1", scores);
    expect(rows[0]).toEqual({
      scan_id: "scan-1", axis: "A", metric_key: "sitemap_present",
      model: "rule-based", score: 100, evidence: "found", raw_detail: null,
    });
    expect(rows[1].evidence).toBeNull();
  });
});

describe("toImprovementRows", () => {
  it("maps improvements to DB rows", () => {
    const rows = toImprovementRows("scan-1", [
      { axis: "A", metricKey: "llms_txt_present", severity: 100, message: "m", suggestion: "s" },
    ]);
    expect(rows[0]).toEqual({
      scan_id: "scan-1", axis: "A", metric_key: "llms_txt_present",
      severity: 100, message: "m", suggestion: "s",
    });
  });
});
