import { describe, it, expect } from "vitest";
import { loadMethodology } from "./methodology.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const weightsPath = resolve(here, "../../../../config/weights.yaml");

describe("loadMethodology", () => {
  const axes = loadMethodology(weightsPath);
  it("returns four axes whose weights sum to 1.0", () => {
    expect(axes).toHaveLength(4);
    expect(axes.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1.0, 5);
  });
  it("marks axis C as LLM-only and axes A/B/D as hybrid (규칙+LLM)", () => {
    expect(axes.find((a) => a.axis === "C")!.scorer).toBe("LLM");
    expect(axes.find((a) => a.axis === "A")!.scorer).toBe("규칙+LLM");
    expect(axes.find((a) => a.axis === "D")!.scorer).toBe("규칙+LLM");
  });
  it("tags each metric with its scorer (규칙/LLM)", () => {
    const a = axes.find((x) => x.axis === "A")!;
    expect(a.metrics.find((m) => m.key === "agent_findability")!.scorer).toBe("LLM");
    expect(a.metrics.find((m) => m.key === "robots_allowed")!.scorer).toBe("규칙");
  });
  it("lists axis C metric keys", () => {
    const c = axes.find((a) => a.axis === "C")!;
    expect(c.metrics.map((m) => m.key).sort()).toEqual(["clarity", "freshness_clarity", "key_info_present", "product_depth"]);
  });
});
