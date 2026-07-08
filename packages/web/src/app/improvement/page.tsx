import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { getProvider } from "../../lib/data/provider.js";
import { buildImprovementPlan } from "../../lib/improvement.js";
import { ImprovementView } from "../../components/ImprovementView.js";

export default async function ImprovementPage() {
  const companies = await getProvider().getCompanies();
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  const plan = buildImprovementPlan(companies, weights);
  return <ImprovementView plan={plan} />;
}
