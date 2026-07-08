import { describe, it, expect } from "vitest";
import { parseOutboxPath } from "./cli-import.js";

describe("parseOutboxPath", () => {
  it("extracts model and slug from '<model>/<slug>.json'", () => {
    expect(parseOutboxPath("claude-opus-4-8/acme.json")).toEqual({
      model: "claude-opus-4-8",
      slug: "acme",
    });
  });

  it("returns null for a non-json or malformed path", () => {
    expect(parseOutboxPath("acme.json")).toBeNull();
    expect(parseOutboxPath("claude/acme.txt")).toBeNull();
  });
});
