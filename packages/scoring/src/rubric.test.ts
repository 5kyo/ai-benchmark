import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadAxisCMetrics, loadRubricText } from "./rubric.js";

const here = dirname(fileURLToPath(import.meta.url));
const weightsPath = resolve(here, "../../../config/weights.yaml");
const rubricPath = resolve(here, "../../../config/rubric/rubric_v1.md");

describe("loadAxisCMetrics", () => {
  it("loads exactly the four axis-C metric keys from weights.yaml", () => {
    const metrics = loadAxisCMetrics(weightsPath);
    const keys = metrics.map((m) => m.key).sort();
    expect(keys).toEqual(["clarity", "freshness_clarity", "key_info_present", "product_depth"]);
  });

  it("metric weights sum to 1.0", () => {
    const sum = loadAxisCMetrics(weightsPath).reduce((a, m) => a + m.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("loadRubricText", () => {
  it("returns the rubric markdown text", () => {
    expect(loadRubricText(rubricPath)).toContain("clarity");
  });
});
