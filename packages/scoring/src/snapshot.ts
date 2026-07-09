export interface SnapshotFile<T> {
  date: string;
  generatedAt: string;
  rubricVersion: string;
  companies: T[];
}

/** 계산된 회사 레코드 배열을 날짜별 스냅샷 파일 객체로 감싼다. */
export function buildSnapshotFile<T>(
  companies: T[],
  meta: { date: string; generatedAt: string; rubricVersion: string },
): SnapshotFile<T> {
  return {
    date: meta.date,
    generatedAt: meta.generatedAt,
    rubricVersion: meta.rubricVersion,
    companies,
  };
}

/** snapshots/ 아래 파일명. */
export function snapshotFilename(date: string): string {
  return `${date}.json`;
}

/** 로컬 타임존 기준 YYYY-MM-DD 문자열. */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
