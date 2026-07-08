import { resolve } from "node:path";
import { notFound } from "next/navigation";
import { loadWeights } from "@ai-benchmark/core";
import { getProvider } from "../../../lib/data/provider.js";
import { listModels } from "../../../lib/data/build.js";
import { CompanyDetailView } from "../../../components/CompanyDetailView.js";

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const companies = await getProvider().getCompanies();
  const company = companies.find((c) => c.slug === params.slug);
  if (!company) notFound();
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  return <CompanyDetailView company={company} weights={weights} models={listModels(companies)} />;
}
