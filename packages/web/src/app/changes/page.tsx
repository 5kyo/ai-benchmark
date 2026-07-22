import { resolve } from "node:path";
import { loadChangeHistory } from "../../lib/data/changes.js";
import { ChangesView } from "../../components/ChangesView.js";

export default function ChangesPage() {
  const files = loadChangeHistory(resolve(process.cwd(), "../../changes"));
  return <ChangesView files={files} />;
}
