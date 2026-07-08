import { getProvider } from "../../lib/data/provider.js";
import { listModels } from "../../lib/data/build.js";
import { ModelCompareView } from "../../components/ModelCompareView.js";

export default async function ModelsPage() {
  const companies = await getProvider().getCompanies();
  return <ModelCompareView companies={companies} models={listModels(companies)} />;
}
