import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { loadSnapshotHistory, buildSelfTrend } from "../../lib/data/history.js";
import { SelfTrendView } from "../../components/SelfTrendView.js";

export default function TrendPage() {
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  const history = loadSnapshotHistory(resolve(process.cwd(), "../../snapshots"));
  const trend = buildSelfTrend(history, weights, "average");
  return <SelfTrendView trend={trend} />;
}
