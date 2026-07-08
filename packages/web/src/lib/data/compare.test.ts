import { describe, it, expect } from "vitest";
import { losingMetrics, modelDeltas } from "./compare.js";
import type { CompanyRecord } from "./types.js";
import type { MetricScore } from "@ai-benchmark/core";

function co(slug: string, isSelf: boolean, scores: MetricScore[]): CompanyRecord {
  return { slug, name: slug, homepageUrl: "https://x", isSelf, scores };
}
const self = co("us", true, [
  { axis: "A", metricKey: "sitemap_present", model: "rule-based", score: 0 },
  { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 100 },
]);
const rival = co("riv", false, [
  { axis: "A", metricKey: "sitemap_present", model: "rule-based", score: 100 },
  { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 100 },
]);

describe("losingMetrics", () => {
  it("finds metrics where a competitor beats us, gap desc", () => {
    const gaps = losingMetrics(self, [rival], "average");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].metricKey).toBe("sitemap_present");
    expect(gaps[0].gap).toBe(100);
    expect(gaps[0].bestName).toBe("riv");
  });
});

describe("modelDeltas", () => {
  it("computes per-metric score delta between two models", () => {
    const c = co("x", false, [
      { axis: "C", metricKey: "clarity", model: "claude", score: 60 },
      { axis: "C", metricKey: "clarity", model: "gpt", score: 90 },
    ]);
    const d = modelDeltas(c, "claude", "gpt");
    expect(d[0].metricKey).toBe("clarity");
    expect(d[0].delta).toBe(30);
  });
});
