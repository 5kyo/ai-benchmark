import { describe, it, expect } from "vitest";
import { buildInboxDoc, pickLatestSnapshot } from "./prepare.js";
import type { LlmMetric } from "./rubric.js";

const metrics: LlmMetric[] = [
  { axis: "A", key: "agent_findability", weight: 0.2 },
  { axis: "C", key: "clarity", weight: 0.3 },
  { axis: "C", key: "product_depth", weight: 0.25 },
  { axis: "D", key: "technical_depth", weight: 0.2 },
];

describe("buildInboxDoc", () => {
  const doc = buildInboxDoc({
    name: "Acme", slug: "acme", url: "https://acme.example",
    text: "Acme builds blockchains.", rubricVersion: "rubric_v1",
    metrics, rubricText: "루브릭 본문",
  });

  it("embeds company, url, and extracted text", () => {
    expect(doc).toContain("Acme");
    expect(doc).toContain("https://acme.example");
    expect(doc).toContain("Acme builds blockchains.");
  });

  it("lists every LLM metric key", () => {
    for (const m of metrics) expect(doc).toContain(m.key);
  });

  it("embeds the output JSON schema with the slug and a model placeholder", () => {
    expect(doc).toContain(`"slug": "acme"`);
    expect(doc).toContain(`"model"`);
    expect(doc).toContain(`outbox/<model>/acme.json`);
  });
});

describe("pickLatestSnapshot", () => {
  it("returns the lexicographically greatest json filename", () => {
    const files = [
      "2026-07-01T00-00-00-000Z.json",
      "2026-07-08T09-30-00-000Z.json",
      "2026-07-05T12-00-00-000Z.json",
      "notes.txt",
    ];
    expect(pickLatestSnapshot(files)).toBe("2026-07-08T09-30-00-000Z.json");
  });

  it("returns null when there are no json files", () => {
    expect(pickLatestSnapshot(["a.txt", "b.md"])).toBeNull();
  });
});
