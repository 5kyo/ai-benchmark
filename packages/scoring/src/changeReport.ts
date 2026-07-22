import type { ChangeEntry, ChangesFile } from "./detect.js";

const KIND_LABEL: Record<string, string> = {
  content: "콘텐츠", score: "점수", rank: "순위", new: "신규 편입", removed: "로스터 제외",
};

const EXCERPT_CHARS = 6000;

function fmtDelta(from: number, to: number): string {
  const d = to - from;
  return `${from} → ${to} (${d > 0 ? "+" : ""}${d})`;
}

/** 엔트리 하나의 변화를 불릿 라인 배열로(CLI·inbox·리포트 공용). */
export function formatEntryLines(e: ChangeEntry): string[] {
  const lines: string[] = [];
  if (e.kinds.includes("new")) lines.push("이번 측정에 신규 편입");
  if (e.kinds.includes("removed")) lines.push("이번 측정에서 로스터 제외");
  if (e.overall) lines.push(`종합 ${fmtDelta(e.overall.from, e.overall.to)}`);
  for (const a of e.axes ?? []) lines.push(`축 ${a.axis} ${fmtDelta(a.from, a.to)}`);
  if (e.rank) lines.push(`순위 ${e.rank.from}위 → ${e.rank.to}위`);
  for (const m of e.metrics ?? []) {
    lines.push(`지표 ${m.metricKey} ${fmtDelta(m.from, m.to)}${m.evidence ? ` — ${m.evidence}` : ""}`);
  }
  const c = e.content;
  if (c) {
    if (c.titleChanged) lines.push(`title 변경: "${c.titleFrom ?? ""}" → "${c.titleTo ?? ""}"`);
    if (c.metaChanged) lines.push("메타 설명 변경");
    if (c.headingsAdded.length) lines.push(`헤딩 추가: ${c.headingsAdded.join(" · ")}`);
    if (c.headingsRemoved.length) lines.push(`헤딩 삭제: ${c.headingsRemoved.join(" · ")}`);
    if (c.textChangedPct > 0) lines.push(`본문 텍스트 약 ${c.textChangedPct}% 변경`);
  }
  return lines;
}

export interface ChangeInboxInput {
  entry: ChangeEntry;
  url: string;
  fromDate: string;
  toDate: string;
  fromText: string;
  toText: string;
}

/** 변화 요약(LLM) 작업 입력 문서 — 자기완결(지시+기계 diff+원문 발췌+출력 계약). */
export function buildChangeInboxDoc(input: ChangeInboxInput): string {
  const cut = (t: string) => (t.length > EXCERPT_CHARS ? t.slice(0, EXCERPT_CHARS) : t);
  return `# 변화 요약 작업: ${input.entry.name} (${input.entry.slug})

## 지시 (그대로 따르세요)
아래 [기계 감지 결과]와 [이전/현재 본문 발췌]를 비교해, 이 회사 홈페이지에서 무엇이 어떻게 바뀌었는지
한국어 1~2문장으로 요약하세요. 마지막에 [출력 형식]의 JSON만 출력하세요.

## 대상
- 회사: ${input.entry.name}
- URL: ${input.url}
- 비교 기간: ${input.fromDate} → ${input.toDate}

## 기계 감지 결과
${formatEntryLines(input.entry).map((l) => `- ${l}`).join("\n") || "- (감지된 변화 라인 없음)"}

## 이전 본문 발췌 (${input.fromDate})
${cut(input.fromText) || "(없음)"}

## 현재 본문 발췌 (${input.toDate})
${cut(input.toText) || "(없음)"}

## 출력 형식 (이 스키마의 JSON만; scoring/changes-outbox/${input.entry.slug}.json 로 저장)
\`\`\`json
{ "slug": "${input.entry.slug}", "summary": "<한국어 1~2문장 요약>" }
\`\`\`
`;
}

/** 변화 기록 → 사내 공유용 마크다운 리포트. */
export function buildChangeReport(changes: ChangesFile): string {
  const head = `# 경쟁사 변화 리포트 ${changes.date}

- 비교 기간: ${changes.fromDate} → ${changes.date}
- 변화 감지: ${changes.entries.length}개사
`;
  if (changes.entries.length === 0) return `${head}\n변화가 감지되지 않았습니다.\n`;
  const body = changes.entries
    .map((e) => {
      const badge = e.kinds.map((k) => KIND_LABEL[k] ?? k).join(" · ");
      const summary = e.summary ? `\n> ${e.summary}\n` : "";
      const lines = formatEntryLines(e).map((l) => `- ${l}`).join("\n");
      return `\n## ${e.name} — ${badge}\n${summary}\n${lines}\n`;
    })
    .join("");
  return head + body;
}
