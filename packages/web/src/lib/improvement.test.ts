import { describe, it, expect } from "vitest";
import type { MetricScore, Weights } from "@ai-benchmark/core";
import type { CompanyRecord } from "./data/types.js";
import { buildImprovementPlan } from "./improvement.js";

// 최소 가중치: A축만 두 지표. axesWeight A=1, 축내 지표 rule 1.0 / llm 1.0 (합 2.0).
const W: Weights = {
  axes: { A: 1, B: 0, C: 0, D: 0 },
  metrics: {
    A: { robots_allowed: 1.0, content_extractability: 1.0 },
    B: {},
    C: {},
    D: {},
  },
} as unknown as Weights;

function ms(metricKey: string, axis: "A" | "B" | "C" | "D", score: number, model = "rule-based", evidence?: string): MetricScore {
  return { axis, metricKey, model, score, evidence } as unknown as MetricScore;
}

function company(slug: string, name: string, isSelf: boolean, scores: MetricScore[]): CompanyRecord {
  return { slug, name, isSelf, homepageUrl: "", scores };
}

describe("buildImprovementPlan — 격차·영향도", () => {
  const leader1 = company("l1", "Leader1", false, [
    ms("robots_allowed", "A", 100),
    ms("content_extractability", "A", 90, "m1", "리더는 텍스트가 깔끔하다. 반복이 없다."),
  ]);
  const leader2 = company("l2", "Leader2", false, [
    ms("robots_allowed", "A", 80),
    ms("content_extractability", "A", 70, "m1"),
  ]);
  const self = company("parameta", "파라메타", true, [
    ms("robots_allowed", "A", 100), // 격차 0 → 제외
    ms("content_extractability", "A", 50, "m1", "슬로건이 반복된다. 후처리 필요."),
  ]);

  it("자사가 뒤처진 지표만, 영향도 순으로 낸다", () => {
    const plan = buildImprovementPlan([self, leader1, leader2], W);
    // robots_allowed는 격차 0이라 제외, content_extractability만 남는다
    expect(plan.items).toHaveLength(1);
    const it = plan.items[0];
    expect(it.metricKey).toBe("content_extractability");
    expect(it.selfScore).toBe(50);
    // target = max(1위 90, 2위 70) = 90
    expect(it.target).toBe(90);
    expect(it.gap).toBe(40);
  });

  it("영향도 = 격차 × 실효가중치(축가중 × 축내 정규화 지표가중)", () => {
    const plan = buildImprovementPlan([self, leader1, leader2], W);
    // effWeight = 1(A) × (1.0 / (1.0+1.0)) = 0.5 → gain = 40 × 0.5 = 20
    expect(plan.items[0].projectedGain).toBeCloseTo(20, 5);
  });

  it("자사 근거(현상)와 target 달성 리더 근거·이름(참고)을 붙인다", () => {
    const plan = buildImprovementPlan([self, leader1, leader2], W);
    const it = plan.items[0];
    expect(it.selfEvidence).toBe("슬로건이 반복된다.");
    expect(it.leaderName).toBe("Leader1");
    expect(it.leaderEvidence).toBe("리더는 텍스트가 깔끔하다.");
    expect(it.suggestion).toContain("텍스트");
  });

  it("자사 순위·1·2위 목표·격차를 요약한다", () => {
    const plan = buildImprovementPlan([self, leader1, leader2], W);
    expect(plan.self.name).toBe("파라메타");
    expect(plan.self.total).toBe(3);
    expect(plan.leaders.map((l) => l.name)).toEqual(["Leader1", "Leader2"]);
    expect(plan.gapToTop).toBeCloseTo((plan.leaders[0].overall ?? 0) - (plan.self.overall ?? 0), 5);
  });
});

describe("buildImprovementPlan — 티어·예상 종합", () => {
  it("projectedGain으로 high(≥1.0)/mid(0.3~1.0)/low(<0.3) 티어를 매긴다", () => {
    // A축 가중치 1, 지표 3개 각 1.0 → 각 effWeight = 1/3 ≈ 0.333
    const w: Weights = {
      axes: { A: 1, B: 0, C: 0, D: 0 },
      metrics: { A: { m_high: 1, m_mid: 1, m_low: 1 }, B: {}, C: {}, D: {} },
    } as unknown as Weights;
    const leader = company("l", "L", false, [ms("m_high", "A", 100), ms("m_mid", "A", 100), ms("m_low", "A", 100)]);
    const me = company("p", "P", true, [
      ms("m_high", "A", 40), // gap60 × .333 = 20 → high
      ms("m_mid", "A", 98), // gap2  × .333 = .67 → mid
      ms("m_low", "A", 99.5), // gap.5 × .333 = .167 → low
    ]);
    const plan = buildImprovementPlan([me, leader], w);
    const byKey = Object.fromEntries(plan.items.map((i) => [i.metricKey, i.tier]));
    expect(byKey["m_high"]).toBe("high");
    expect(byKey["m_mid"]).toBe("mid");
    expect(byKey["m_low"]).toBe("low");
  });

  it("projectedOverallIfHigh = 자사 종합 + high 항목 gain 합", () => {
    const plan = buildImprovementPlan(
      [
        company("p", "P", true, [ms("content_extractability", "A", 50, "m1")]),
        company("l", "L", false, [ms("content_extractability", "A", 90, "m1")]),
      ],
      W
    );
    const highSum = plan.items.filter((i) => i.tier === "high").reduce((s, i) => s + i.projectedGain, 0);
    expect(plan.projectedOverallIfHigh).toBeCloseTo((plan.self.overall ?? 0) + highSum, 5);
  });
});

describe("buildImprovementPlan — 엣지", () => {
  it("자사가 없으면 빈 items와 null self.overall", () => {
    const plan = buildImprovementPlan([company("a", "A", false, [ms("robots_allowed", "A", 50)])], W);
    expect(plan.items).toHaveLength(0);
    expect(plan.self.overall).toBeNull();
  });

  it("모든 지표가 리더 이상이면 items가 비고 projectedOverallIfHigh는 현 종합", () => {
    const plan = buildImprovementPlan(
      [
        company("p", "P", true, [ms("robots_allowed", "A", 100)]),
        company("l", "L", false, [ms("robots_allowed", "A", 80)]),
      ],
      W
    );
    expect(plan.items).toHaveLength(0);
    expect(plan.projectedOverallIfHigh).toBeCloseTo(plan.self.overall ?? 0, 5);
  });
});
