import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface CompanyConfig {
  name: string;
  slug: string;
  homepageUrl: string;
  isSelf: boolean;
  category?: string;
  description?: string;
}

interface RawCompany {
  name: string;
  slug: string;
  homepage_url: string;
  is_self?: boolean;
  category?: string;
  description?: string;
}

export function loadCompanies(path: string): CompanyConfig[] {
  const doc = parse(readFileSync(path, "utf8")) as { companies?: RawCompany[] };
  const rows = doc.companies ?? [];
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    homepageUrl: r.homepage_url,
    isSelf: r.is_self ?? false,
    category: r.category,
    description: r.description,
  }));
}
