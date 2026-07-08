import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { getProvider } from "../lib/data/provider.js";
import { listModels } from "../lib/data/build.js";
import { RankingView } from "../components/RankingView.js";

export default async function Home() {
  const companies = await getProvider().getCompanies();
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  const models = listModels(companies);
  return <RankingView companies={companies} weights={weights} models={models} />;
}
