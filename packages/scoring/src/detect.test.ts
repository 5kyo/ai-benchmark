import { describe, expect, it } from "vitest";
import type { Axis, Weights } from "@ai-benchmark/core";
import type { Fingerprint } from "./fingerprint.js";
import {
  detectChanges, diffContent, diffMetrics, diffScores, wordChangedPct, type CompanyLike,
} from "./detect.js";

const W: Weights = {
  axes: { A: 0.25, B: 0.25, C: 0.25, D: 0.25 },
  metrics: { A: { m1: 1 }, B: { m2: 1 }, C: { m3: 1 }, D: { m4: 1 } },
};
const AXIS_OF: Record<string, Axis> = { m1: "A", m2: "B", m3: "C", m4: "D" };

function co(slug: string, scores: Partial<Record<"m1" | "m2" | "m3" | "m4", number>>): CompanyLike {
  return {
    slug,
    name: slug.toUpperCase(),
    scores: Object.entries(scores).map(([k, v]) => ({
      axis: AXIS_OF[k], metricKey: k, model: "rule-based", score: v as number,
      evidence: `${k}=${v}`,
    })),
  };
}

function fp(over: Partial<Fingerprint>): Fingerprint {
  return {
    slug: "a", date: "d", url: "u", title: "T", metaDescription: "M",
    headings: [{ level: 1, text: "H" }],
    text: "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열", textHash: "hash-1",
    ...over,
  };
}

describe("diffScores", () => {
  it("종합·축 |Δ| < 3 이면 null", () => {
    expect(diffScores(co("a", { m1: 60, m2: 60, m3: 60, m4: 60 }),
      co("a", { m1: 62, m2: 62, m3: 62, m4: 62 }), W)).toBeNull();
  });
  it("임계값 이상이면 종합·축 delta 포함", () => {
    const d = diffScores(co("a", { m1: 60, m2: 60, m3: 60, m4: 60 }),
      co("a", { m1: 64, m2: 64, m3: 64, m4: 64 }), W);
    expect(d?.overall).toEqual({ from: 60, to: 64 });
    expect(d?.axes).toHaveLength(4);
  });
  it("축만 임계값을 넘고 종합은 못 넘으면 축만", () => {
    const d = diffScores(co("a", { m1: 60, m2: 60, m3: 60, m4: 60 }),
      co("a", { m1: 60, m2: 66, m3: 60, m4: 60 }), W); // 종합 60→61.5(반올림 62, Δ2)
    expect(d?.overall).toBeUndefined();
    expect(d?.axes).toEqual([{ axis: "B", from: 60, to: 66 }]);
  });
});

describe("diffMetrics", () => {
  it("반올림 정수 기준으로 임계값을 판정한다: 60.2→62.9 (반올림 60→63, Δ3)는 포함", () => {
    const d = diffMetrics(co("a", { m1: 60.2 }), co("a", { m1: 62.9 }));
    expect(d).toEqual([{ axis: "A", metricKey: "m1", from: 60, to: 63, evidence: "m1=62.9" }]);
  });
});

describe("wordChangedPct / diffContent", () => {
  it("해시 동일하면 변경률 0, title·헤딩도 같으면 null", () => {
    expect(diffContent(fp({}), fp({}))).toBeNull();
  });
  it("단어 변경률을 대칭차/합집합 %로 계산한다", () => {
    // from 10단어, to에서 1단어 교체 → 합집합 11, 대칭차 2 → 18.2%
    expect(wordChangedPct(
      "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열",
      "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 십",
    )).toBeCloseTo(18.2, 1);
  });
  it("헤딩 추가/삭제·title 변경을 감지한다", () => {
    const d = diffContent(
      fp({}),
      fp({ title: "T2", headings: [{ level: 1, text: "H2" }], textHash: "hash-1" }),
    );
    expect(d?.titleChanged).toBe(true);
    expect(d?.titleFrom).toBe("T");
    expect(d?.titleTo).toBe("T2");
    expect(d?.headingsAdded).toEqual(["H2"]);
    expect(d?.headingsRemoved).toEqual(["H"]);
    expect(d?.textChangedPct).toBe(0); // 해시 동일
  });
  it("변경률 1% 미만은 0으로 눌러 무시한다", () => {
    // 200 단어 중 1개 교체 → 대칭차 2/합집합 201 ≈ 0.995% < 1%
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`);
    const toWords = [...words.slice(0, 199), "changed"];
    const d = diffContent(
      fp({ text: words.join(" "), textHash: "h1" }),
      fp({ text: toWords.join(" "), textHash: "h2" }),
    );
    expect(d).toBeNull();
  });
});

describe("detectChanges", () => {
  const base = { fromDate: "2026-07-09", toDate: "2026-07-22", generatedAt: "2026-07-22T00:00:00.000Z" };

  it("변화 없으면 entries 빈 배열", () => {
    const c = co("a", { m1: 60, m2: 60, m3: 60, m4: 60 });
    const out = detectChanges({ ...base, from: [c], to: [c], fromFps: {}, toFps: {}, weights: W });
    expect(out).toEqual({ date: "2026-07-22", fromDate: "2026-07-09", generatedAt: base.generatedAt, entries: [] });
  });

  it("점수·순위 변화와 kinds를 기록한다", () => {
    const from = [co("a", { m1: 80, m2: 80, m3: 80, m4: 80 }), co("b", { m1: 70, m2: 70, m3: 70, m4: 70 })];
    const to = [co("a", { m1: 80, m2: 80, m3: 80, m4: 80 }), co("b", { m1: 85, m2: 85, m3: 85, m4: 85 })];
    const out = detectChanges({ ...base, from, to, fromFps: {}, toFps: {}, weights: W });
    const b = out.entries.find((e) => e.slug === "b");
    expect(b?.kinds).toEqual(["score", "rank"]);
    expect(b?.overall).toEqual({ from: 70, to: 85 });
    expect(b?.rank).toEqual({ from: 2, to: 1 });
    expect(b?.metrics?.map((m) => m.metricKey).sort()).toEqual(["m1", "m2", "m3", "m4"]);
    const a = out.entries.find((e) => e.slug === "a");
    expect(a?.kinds).toEqual(["rank"]); // 점수 그대로, 순위만 1→2
    expect(a?.rank).toEqual({ from: 1, to: 2 });
  });

  it("신규 편입·로스터 제외를 표기한다", () => {
    const out = detectChanges({
      ...base,
      from: [co("old", { m1: 50 })],
      to: [co("new", { m1: 50 })],
      fromFps: {}, toFps: {}, weights: W,
    });
    expect(out.entries.find((e) => e.slug === "new")?.kinds).toEqual(["new"]);
    expect(out.entries.find((e) => e.slug === "old")?.kinds).toEqual(["removed"]);
  });

  it("지문이 양쪽에 있어야 콘텐츠 diff를 수행한다", () => {
    const c = co("a", { m1: 60, m2: 60, m3: 60, m4: 60 });
    const out = detectChanges({
      ...base, from: [c], to: [c],
      fromFps: { a: fp({}) },
      toFps: { a: fp({ title: "T2", textHash: "hash-1" }) },
      weights: W,
    });
    expect(out.entries[0]?.kinds).toEqual(["content"]);
    expect(out.entries[0]?.content?.titleChanged).toBe(true);
    // 한쪽만 있으면 콘텐츠 diff 생략 → 변화 없음
    const out2 = detectChanges({
      ...base, from: [c], to: [c], fromFps: {}, toFps: { a: fp({}) }, weights: W,
    });
    expect(out2.entries).toEqual([]);
  });
});
