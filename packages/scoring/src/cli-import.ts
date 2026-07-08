import "dotenv/config";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { importModelScores } from "@ai-benchmark/db";
import { loadAxisCMetrics } from "./rubric.js";
import { parseAndValidate, toAxisCScores } from "./schema.js";

/** "<model>/<slug>.json" → { model, slug }. 형식 불일치면 null. */
export function parseOutboxPath(relPath: string): { model: string; slug: string } | null {
  const parts = relPath.split("/");
  if (parts.length !== 2) return null;
  const [model, file] = parts;
  if (!model || !file.endsWith(".json")) return null;
  const slug = file.slice(0, -".json".length);
  if (!slug) return null;
  return { model, slug };
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const outboxDir = resolve(root, "scoring/outbox");
  const expectedKeys = loadAxisCMetrics(resolve(root, "config/weights.yaml")).map((m) => m.key);

  if (!existsSync(outboxDir)) {
    console.log("no scoring/outbox — run `pnpm prepare-scores`, score files, then retry.");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key) : null;

  let imported = 0;
  let validated = 0;
  for (const model of readdirSync(outboxDir)) {
    const modelDir = resolve(outboxDir, model);
    for (const file of readdirSync(modelDir)) {
      const rel = `${model}/${file}`;
      const parsed = parseOutboxPath(rel);
      if (!parsed) continue;
      const raw = readFileSync(resolve(modelDir, file), "utf8");
      const output = parseAndValidate(raw, expectedKeys); // 실패 시 throw로 중단
      validated += 1;
      const scores = toAxisCScores(output);
      if (client) {
        const { scanId, count } = await importModelScores(client, parsed.slug, scores);
        imported += 1;
        console.log(`[${parsed.slug}/${output.model}] upserted ${count} scores to scan ${scanId}`);
      } else {
        console.log(`[${parsed.slug}/${output.model}] validated ${scores.length} scores (DB skipped: no env)`);
      }
    }
  }
  console.log(`\n${validated} file(s) validated, ${imported} imported.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
