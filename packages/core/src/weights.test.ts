import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadWeights } from "./weights.js";

const here = dirname(fileURLToPath(import.meta.url));
const weightsPath = resolve(here, "../../../config/weights.yaml");

describe("loadWeights", () => {
  it("loads axis weights that sum to 1.0", () => {
    const w = loadWeights(weightsPath);
    const sum = w.axes.A + w.axes.B + w.axes.C + w.axes.D;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("loads axis A metric weights that sum to 1.0", () => {
    const w = loadWeights(weightsPath);
    const sum = Object.values(w.metrics.A).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
