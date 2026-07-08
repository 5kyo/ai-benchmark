import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { metricScoreConflictTarget } from "./model-scores.js";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "../migrations/0001_init.sql"), "utf8").toLowerCase();

describe("metricScoreConflictTarget", () => {
  it("matches the metric_scores unique key in the migration", () => {
    const target = metricScoreConflictTarget();
    expect(target).toBe("scan_id,axis,metric_key,model");
    // 스키마의 unique 절과 컬럼 집합이 일치하는지 방어적으로 확인
    expect(sql).toContain("unique (scan_id, axis, metric_key, model)");
  });
});
