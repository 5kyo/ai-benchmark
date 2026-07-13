import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Axis, Weights, ScoreView, MetricScore } from "@ai-benchmark/core";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";

export interface DaySnapshot {
  date: string;
  companies: CompanyRecord[];
}
export type SnapshotHistory = DaySnapshot[];

/** 한 지표의 측정값: 모델 평균 + 모델별 값(그날 그 모델이 없으면 null). */
export interface MetricSeries {
  average: number | null;
  byModel: Record<string, number | null>;
}

export interface TrendPoint {
  date: string;
  overall: MetricSeries;
  A: MetricSeries;
  B: MetricSeries;
  C: MetricSeries;
  D: MetricSeries;
}

export interface SelfTrend {
  /** 날짜 오름차순 측정 지점. */
  points: TrendPoint[];
  /** 히스토리 전체에서 자사 점수에 등장한 LLM 모델(규칙·평균 제외), 정렬됨. */
  models: string[];
}

/** snapshots/ 디렉터리의 *.json을 읽어 날짜 오름차순 히스토리로. 깨진/필드누락 파일은 skip. */
export function loadSnapshotHistory(dir: string): SnapshotHistory {
  if (!existsSync(dir)) return [];
  const days: SnapshotHistory = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as unknown;
      if (
        raw && typeof raw === "object" &&
        typeof (raw as { date?: unknown }).date === "string" &&
        Array.isArray((raw as { companies?: unknown }).companies)
      ) {
        const r = raw as { date: string; companies: CompanyRecord[] };
        days.push({ date: r.date, companies: r.companies });
      }
    } catch {
      // 깨진 파일은 건너뛴다
    }
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** 히스토리 전체 자사 레코드에서 LLM 모델 목록을 수집(규칙·평균 제외), 정렬해 반환. */
function selfModels(history: SnapshotHistory): string[] {
  const set = new Set<string>();
  for (const day of history) {
    const self = day.companies.find((c) => c.isSelf);
    if (!self || !Array.isArray(self.scores)) continue;
    for (const s of self.scores as MetricScore[]) {
      if (s.model !== "rule-based" && s.model !== "average") set.add(s.model);
    }
  }
  return [...set].sort();
}

/** 한 지표를 평균 + 모델별로 파생. 그날 없는 모델은 null(연결 끊김). */
function seriesFor(
  scores: MetricScore[],
  models: string[],
  derive: (view: ScoreView) => number | null,
): MetricSeries {
  const byModel: Record<string, number | null> = {};
  for (const m of models) byModel[m] = derive({ model: m });
  return { average: derive("average"), byModel };
}

/** 각 스냅샷에서 자사(isSelf) 레코드를 찾아 종합·축별 점수를 평균·모델별로 파생.
 * 자사 없는 날은 제외. `view`는 평균 계산 방식이며 모델별 선은 항상 각 모델 뷰로 파생한다. */
export function buildSelfTrend(history: SnapshotHistory, w: Weights, view: ScoreView): SelfTrend {
  const axes: Axis[] = ["A", "B", "C", "D"];
  const models = selfModels(history);
  const points: TrendPoint[] = [];
  for (const day of history) {
    const self = day.companies.find((c) => c.isSelf);
    if (!self || !Array.isArray(self.scores)) continue;
    const overallSeries = seriesFor(self.scores, models, (v) =>
      v === "average" ? overallForView(self.scores, w, view) : overallForView(self.scores, w, v));
    const [a, b, c, d] = axes.map((ax) =>
      seriesFor(self.scores, models, (v) =>
        v === "average" ? axisForView(self.scores, ax, w, view) : axisForView(self.scores, ax, w, v)));
    points.push({ date: day.date, overall: overallSeries, A: a, B: b, C: c, D: d });
  }
  return { points, models };
}
