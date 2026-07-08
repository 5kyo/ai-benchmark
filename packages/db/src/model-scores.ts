import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricScore } from "@ai-benchmark/core";
import { toMetricScoreRows } from "./rows.js";

/** metric_scores upsert의 onConflict 대상 (0001_init.sql의 unique 키와 동기화). */
export function metricScoreConflictTarget(): string {
  return "scan_id,axis,metric_key,model";
}

/** slug로 기업을 찾아 가장 최근 scan id를 반환. 없으면 null. */
export async function getLatestScanId(client: SupabaseClient, slug: string): Promise<string | null> {
  const { data: comp, error: cErr } = await client
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (cErr) throw new Error(`company lookup failed: ${cErr.message}`);
  if (!comp) return null;

  const { data: scan, error: sErr } = await client
    .from("scans")
    .select("id")
    .eq("company_id", comp.id)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) throw new Error(`scan lookup failed: ${sErr.message}`);
  return scan?.id ?? null;
}

/** 최근 scan에 모델 점수(축 C 등)를 upsert. scan이 없으면 throw. */
export async function importModelScores(
  client: SupabaseClient,
  slug: string,
  scores: MetricScore[],
): Promise<{ scanId: string; count: number }> {
  const scanId = await getLatestScanId(client, slug);
  if (!scanId) throw new Error(`no scan for '${slug}' — run \`pnpm crawl\` first`);

  const rows = toMetricScoreRows(scanId, scores);
  if (rows.length) {
    const { error } = await client
      .from("metric_scores")
      .upsert(rows, { onConflict: metricScoreConflictTarget() });
    if (error) throw new Error(`model score upsert failed: ${error.message}`);
  }
  return { scanId, count: rows.length };
}
