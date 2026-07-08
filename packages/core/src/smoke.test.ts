import { describe, it, expect } from "vitest";
import { CORE_READY } from "./index.js";

describe("workspace smoke", () => {
  it("core package is importable", () => {
    expect(CORE_READY).toBe(true);
  });
});
