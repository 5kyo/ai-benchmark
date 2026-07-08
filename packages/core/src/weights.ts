import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Weights } from "./types.js";

export function loadWeights(path: string): Weights {
  const raw = parse(readFileSync(path, "utf8")) as Weights;
  if (!raw?.axes || !raw?.metrics) {
    throw new Error(`Invalid weights file: ${path}`);
  }
  return raw;
}
