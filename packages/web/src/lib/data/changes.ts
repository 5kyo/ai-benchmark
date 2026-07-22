import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// changes/<date>.json 의 웹 표시용 미러 타입.
// (스코어링 패키지와 별도 정의 — CompanyRecord를 web/types.ts에 두는 기존 관례와 동일)
export interface WebScoreDelta {
  from: number;
  to: number;
}
export interface WebAxisDelta extends WebScoreDelta {
  axis: string;
}
export interface WebMetricChange {
  axis: string;
  metricKey: string;
  from: number;
  to: number;
  evidence?: string;
}
export interface WebContentChange {
  titleChanged: boolean;
  titleFrom?: string;
  titleTo?: string;
  metaChanged: boolean;
  headingsAdded: string[];
  headingsRemoved: string[];
  textChangedPct: number;
}
export interface WebChangeEntry {
  slug: string;
  name: string;
  kinds: string[];
  overall?: WebScoreDelta;
  axes?: WebAxisDelta[];
  rank?: WebScoreDelta;
  metrics?: WebMetricChange[];
  content?: WebContentChange;
  summary: string | null;
}
export interface WebChangesFile {
  date: string;
  fromDate: string;
  entries: WebChangeEntry[];
}

/** changes/*.json 로드, 날짜 내림차순. 깨진/필드누락 파일은 skip. */
export function loadChangeHistory(dir: string): WebChangesFile[] {
  if (!existsSync(dir)) return [];
  const out: WebChangesFile[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as unknown;
      if (
        raw && typeof raw === "object" &&
        typeof (raw as { date?: unknown }).date === "string" &&
        typeof (raw as { fromDate?: unknown }).fromDate === "string" &&
        Array.isArray((raw as { entries?: unknown }).entries)
      ) {
        const r = raw as WebChangesFile;
        out.push({ date: r.date, fromDate: r.fromDate, entries: r.entries });
      }
    } catch {
      // 깨진 파일은 건너뛴다
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
