export type ScoreBand = "none" | "low" | "mid" | "good" | "high";

export function scoreBand(score: number | null): ScoreBand {
  if (score == null) return "none";
  if (score < 60) return "low"; // ~59점대: 빨강
  if (score < 70) return "mid"; // 60점대: 노랑
  if (score < 80) return "good"; // 70점대: 라임
  return "high"; // 80점대 이상: 초록
}

export function scoreColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "low": return "var(--score-low)";
    case "mid": return "var(--score-mid)";
    case "good": return "var(--score-good)";
    case "high": return "var(--score-high)";
    default: return "var(--muted)";
  }
}
