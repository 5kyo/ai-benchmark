import { describe, it, expect } from "vitest";
import { snapshotPath } from "./cli-crawl.js";

describe("snapshotPath", () => {
  it("builds a filesystem-safe path per slug and timestamp", () => {
    const p = snapshotPath("raw", "our-company", "2026-07-08T00:00:00.000Z");
    expect(p).toBe("raw/our-company/2026-07-08T00-00-00-000Z.json");
  });
});
