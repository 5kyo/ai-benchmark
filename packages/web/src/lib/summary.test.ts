import { describe, it, expect } from "vitest";
import type { Axis } from "@ai-benchmark/core";
import type { MetricRow } from "./data/metricRows.js";
import type { AxisScore } from "./data/types.js";
import { buildSummary } from "./summary.js";

function row(partial: Partial<MetricRow> & { axis: Axis; metricKey: string; score: number | null }): MetricRow {
  return partial as MetricRow;
}

const AXES: AxisScore[] = [
  { axis: "A", score: 90 },
  { axis: "B", score: 84 },
  { axis: "C", score: 88 },
  { axis: "D", score: 92 },
];

describe("buildSummary — 근거(evidence) 합성", () => {
  it("약점 항목에 근거 첫 문장과 개선 제안을 함께 붙인다", () => {
    const rows = [
      row({
        axis: "A",
        metricKey: "content_extractability",
        score: 64,
        evidence: "슬로건이 캐러셀로 20회 이상 반복 추출된다. 다만 후처리하면 쓸 수 있다.",
      }),
    ];
    const { weaknesses } = buildSummary(rows, 64, AXES);
    const w = weaknesses.find((x) => x.metricKey === "content_extractability");
    expect(w).toBeTruthy();
    expect(w!.evidence).toBe("슬로건이 캐러셀로 20회 이상 반복 추출된다.");
    // suggestion은 glossary의 개선 제안과 동일해야 한다
    expect(w!.suggestion).toContain("텍스트");
  });

  it("근거에 문장 구분 마침표가 없으면 전체를 그대로 쓴다", () => {
    const rows = [row({ axis: "B", metricKey: "info_scannability", score: 50, evidence: "표 없이 문단만 나열됨" })];
    const { weaknesses } = buildSummary(rows, 50, AXES);
    expect(weaknesses[0].evidence).toBe("표 없이 문단만 나열됨");
  });

  it("평균 뷰 perModel에서 합쳐진 점수에 가장 가까운 모델의 근거를 고른다", () => {
    const rows = [
      row({
        axis: "C",
        metricKey: "clarity",
        score: 45,
        perModel: [
          { model: "m-high", score: 80, evidence: "높음 근거." },
          { model: "m-low", score: 40, evidence: "낮음 근거." },
        ],
      }),
    ];
    const { weaknesses } = buildSummary(rows, 45, AXES);
    expect(weaknesses[0].evidence).toBe("낮음 근거.");
  });
});

describe("buildSummary — 규칙 만점 묶기", () => {
  it("같은 축의 규칙 만점(100)이 2개 이상이면 하나의 '기본기' 항목으로 묶는다", () => {
    const rows = [
      row({ axis: "A", metricKey: "robots_allowed", score: 100 }),
      row({ axis: "A", metricKey: "sitemap_present", score: 100 }),
      row({ axis: "C", metricKey: "product_depth", score: 91, evidence: "제품 기능이 구체적으로 서술된다." }),
    ];
    const { strengths } = buildSummary(rows, 90, AXES);

    // LLM 강점은 개별 유지, 점수 순으로 앞에 온다
    const pd = strengths.find((s) => s.metricKey === "product_depth");
    expect(pd).toBeTruthy();
    expect(pd!.grouped).toBeFalsy();
    expect(pd!.evidence).toBe("제품 기능이 구체적으로 서술된다.");

    // 규칙 만점 2개는 개별로 남지 않고 묶음 1개로 대체된다
    expect(strengths.some((s) => s.metricKey === "robots_allowed")).toBe(false);
    expect(strengths.some((s) => s.metricKey === "sitemap_present")).toBe(false);
    const basics = strengths.find((s) => s.grouped);
    expect(basics).toBeTruthy();
    expect(basics!.label).toBe("접근성 기본기");
    expect(basics!.evidence).toContain("robots 허용");
    expect(basics!.evidence).toContain("사이트맵");

    // 개별 항목(LLM)이 묶음보다 앞에 온다
    expect(strengths.indexOf(pd!)).toBeLessThan(strengths.indexOf(basics!));
  });

  it("규칙 만점이 축에 1개뿐이면 묶지 않고 개별로 표시한다", () => {
    const rows = [
      row({ axis: "A", metricKey: "robots_allowed", score: 100 }),
      row({ axis: "C", metricKey: "product_depth", score: 88, evidence: "구체적." }),
    ];
    const { strengths } = buildSummary(rows, 90, AXES);
    expect(strengths.some((s) => s.grouped)).toBe(false);
    const robots = strengths.find((s) => s.metricKey === "robots_allowed");
    expect(robots).toBeTruthy();
    expect(robots!.label).toBe("robots 허용");
  });
});

describe("buildSummary — 기존 동작 회귀", () => {
  it("헤드라인에 종합·최고축·최저축을 담는다", () => {
    const { headline } = buildSummary([], 88, AXES);
    expect(headline).toContain("종합 88점");
    expect(headline).toContain("기술 품질(92)"); // 최고 축 D
    expect(headline).toContain("구조화(84)"); // 최저 축 B
  });

  it("60점 미만이 없으면 하위 항목으로 대체하고 fallback 표시한다", () => {
    const rows = [
      row({ axis: "A", metricKey: "robots_allowed", score: 90 }),
      row({ axis: "B", metricKey: "info_scannability", score: 74, evidence: "스캔 어려움." }),
    ];
    const { weaknesses, weakIsFallback } = buildSummary(rows, 82, AXES);
    expect(weakIsFallback).toBe(true);
    expect(weaknesses[0].metricKey).toBe("info_scannability"); // 최저 점수 먼저
  });
});
