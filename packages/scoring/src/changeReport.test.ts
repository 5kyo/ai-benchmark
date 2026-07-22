import { describe, expect, it } from "vitest";
import type { ChangeEntry, ChangesFile } from "./detect.js";
import { buildChangeInboxDoc, buildChangeReport, formatEntryLines } from "./changeReport.js";

const entry: ChangeEntry = {
  slug: "alchemy",
  name: "Alchemy",
  kinds: ["content", "score", "rank"],
  overall: { from: 78, to: 83 },
  axes: [{ axis: "B", from: 54, to: 66 }],
  rank: { from: 3, to: 2 },
  metrics: [{ axis: "A", metricKey: "llms_txt_present", from: 0, to: 100, evidence: "llms.txt 제공" }],
  content: {
    titleChanged: false, metaChanged: true,
    headingsAdded: ["AI Agent Platform"], headingsRemoved: [],
    textChangedPct: 12.4,
  },
  summary: null,
};

describe("formatEntryLines", () => {
  it("종합·축·순위·지표·콘텐츠 변화를 라인으로 만든다", () => {
    const lines = formatEntryLines(entry).join("\n");
    expect(lines).toContain("종합 78 → 83 (+5)");
    expect(lines).toContain("축 B 54 → 66 (+12)");
    expect(lines).toContain("순위 3위 → 2위");
    expect(lines).toContain("llms_txt_present 0 → 100");
    expect(lines).toContain("헤딩 추가: AI Agent Platform");
    expect(lines).toContain("12.4% 변경");
  });
});

describe("buildChangeInboxDoc", () => {
  it("지시·기계 diff·발췌·출력 계약이 담긴 자기완결 문서를 만든다", () => {
    const doc = buildChangeInboxDoc({
      entry, url: "https://www.alchemy.com/",
      fromDate: "2026-07-09", toDate: "2026-07-22",
      fromText: "이전 본문", toText: "현재 본문",
    });
    expect(doc).toContain("Alchemy");
    expect(doc).toContain("2026-07-09 → 2026-07-22");
    expect(doc).toContain("이전 본문");
    expect(doc).toContain("현재 본문");
    expect(doc).toContain("scoring/changes-outbox/alchemy.json");
    expect(doc).toContain('"slug": "alchemy"');
  });

  it("긴 본문은 발췌 상한으로 자른다", () => {
    const long = "가".repeat(10000);
    const doc = buildChangeInboxDoc({
      entry, url: "u", fromDate: "f", toDate: "t", fromText: long, toText: long,
    });
    expect(doc.length).toBeLessThan(20000);
  });
});

describe("buildChangeReport", () => {
  it("회사 섹션·요약·delta 라인을 담은 마크다운을 만든다", () => {
    const changes: ChangesFile = {
      date: "2026-07-22", fromDate: "2026-07-09", generatedAt: "iso",
      entries: [{ ...entry, summary: "AI 에이전트 제품 페이지를 새로 열었다." }],
    };
    const md = buildChangeReport(changes);
    expect(md).toContain("# 경쟁사 변화 리포트 2026-07-22");
    expect(md).toContain("2026-07-09 → 2026-07-22");
    expect(md).toContain("## Alchemy");
    expect(md).toContain("> AI 에이전트 제품 페이지를 새로 열었다.");
    expect(md).toContain("종합 78 → 83 (+5)");
  });

  it("변화 없으면 그 사실을 명시한다", () => {
    const md = buildChangeReport({ date: "d", fromDate: "f", generatedAt: "g", entries: [] });
    expect(md).toContain("변화가 감지되지 않았습니다");
  });
});
