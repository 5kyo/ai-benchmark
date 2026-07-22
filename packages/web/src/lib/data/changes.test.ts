import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadChangeHistory } from "./changes.js";

describe("loadChangeHistory", () => {
  it("없는 디렉터리는 빈 배열", () => {
    expect(loadChangeHistory(resolve(tmpdir(), "definitely-missing-changes"))).toEqual([]);
  });

  it("날짜 내림차순 정렬 + 깨진/필드누락 파일 skip", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "changes-"));
    writeFileSync(resolve(dir, "2026-07-09.json"), JSON.stringify({
      date: "2026-07-09", fromDate: "2026-07-08", generatedAt: "g", entries: [],
    }));
    writeFileSync(resolve(dir, "2026-07-22.json"), JSON.stringify({
      date: "2026-07-22", fromDate: "2026-07-09", generatedAt: "g",
      entries: [{ slug: "a", name: "A", kinds: ["score"], overall: { from: 70, to: 75 }, summary: "요약" }],
    }));
    writeFileSync(resolve(dir, "broken.json"), "{ not json");
    writeFileSync(resolve(dir, "no-entries.json"), JSON.stringify({ date: "d", fromDate: "f" }));

    const files = loadChangeHistory(dir);
    expect(files.map((f) => f.date)).toEqual(["2026-07-22", "2026-07-09"]);
    expect(files[0].entries[0].name).toBe("A");
    expect(files[0].entries[0].overall).toEqual({ from: 70, to: 75 });
  });
});
