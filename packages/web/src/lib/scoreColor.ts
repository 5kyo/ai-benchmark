export type ScoreBand = "none" | "low" | "mid" | "high";

export function scoreBand(score: number | null): ScoreBand {
  if (score == null) return "none";
  if (score < 40) return "low";
  if (score < 70) return "mid";
  return "high";
}

export function scoreColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "low": return "var(--score-low)";
    case "mid": return "var(--score-mid)";
    case "high": return "var(--score-high)";
    default: return "var(--muted)";
  }
}
