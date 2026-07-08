// 근거(evidence) 서술 선택 유틸. 진단 요약·개선 방향이 공유한다.
import type { MetricRow } from "./data/metricRows.js";

type ScoredRow = MetricRow & { score: number };

// 근거 서술의 첫 문장만 취한다(전문은 지표 표에 있음). 소수점(4.5)은 문장 끝으로 보지 않는다.
export function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?。](?=\s|$)/);
  return (m ? m[0] : text).trim();
}

// 근거 선택: 평균 뷰 perModel이면 점수에 가장 가까운 모델, 아니면 행 자체 evidence의 첫 문장.
export function pickRowEvidence(r: MetricRow): string | undefined {
  if (r.score == null) return r.evidence ? firstSentence(r.evidence) : undefined;
  const scored = r as ScoredRow;
  if (scored.perModel && scored.perModel.length > 0) {
    const withEv = scored.perModel.filter(
      (p): p is { model: string; score: number; evidence: string } => p.evidence != null && p.score != null
    );
    if (withEv.length > 0) {
      const best = withEv.reduce((a, b) =>
        Math.abs(b.score - scored.score) < Math.abs(a.score - scored.score) ? b : a
      );
      return firstSentence(best.evidence);
    }
  }
  return scored.evidence ? firstSentence(scored.evidence) : undefined;
}
