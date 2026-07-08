import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCompanies } from "./companies.js";

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, "../../../config/companies.yaml");

describe("loadCompanies", () => {
  it("parses companies with camelCase fields", () => {
    const list = loadCompanies(path);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty("homepageUrl");
    expect(list[0]).toHaveProperty("isSelf");
  });

  it("marks exactly the self company", () => {
    const list = loadCompanies(path);
    expect(list.some((c) => c.isSelf)).toBe(true);
  });
});
