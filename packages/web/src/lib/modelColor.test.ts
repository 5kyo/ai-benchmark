import { describe, it, expect } from "vitest";
import { modelColor, modelShort } from "./modelColor.js";

describe("modelShort", () => {
  it("distinguishes models from the same vendor", () => {
    expect(modelShort("claude-opus-5")).toBe("Opus 5");
    expect(modelShort("claude-sonnet-5")).toBe("Sonnet 5");
    expect(modelShort("claude-haiku-4-5")).toBe("Haiku 4.5");
  });

  it("keeps GPT and Gemini readable", () => {
    expect(modelShort("gpt-5.5")).toBe("GPT-5.5");
    expect(modelShort("gemini-3-pro")).toBe("Gemini 3-pro");
  });

  it("falls back to the raw id for unknown vendors", () => {
    expect(modelShort("llama-4")).toBe("llama-4");
  });
});

describe("modelColor", () => {
  it("gives each Claude family its own color", () => {
    const opus = modelColor("claude-opus-5");
    const sonnet = modelColor("claude-sonnet-5");
    expect(opus).not.toBe(sonnet);
  });

  it("keeps vendors apart", () => {
    const claude = modelColor("claude-opus-5");
    expect(modelColor("gpt-5.5")).not.toBe(claude);
    expect(modelColor("gemini-3-pro")).not.toBe(claude);
  });

  it("returns a color for an unknown model without inventing a vendor color", () => {
    expect(modelColor("llama-4")).toBe("#9aa4b2");
  });
});
