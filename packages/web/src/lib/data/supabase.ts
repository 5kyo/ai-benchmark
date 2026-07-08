import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MetricScore, Axis } from "@ai-benchmark/core";
import type { DashboardProvider } from "./provider.js";
import type { CompanyRecord } from "./types.js";

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  homepage_url: string;
  is_self: boolean;
  category: string | null;
}

export class SupabaseProvider implements DashboardProvider {
  private client: SupabaseClient;
  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async getCompanies(): Promise<CompanyRecord[]> {
    const { data: companies, error } = await this.client
      .from("companies")
      .select("id, slug, name, homepage_url, is_self, category");
    if (error) throw new Error(`companies query failed: ${error.message}`);

    const out: CompanyRecord[] = [];
    for (const c of (companies ?? []) as CompanyRow[]) {
      const { data: scan } = await this.client
        .from("scans")
        .select("id")
        .eq("company_id", c.id)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let scores: MetricScore[] = [];
      if (scan?.id) {
        const { data: rows } = await this.client
          .from("metric_scores")
          .select("axis, metric_key, model, score, evidence")
          .eq("scan_id", scan.id);
        scores = (rows ?? []).map((r) => ({
          axis: r.axis as Axis,
          metricKey: r.metric_key as string,
          model: r.model as string,
          score: Number(r.score),
          evidence: (r.evidence as string | null) ?? undefined,
        }));
      }
      out.push({
        slug: c.slug,
        name: c.name,
        homepageUrl: c.homepage_url,
        isSelf: Boolean(c.is_self),
        category: c.category ?? undefined,
        scores,
      });
    }
    return out;
  }
}
