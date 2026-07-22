import type { Axis, MetricScore, Weights } from "@ai-benchmark/core";
import { overallForView, axisForView, RULE_MODEL } from "@ai-benchmark/core";
import type { Fingerprint } from "./fingerprint.js";

export type ChangeKind = "content" | "score" | "rank" | "new" | "removed";

export interface ScoreDelta { from: number; to: number }
export interface AxisDelta extends ScoreDelta { axis: Axis }
export interface MetricChange { axis: Axis; metricKey: string; from: number; to: number; evidence?: string }
export interface ContentChange {
  titleChanged: boolean;
  titleFrom?: string;
  titleTo?: string;
  metaChanged: boolean;
  headingsAdded: string[];
  headingsRemoved: string[];
  textChangedPct: number;
}
export interface ChangeEntry {
  slug: string;
  name: string;
  kinds: ChangeKind[];
  overall?: ScoreDelta;
  axes?: AxisDelta[];
  rank?: ScoreDelta;
  metrics?: MetricChange[];
  content?: ContentChange;
  summary: string | null;
}
/** 변화 기록물 — 당시 계산된 delta를 그대로 저장한다(weights 변경 시에도 소급 변경 없음). */
export interface ChangesFile {
  date: string;
  fromDate: string;
  generatedAt: string;
  entries: ChangeEntry[];
}

export interface CompanyLike { slug: string; name: string; scores: MetricScore[] }

/** 노이즈 임계값 — 이 미만의 변화는 "변화"로 치지 않는다. */
export const THRESHOLDS = {
  scoreDelta: 3,
  textChangedPct: 1,
};

const AXES: Axis[] = ["A", "B", "C", "D"];

function round(v: number | null): number | null {
  return v === null ? null : Math.round(v);
}

/** 종합·축 점수 변화(임계값 이상만). 변화 없으면 null. */
export function diffScores(
  from: CompanyLike, to: CompanyLike, w: Weights,
): { overall?: ScoreDelta; axes: AxisDelta[] } | null {
  const of = round(overallForView(from.scores, w, "average"));
  const ot = round(overallForView(to.scores, w, "average"));
  const overall =
    of !== null && ot !== null && Math.abs(ot - of) >= THRESHOLDS.scoreDelta
      ? { from: of, to: ot }
      : undefined;
  const axes: AxisDelta[] = [];
  for (const axis of AXES) {
    const af = round(axisForView(from.scores, axis, w, "average"));
    const at = round(axisForView(to.scores, axis, w, "average"));
    if (af !== null && at !== null && Math.abs(at - af) >= THRESHOLDS.scoreDelta) {
      axes.push({ axis, from: af, to: at });
    }
  }
  if (!overall && axes.length === 0) return null;
  return { overall, axes };
}

/** 종합점 내림차순 1-based 순위(종합 null인 회사는 순위 없음). */
export function computeRanks(companies: CompanyLike[], w: Weights): Map<string, number> {
  const scored = companies
    .map((c) => ({ slug: c.slug, overall: overallForView(c.scores, w, "average") }))
    .filter((c): c is { slug: string; overall: number } => c.overall !== null)
    .sort((a, b) => b.overall - a.overall);
  return new Map(scored.map((c, i) => [c.slug, i + 1]));
}

/** 규칙 지표 점수 변화(임계값 이상만). to쪽 evidence 병기. */
export function diffMetrics(from: CompanyLike, to: CompanyLike): MetricChange[] {
  const key = (s: MetricScore) => `${s.axis}::${s.metricKey}`;
  const fromRule = new Map(
    from.scores.filter((s) => s.model === RULE_MODEL).map((s) => [key(s), s]),
  );
  const out: MetricChange[] = [];
  for (const s of to.scores) {
    if (s.model !== RULE_MODEL) continue;
    const prev = fromRule.get(key(s));
    if (!prev) continue;
    if (Math.abs(s.score - prev.score) >= THRESHOLDS.scoreDelta) {
      out.push({
        axis: s.axis, metricKey: s.metricKey,
        from: Math.round(prev.score), to: Math.round(s.score), evidence: s.evidence,
      });
    }
  }
  return out;
}

/** 본문 단어(공백 분리) 집합의 대칭차/합집합 비율(%) — 소수 1자리. */
export function wordChangedPct(fromText: string, toText: string): number {
  const a = new Set(fromText.split(/\s+/).filter(Boolean));
  const b = new Set(toText.split(/\s+/).filter(Boolean));
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  const symDiff = union - inter;
  return Math.round((symDiff / union) * 1000) / 10;
}

/** 지문 비교. 의미 있는 변화 없으면 null. */
export function diffContent(from: Fingerprint, to: Fingerprint): ContentChange | null {
  const titleChanged = from.title !== to.title;
  const metaChanged = from.metaDescription !== to.metaDescription;
  const fromH = new Set(from.headings.map((h) => h.text));
  const toH = new Set(to.headings.map((h) => h.text));
  const headingsAdded = [...toH].filter((t) => !fromH.has(t));
  const headingsRemoved = [...fromH].filter((t) => !toH.has(t));
  // 임계값 검사는 반올림 전 값으로 수행해야 함 (0.995%는 < 1%로 취급)
  let textChangedPct = 0;
  if (from.textHash !== to.textHash) {
    const a = new Set(from.text.split(/\s+/).filter(Boolean));
    const b = new Set(to.text.split(/\s+/).filter(Boolean));
    if (a.size > 0 || b.size > 0) {
      let inter = 0;
      for (const w of a) if (b.has(w)) inter += 1;
      const union = a.size + b.size - inter;
      if (union > 0) {
        const symDiff = union - inter;
        const unroundedPct = (symDiff / union) * 100;
        if (unroundedPct >= THRESHOLDS.textChangedPct) {
          textChangedPct = wordChangedPct(from.text, to.text);
        }
      }
    }
  }
  if (!titleChanged && !metaChanged && headingsAdded.length === 0 &&
      headingsRemoved.length === 0 && textChangedPct === 0) {
    return null;
  }
  return {
    titleChanged,
    ...(titleChanged ? { titleFrom: from.title, titleTo: to.title } : {}),
    metaChanged,
    headingsAdded,
    headingsRemoved,
    textChangedPct,
  };
}

export interface DetectInput {
  fromDate: string;
  toDate: string;
  generatedAt: string;
  from: CompanyLike[];
  to: CompanyLike[];
  fromFps: Record<string, Fingerprint>;
  toFps: Record<string, Fingerprint>;
  weights: Weights;
}

/** 두 측정 시점을 비교해 변화 기록 파일 객체를 만든다(순수). */
export function detectChanges(input: DetectInput): ChangesFile {
  const fromBySlug = new Map(input.from.map((c) => [c.slug, c]));
  const toSlugs = new Set(input.to.map((c) => c.slug));
  const fromRanks = computeRanks(input.from, input.weights);
  const toRanks = computeRanks(input.to, input.weights);

  const entries: ChangeEntry[] = [];
  for (const toCo of input.to) {
    const fromCo = fromBySlug.get(toCo.slug);
    if (!fromCo) {
      entries.push({ slug: toCo.slug, name: toCo.name, kinds: ["new"], summary: null });
      continue;
    }
    const score = diffScores(fromCo, toCo, input.weights);
    const metrics = diffMetrics(fromCo, toCo);
    const fromFp = input.fromFps[toCo.slug];
    const toFp = input.toFps[toCo.slug];
    const content = fromFp && toFp ? diffContent(fromFp, toFp) : null;
    const rf = fromRanks.get(toCo.slug);
    const rt = toRanks.get(toCo.slug);
    const rank = rf !== undefined && rt !== undefined && rf !== rt ? { from: rf, to: rt } : null;

    const kinds: ChangeKind[] = [];
    if (content) kinds.push("content");
    if (score || metrics.length > 0) kinds.push("score");
    if (rank) kinds.push("rank");
    if (kinds.length === 0) continue;

    entries.push({
      slug: toCo.slug,
      name: toCo.name,
      kinds,
      ...(score?.overall ? { overall: score.overall } : {}),
      ...(score && score.axes.length ? { axes: score.axes } : {}),
      ...(rank ? { rank } : {}),
      ...(metrics.length ? { metrics } : {}),
      ...(content ? { content } : {}),
      summary: null,
    });
  }
  for (const fromCo of input.from) {
    if (!toSlugs.has(fromCo.slug)) {
      entries.push({ slug: fromCo.slug, name: fromCo.name, kinds: ["removed"], summary: null });
    }
  }
  return { date: input.toDate, fromDate: input.fromDate, generatedAt: input.generatedAt, entries };
}
