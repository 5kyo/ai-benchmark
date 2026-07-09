import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { loadSnapshotHistory, buildSelfTrend } from "./history.js";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";

const weights = loadWeights(resolve(process.cwd(), "config/weights.yaml"));

function selfRecord(): CompanyRecord {
  return {
    slug: "parameta",
    name: "파라메타",
    homepageUrl: "https://example.com",
    isSelf: true,
    scores: [{ axis: "A", metricKey: "robots_allowed", model: "rule-based", score: 100 }],
  };
}

describe("loadSnapshotHistory", () => {
  it("없는 디렉터리는 빈 배열", () => {
    expect(loadSnapshotHistory(resolve(tmpdir(), "definitely-missing-xyz"))).toEqual([]);
  });

  it("날짜 오름차순 정렬 + 깨진 파일 skip", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "snap-"));
    writeFileSync(resolve(dir, "2026-07-09.json"), JSON.stringify({ date: "2026-07-09", companies: [] }));
    writeFileSync(resolve(dir, "2026-07-08.json"), JSON.stringify({ date: "2026-07-08", companies: [] }));
    writeFileSync(resolve(dir, "broken.json"), "{ not json");
    writeFileSync(resolve(dir, "no-date.json"), JSON.stringify({ companies: [] }));
    const hist = loadSnapshotHistory(dir);
    expect(hist.map((d) => d.date)).toEqual(["2026-07-08", "2026-07-09"]);
  });
});

describe("buildSelfTrend", () => {
  it("자사 레코드의 종합/축 점수를 core로 파생한다", () => {
    const self = selfRecord();
    const hist = [{ date: "2026-07-08", companies: [self] }];
    const trend = buildSelfTrend(hist, weights, "average");
    expect(trend).toHaveLength(1);
    expect(trend[0].date).toBe("2026-07-08");
    expect(trend[0].overall).toBe(overallForView(self.scores, weights, "average"));
    expect(trend[0].A).toBe(axisForView(self.scores, "A", weights, "average"));
  });

  it("자사 레코드가 없는 날은 제외한다", () => {
    const other: CompanyRecord = { ...selfRecord(), slug: "x", isSelf: false };
    const hist = [{ date: "2026-07-08", companies: [other] }];
    expect(buildSelfTrend(hist, weights, "average")).toEqual([]);
  });
});
