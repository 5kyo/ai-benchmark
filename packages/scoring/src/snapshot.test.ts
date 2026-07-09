import { describe, it, expect } from "vitest";
import { buildSnapshotFile, snapshotFilename, localDateString } from "./snapshot.js";

describe("buildSnapshotFile", () => {
  it("메타와 companies를 스냅샷 객체로 합친다", () => {
    const companies = [{ slug: "parameta", isSelf: true }];
    const out = buildSnapshotFile(companies, {
      date: "2026-07-09",
      generatedAt: "2026-07-09T03:00:00.000Z",
      rubricVersion: "rubric_v1",
    });
    expect(out).toEqual({
      date: "2026-07-09",
      generatedAt: "2026-07-09T03:00:00.000Z",
      rubricVersion: "rubric_v1",
      companies,
    });
    // companies 참조를 그대로 전달(복사 아님)
    expect(out.companies).toBe(companies);
  });
});

describe("snapshotFilename", () => {
  it("날짜에 .json 확장자를 붙인다", () => {
    expect(snapshotFilename("2026-07-09")).toBe("2026-07-09.json");
  });
});

describe("localDateString", () => {
  it("로컬 연-월-일을 0패딩된 YYYY-MM-DD로 만든다", () => {
    // 로컬 타임존 기준 생성자(연, 월index, 일)
    expect(localDateString(new Date(2026, 6, 9))).toBe("2026-07-09");
    expect(localDateString(new Date(2026, 11, 1))).toBe("2026-12-01");
  });
});
