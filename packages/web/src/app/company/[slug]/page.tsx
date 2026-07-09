import { resolve } from "node:path";
import { notFound } from "next/navigation";
import { loadWeights } from "@ai-benchmark/core";
import { getProvider } from "../../../lib/data/provider.js";
import { listModels } from "../../../lib/data/build.js";
import { CompanyDetailView } from "../../../components/CompanyDetailView.js";

// 정적 export: 빌드 시 모든 회사 slug를 미리 생성한다.
export async function generateStaticParams() {
  const companies = await getProvider().getCompanies();
  return companies.map((c) => ({ slug: c.slug }));
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const companies = await getProvider().getCompanies();
  const company = companies.find((c) => c.slug === params.slug);
  if (!company) notFound();
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  return <CompanyDetailView company={company} weights={weights} models={listModels(companies)} />;
}
