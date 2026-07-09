import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Axis, Weights, ScoreView } from "@ai-benchmark/core";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";

export interface DaySnapshot {
  date: string;
  companies: CompanyRecord[];
}
export type SnapshotHistory = DaySnapshot[];

export interface TrendPoint {
  date: string;
  overall: number | null;
  A: number | null;
  B: number | null;
  C: number | null;
  D: number | null;
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

/** 각 스냅샷에서 자사(isSelf) 레코드를 찾아 종합·축별 점수를 파생. 자사 없는 날은 제외. */
export function buildSelfTrend(history: SnapshotHistory, w: Weights, view: ScoreView): TrendPoint[] {
  const axes: Axis[] = ["A", "B", "C", "D"];
  const out: TrendPoint[] = [];
  for (const day of history) {
    const self = day.companies.find((c) => c.isSelf);
    if (!self || !Array.isArray(self.scores)) continue;
    const [a, b, c, d] = axes.map((ax) => axisForView(self.scores, ax, w, view));
    out.push({
      date: day.date,
      overall: overallForView(self.scores, w, view),
      A: a, B: b, C: c, D: d,
    });
  }
  return out;
}
