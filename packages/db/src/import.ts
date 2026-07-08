import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricScore } from "@ai-benchmark/core";
import { toMetricScoreRows, toImprovementRows, type ImprovementLike } from "./rows.js";

export interface CompanyLike {
  name: string;
  slug: string;
  homepageUrl: string;
  isSelf: boolean;
  category?: string;
}

/** 기업 upsert → scan 생성 → metric_scores/improvements 일괄 삽입. */
export async function importScan(
  client: SupabaseClient,
  company: CompanyLike,
  opts: {
    scannedAt: string;
    rubricVersion: string;
    rawSnapshotPath?: string;
    scores: MetricScore[];
    improvements: ImprovementLike[];
  },
): Promise<{ scanId: string }> {
  const { data: comp, error: cErr } = await client
    .from("companies")
    .upsert(
      {
        name: company.name,
        slug: company.slug,
        homepage_url: company.homepageUrl,
        is_self: company.isSelf,
        category: company.category ?? null,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (cErr || !comp) throw new Error(`company upsert failed: ${cErr?.message}`);

  const { data: scan, error: sErr } = await client
    .from("scans")
    .insert({
      company_id: comp.id,
      scanned_at: opts.scannedAt,
      rubric_version: opts.rubricVersion,
      raw_snapshot_path: opts.rawSnapshotPath ?? null,
      status: "completed",
    })
    .select("id")
    .single();
  if (sErr || !scan) throw new Error(`scan insert failed: ${sErr?.message}`);

  const scoreRows = toMetricScoreRows(scan.id, opts.scores);
  if (scoreRows.length) {
    const { error } = await client.from("metric_scores").insert(scoreRows);
    if (error) throw new Error(`metric_scores insert failed: ${error.message}`);
  }
  const impRows = toImprovementRows(scan.id, opts.improvements);
  if (impRows.length) {
    const { error } = await client.from("improvements").insert(impRows);
    if (error) throw new Error(`improvements insert failed: ${error.message}`);
  }
  return { scanId: scan.id };
}
