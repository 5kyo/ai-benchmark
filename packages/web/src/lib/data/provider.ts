import type { CompanyRecord } from "./types.js";
import { FixtureProvider } from "./fixtures-provider.js";
import { SupabaseProvider } from "./supabase.js";

export interface DashboardProvider {
  getCompanies(): Promise<CompanyRecord[]>;
}

export function getProvider(): DashboardProvider {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? new SupabaseProvider(url, key) : new FixtureProvider();
}
