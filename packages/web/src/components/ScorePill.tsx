import { scoreColor } from "../lib/scoreColor.js";

export function ScorePill({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-4xl" : size === "sm" ? "text-sm" : "text-xl";
  return (
    <span className={`mono font-semibold ${cls}`} style={{ color: scoreColor(score) }}>
      {score == null ? "—" : Math.round(score)}
    </span>
  );
}
