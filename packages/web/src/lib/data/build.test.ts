import { describe, it, expect } from "vitest";
import { buildRanking, listModels, industryAverage } from "./build.js";
import type { CompanyRecord } from "./types.js";
import type { MetricScore, Weights } from "@ai-benchmark/core";

const w: Weights = {
  axes: { A: 0.5, B: 0, C: 0.5, D: 0 },
  metrics: { A: { a1: 1 }, B: {}, C: { c1: 1 }, D: {} },
};
function s(axis: MetricScore["axis"], k: string, model: string, score: number): MetricScore {
  return { axis, metricKey: k, model, score };
}
const companies: CompanyRecord[] = [
  { slug: "us", name: "Us", homepageUrl: "https://us", isSelf: true,
    scores: [s("A", "a1", "rule-based", 80), s("C", "c1", "claude-x", 40), s("C", "c1", "gpt-x", 60)] },
  { slug: "riv", name: "Rival", homepageUrl: "https://riv", isSelf: false,
    scores: [s("A", "a1", "rule-based", 60), s("C", "c1", "claude-x", 100), s("C", "c1", "gpt-x", 100)] },
];

describe("buildRanking", () => {
  it("ranks by overall desc for the average view", () => {
    // us: A80,C avg50 → 65 ; riv: A60,C100 → 80 → riv first
    const rows = buildRanking(companies, w, "average");
    expect(rows.map((r) => r.slug)).toEqual(["riv", "us"]);
    expect(rows.find((r) => r.slug === "us")!.overall).toBe(65);
  });
  it("recomputes per model view", () => {
    // claude: us A80,C40→60 ; riv A60,C100→80
    const rows = buildRanking(companies, w, { model: "claude-x" });
    expect(rows.find((r) => r.slug === "us")!.overall).toBe(60);
  });
  it("includes per-axis scores", () => {
    const rows = buildRanking(companies, w, "average");
    const us = rows.find((r) => r.slug === "us")!;
    expect(us.axes.find((a) => a.axis === "C")!.score).toBe(50);
  });
});

describe("listModels", () => {
  it("returns unique sorted LLM models, excluding rule-based", () => {
    expect(listModels(companies)).toEqual(["claude-x", "gpt-x"]);
  });
});

describe("industryAverage", () => {
  it("averages overall across rows", () => {
    const rows = buildRanking(companies, w, "average"); // 80, 65
    expect(industryAverage(rows)).toBe(72.5);
  });
});
