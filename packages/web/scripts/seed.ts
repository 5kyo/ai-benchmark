import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { importScan, importModelScores } from "@ai-benchmark/db";
import { fixtureCompanies } from "../src/lib/data/fixtures.js";

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  const client = createClient(url, key);
  const now = new Date().toISOString();
  for (const c of fixtureCompanies()) {
    const rule = c.scores.filter((s) => s.model === "rule-based");
    const llm = c.scores.filter((s) => s.model !== "rule-based");
    await importScan(client, { name: c.name, slug: c.slug, homepageUrl: c.homepageUrl, isSelf: c.isSelf, category: c.category }, {
      scannedAt: now, rubricVersion: "rubric_v1", scores: rule, improvements: [],
    });
    const byModel = new Map<string, typeof llm>();
    for (const s of llm) { const a = byModel.get(s.model) ?? []; a.push(s); byModel.set(s.model, a); }
    for (const [, scores] of byModel) await importModelScores(client, c.slug, scores);
  }
  console.log("seeded fixtures");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
