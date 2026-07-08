import { describe, it, expect } from "vitest";
import { parseAndValidate, toAxisCScores } from "./schema.js";

const KEYS = ["clarity", "product_depth", "key_info_present", "freshness_clarity"];

function validJson(over: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    slug: "acme",
    model: "claude-opus-4-8",
    rubricVersion: "rubric_v1",
    scores: [
      { metricKey: "clarity", score: 80, evidence: "명확" },
      { metricKey: "product_depth", score: 60, evidence: "보통" },
      { metricKey: "key_info_present", score: 40, evidence: "부족" },
      { metricKey: "freshness_clarity", score: 70, evidence: "최신" },
    ],
    ...over,
  });
}

describe("parseAndValidate", () => {
  it("accepts a well-formed output with all four metrics", () => {
    const out = parseAndValidate(validJson(), KEYS);
    expect(out.slug).toBe("acme");
    expect(out.model).toBe("claude-opus-4-8");
    expect(out.scores).toHaveLength(4);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAndValidate("{not json", KEYS)).toThrow(/invalid JSON/);
  });

  it("throws when a required metric is missing", () => {
    const missing = JSON.stringify({
      slug: "acme", model: "gpt-x", rubricVersion: "rubric_v1",
      scores: [{ metricKey: "clarity", score: 80, evidence: "x" }],
    });
    expect(() => parseAndValidate(missing, KEYS)).toThrow(/missing metric/);
  });

  it("throws when a score is out of range", () => {
    const bad = validJson({
      scores: [
        { metricKey: "clarity", score: 120, evidence: "x" },
        { metricKey: "product_depth", score: 60, evidence: "x" },
        { metricKey: "key_info_present", score: 40, evidence: "x" },
        { metricKey: "freshness_clarity", score: 70, evidence: "x" },
      ],
    });
    expect(() => parseAndValidate(bad, KEYS)).toThrow(/out of range/);
  });

  it("throws on an unexpected extra metric", () => {
    const extra = validJson({
      scores: [
        { metricKey: "clarity", score: 80, evidence: "x" },
        { metricKey: "product_depth", score: 60, evidence: "x" },
        { metricKey: "key_info_present", score: 40, evidence: "x" },
        { metricKey: "freshness_clarity", score: 70, evidence: "x" },
        { metricKey: "made_up", score: 50, evidence: "x" },
      ],
    });
    expect(() => parseAndValidate(extra, KEYS)).toThrow(/unexpected metric/);
  });

  it("throws when model is missing", () => {
    expect(() => parseAndValidate(validJson({ model: "" }), KEYS)).toThrow(/missing model/);
  });
});

describe("toAxisCScores", () => {
  it("maps a validated output to axis-C MetricScores tagged with the model", () => {
    const out = parseAndValidate(validJson(), KEYS);
    const scores = toAxisCScores(out);
    expect(scores).toHaveLength(4);
    expect(scores.every((s) => s.axis === "C" && s.model === "claude-opus-4-8")).toBe(true);
    const clarity = scores.find((s) => s.metricKey === "clarity")!;
    expect(clarity.score).toBe(80);
    expect(clarity.evidence).toBe("명확");
  });
});
