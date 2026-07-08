import { getProvider } from "../../lib/data/provider.js";
import { CompareView } from "../../components/CompareView.js";

export default async function ComparePage() {
  const companies = await getProvider().getCompanies();
  const self = companies.find((c) => c.isSelf);
  const others = companies.filter((c) => !c.isSelf);
  if (!self) return <p className="mono" style={{ color: "var(--muted)" }}>우리 회사(is_self)가 설정되지 않았습니다.</p>;
  return <CompareView self={self} others={others} />;
}
