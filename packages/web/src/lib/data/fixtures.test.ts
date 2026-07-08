import { describe, it, expect } from "vitest";
import { fixtureCompanies } from "./fixtures.js";
import { buildRanking, listModels } from "./build.js";
import { loadWeights } from "@ai-benchmark/core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const w = loadWeights(resolve(here, "../../../../../config/weights.yaml"));

describe("fixtureCompanies", () => {
  const cos = fixtureCompanies();
  it("has at least 3 companies including exactly one self", () => {
    expect(cos.length).toBeGreaterThanOrEqual(3);
    expect(cos.filter((c) => c.isSelf)).toHaveLength(1);
  });
  it("includes rule-based and two LLM models", () => {
    expect(listModels(cos)).toEqual(expect.arrayContaining(["claude", "gpt"].map((m) => expect.stringContaining(m))));
    expect(cos.every((c) => c.scores.some((s) => s.model === "rule-based"))).toBe(true);
  });
  it("produces a valid ranking with the real weights", () => {
    const rows = buildRanking(cos, w, "average");
    expect(rows).toHaveLength(cos.length);
    expect(rows.every((r) => r.overall == null || (r.overall >= 0 && r.overall <= 100))).toBe(true);
  });
});
