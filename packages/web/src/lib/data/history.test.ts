import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
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

/** 4개 축(A/B/C/D) 모두에 실데이터 기준 지표를 하나씩 채워 서로 다른 값으로 집계되게 한다.
 * (B/C/D 필드가 뒤섞이는 매핑 버그를 잡기 위함 — 축당 지표가 하나뿐이면 가중 재정규화 결과가
 * 곧 그 지표의 score와 같아지므로 기대값을 축별로 명확히 구분할 수 있다.) */
function selfRecordAllAxes(): CompanyRecord {
  return {
    slug: "parameta",
    name: "파라메타",
    homepageUrl: "https://example.com",
    isSelf: true,
    scores: [
      { axis: "A", metricKey: "robots_allowed", model: "rule-based", score: 100 },
      { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 60 },
      { axis: "C", metricKey: "clarity", model: "claude-sonnet-5", score: 75 },
      { axis: "D", metricKey: "load_time", model: "rule-based", score: 40 },
    ],
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
    const self = selfRecordAllAxes();
    const hist = [{ date: "2026-07-08", companies: [self] }];
    const { points } = buildSelfTrend(hist, weights, "average");
    const point = points[0];
    expect(points).toHaveLength(1);
    expect(point.date).toBe("2026-07-08");
    expect(point.overall.average).toBe(overallForView(self.scores, weights, "average"));
    expect(point.A.average).toBe(axisForView(self.scores, "A", weights, "average"));
    expect(point.B.average).toBe(axisForView(self.scores, "B", weights, "average"));
    expect(point.C.average).toBe(axisForView(self.scores, "C", weights, "average"));
    expect(point.D.average).toBe(axisForView(self.scores, "D", weights, "average"));
    // 모든 축이 null이 아니고, 서로 다른 값이어야 B/C/D 필드가 뒤섞이는 매핑 버그를 잡는다.
    expect(point.A.average).not.toBeNull();
    expect(point.B.average).not.toBeNull();
    expect(point.C.average).not.toBeNull();
    expect(point.D.average).not.toBeNull();
    const axisValues = [point.A.average, point.B.average, point.C.average, point.D.average];
    expect(new Set(axisValues).size).toBe(axisValues.length);
  });

  it("자사 점수의 LLM 모델을 수집해 지표별 모델값을 파생한다(규칙·평균 제외)", () => {
    const self = selfRecordAllAxes(); // C축에 claude-sonnet-5 LLM 점수 포함
    const hist = [{ date: "2026-07-08", companies: [self] }];
    const { points, models } = buildSelfTrend(hist, weights, "average");
    expect(models).toEqual(["claude-sonnet-5"]);
    expect(points[0].C.byModel["claude-sonnet-5"]).toBe(
      axisForView(self.scores, "C", weights, { model: "claude-sonnet-5" }),
    );
  });

  it("자사 레코드가 없는 날은 제외한다", () => {
    const other: CompanyRecord = { ...selfRecord(), slug: "x", isSelf: false };
    const hist = [{ date: "2026-07-08", companies: [other] }];
    expect(buildSelfTrend(hist, weights, "average").points).toEqual([]);
  });

  it("자사 레코드의 scores가 배열이 아니면(누락 포함) 예외 없이 해당 날짜를 skip한다", () => {
    // 런타임에 손상된 스냅샷(scores 누락)을 고의로 모델링하는 테스트 픽스처이므로,
    // 실제 타입을 약화하지 않고 object 리터럴을 만든 뒤 unknown을 경유해 좁게 캐스팅한다.
    const malformedSelf = {
      slug: "parameta",
      name: "파라메타",
      homepageUrl: "https://example.com",
      isSelf: true,
      // scores 필드 자체가 없음(undefined) — 배열이 아닌 경우를 대표
    } as unknown as CompanyRecord;
    const hist = [{ date: "2026-07-08", companies: [malformedSelf] }];
    expect(() => buildSelfTrend(hist, weights, "average")).not.toThrow();
    expect(buildSelfTrend(hist, weights, "average").points).toHaveLength(0);
  });
});
