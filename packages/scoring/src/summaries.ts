import type { ChangesFile } from "./detect.js";

export interface ChangeSummary { slug: string; summary: string }

/** changes-outbox JSON 검증 파싱. 실패 시 throw. */
export function parseSummaryFile(raw: string): ChangeSummary {
  const v = JSON.parse(raw) as unknown;
  if (!v || typeof v !== "object") throw new Error("객체가 아닙니다");
  const { slug, summary } = v as { slug?: unknown; summary?: unknown };
  if (typeof slug !== "string" || slug.length === 0) throw new Error("slug 누락");
  if (typeof summary !== "string" || summary.trim().length === 0) throw new Error("summary 누락/빈 문자열");
  return { slug, summary: summary.trim() };
}

/** 요약을 changes 엔트리에 병합(순수). 매칭 안 된 slug 목록을 함께 반환. */
export function mergeSummaries(
  changes: ChangesFile,
  summaries: ChangeSummary[],
): { merged: ChangesFile; unmatched: string[] } {
  const bySlug = new Map(summaries.map((s) => [s.slug, s.summary]));
  const merged: ChangesFile = {
    ...changes,
    entries: changes.entries.map((e) =>
      bySlug.has(e.slug) ? { ...e, summary: bySlug.get(e.slug)! } : e,
    ),
  };
  const entrySlugs = new Set(changes.entries.map((e) => e.slug));
  const unmatched = summaries.map((s) => s.slug).filter((s) => !entrySlugs.has(s));
  return { merged, unmatched };
}
