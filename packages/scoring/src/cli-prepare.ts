import "dotenv/config";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCompanies } from "@ai-benchmark/crawler";
import type { RawSnapshot } from "@ai-benchmark/crawler";
import { loadLlmMetrics, loadRubricText } from "./rubric.js";
import { extractText } from "./text.js";
import { buildInboxDoc, pickLatestSnapshot } from "./prepare.js";

const RUBRIC_VERSION = "rubric_v1";

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const companies = loadCompanies(resolve(root, "config/companies.yaml"));
  const metrics = loadLlmMetrics(resolve(root, "config/weights.yaml"));
  const rubricText = loadRubricText(resolve(root, "config/rubric/rubric_v1.md"));
  const inboxDir = resolve(root, "scoring/inbox");
  mkdirSync(inboxDir, { recursive: true });

  let written = 0;
  for (const company of companies) {
    const rawCompanyDir = resolve(root, "raw", company.slug);
    if (!existsSync(rawCompanyDir)) {
      console.log(`[${company.slug}] no raw snapshot — run \`pnpm crawl\` first, skipped`);
      continue;
    }
    const latest = pickLatestSnapshot(readdirSync(rawCompanyDir));
    if (!latest) {
      console.log(`[${company.slug}] no .json snapshot, skipped`);
      continue;
    }
    const snap = JSON.parse(readFileSync(resolve(rawCompanyDir, latest), "utf8")) as RawSnapshot;
    const text = extractText(snap.homepage.body);
    const doc = buildInboxDoc({
      name: company.name,
      slug: company.slug,
      url: company.homepageUrl,
      text,
      rubricVersion: RUBRIC_VERSION,
      metrics,
      rubricText,
    });
    writeFileSync(resolve(inboxDir, `${company.slug}.md`), doc);
    written += 1;
    console.log(`[${company.slug}] inbox written`);
  }
  console.log(`\n${written} inbox file(s) in scoring/inbox/. Score each with Claude Code / Codex, save JSON to scoring/outbox/<model>/<slug>.json, then run \`pnpm import-scores\`.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
