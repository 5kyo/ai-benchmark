import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { importScan } from "@ai-benchmark/db";
import { loadCompanies } from "./companies.js";
import { collectSnapshot } from "./snapshot.js";
import { HttpFetcher } from "./fetcher.js";
import { scoreRules, deriveImprovements } from "./rule-score.js";

const RUBRIC_VERSION = "rubric_v1";

/** 콜론을 하이픈으로 치환해 파일시스템 안전 경로 생성. */
export function snapshotPath(rawDir: string, slug: string, scannedAt: string): string {
  const safe = scannedAt.replace(/[:.]/g, "-");
  return `${rawDir}/${slug}/${safe}.json`;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const companies = loadCompanies(resolve(root, "config/companies.yaml"));
  const rawDir = resolve(root, "raw");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key) : null;

  const fetcher = new HttpFetcher();
  const now = () => new Date().toISOString();

  for (const company of companies) {
    const snap = await collectSnapshot(company, fetcher, now);
    const scores = scoreRules(snap);
    const improvements = deriveImprovements(scores);

    const relPath = snapshotPath("raw", company.slug, snap.scannedAt);
    const absPath = resolve(root, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, JSON.stringify(snap, null, 2));

    if (client) {
      const { scanId } = await importScan(client, company, {
        scannedAt: snap.scannedAt,
        rubricVersion: RUBRIC_VERSION,
        rawSnapshotPath: relPath,
        scores,
        improvements,
      });
      console.log(`[${company.slug}] imported scan ${scanId} (${scores.length} scores)`);
    } else {
      console.log(`[${company.slug}] scored ${scores.length} metrics (DB skipped: no env)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
