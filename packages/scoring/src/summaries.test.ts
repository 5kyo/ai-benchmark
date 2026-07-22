import { describe, expect, it } from "vitest";
import type { ChangesFile } from "./detect.js";
import { mergeSummaries, parseSummaryFile } from "./summaries.js";

describe("parseSummaryFile", () => {
  it("정상 JSON을 파싱하고 summary를 trim한다", () => {
    expect(parseSummaryFile('{ "slug": "a", "summary": "  요약  " }'))
      .toEqual({ slug: "a", summary: "요약" });
  });
  it("slug/summary 누락·빈 값은 throw", () => {
    expect(() => parseSummaryFile('{ "summary": "x" }')).toThrow();
    expect(() => parseSummaryFile('{ "slug": "a", "summary": "  " }')).toThrow();
    expect(() => parseSummaryFile("not json")).toThrow();
  });
});

describe("mergeSummaries", () => {
  const changes: ChangesFile = {
    date: "d", fromDate: "f", generatedAt: "g",
    entries: [
      { slug: "a", name: "A", kinds: ["score"], summary: null },
      { slug: "b", name: "B", kinds: ["content"], summary: null },
    ],
  };
  it("slug가 일치하는 엔트리에만 summary를 채운다", () => {
    const { merged, unmatched } = mergeSummaries(changes, [
      { slug: "a", summary: "A 요약" },
      { slug: "ghost", summary: "없는 회사" },
    ]);
    expect(merged.entries.find((e) => e.slug === "a")?.summary).toBe("A 요약");
    expect(merged.entries.find((e) => e.slug === "b")?.summary).toBeNull();
    expect(unmatched).toEqual(["ghost"]);
  });
  it("원본 객체를 변형하지 않는다", () => {
    mergeSummaries(changes, [{ slug: "a", summary: "x" }]);
    expect(changes.entries[0].summary).toBeNull();
  });
});
