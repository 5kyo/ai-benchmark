import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "0001_init.sql"), "utf8").toLowerCase();

describe("0001_init schema", () => {
  it("defines all four core tables", () => {
    for (const t of ["companies", "scans", "metric_scores", "improvements"]) {
      expect(sql).toContain(`create table if not exists ${t}`);
    }
  });

  it("constrains axis to A/B/C/D", () => {
    expect(sql).toContain("axis in ('a','b','c','d')");
  });

  it("constrains score to 0..100", () => {
    expect(sql).toContain("score >= 0 and score <= 100");
  });

  it("uniquely keys a metric score by scan/axis/metric/model", () => {
    expect(sql).toContain("unique (scan_id, axis, metric_key, model)");
  });
});
