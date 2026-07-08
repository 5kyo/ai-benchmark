import type { Axis } from "@ai-benchmark/core";
import type { LlmMetric } from "./rubric.js";

export interface InboxInput {
  name: string;
  slug: string;
  url: string;
  text: string;
  rubricVersion: string;
  metrics: LlmMetric[];
  rubricText: string;
}

const AXES: Axis[] = ["A", "B", "C", "D"];

/** 루브릭 프롬프트 + 원문 + 출력 스키마가 모두 박힌 자기완결 채점 입력 문서. */
export function buildInboxDoc(input: InboxInput): string {
  // 축별로 그룹지어 채점 대상 지표를 나열한다.
  const grouped = AXES.map((axis) => {
    const keys = input.metrics.filter((m) => m.axis === axis).map((m) => `- ${m.key}`);
    return keys.length ? `축 ${axis}:\n${keys.join("\n")}` : "";
  })
    .filter(Boolean)
    .join("\n");

  const exampleScores = input.metrics
    .map((m) => `    { "metricKey": "${m.key}", "score": 0, "evidence": "..." }`)
    .join(",\n");

  return `# AI 채점 작업: ${input.name} (${input.slug})

## 지시 (그대로 따르세요)
아래 [홈페이지 원문]을 읽고, [루브릭]의 LLM 지표 ${input.metrics.length}개를 각각 0~100 정수로 채점하세요.
각 지표에 1~2문장 근거(evidence)를 쓰세요. 마지막에 [출력 형식]의 JSON만 출력하세요.
채점 대상 지표(정확히 이 키들만, 추가/누락 금지):
${grouped}

## 루브릭 (${input.rubricVersion})
${input.rubricText}

## 대상
- 회사: ${input.name}
- URL: ${input.url}

## 홈페이지 원문
${input.text}

## 출력 형식 (이 스키마의 JSON만; outbox/<model>/${input.slug}.json 로 저장)
\`\`\`json
{
  "slug": "${input.slug}",
  "model": "<사용한 모델 id, 예: claude-sonnet-5 또는 gpt-5.5>",
  "rubricVersion": "${input.rubricVersion}",
  "scores": [
${exampleScores}
  ]
}
\`\`\`
`;
}

/** .json 스냅샷 파일명 중 사전순 최대(=타임스탬프 최신)를 고른다. */
export function pickLatestSnapshot(files: string[]): string | null {
  const jsons = files.filter((f) => f.endsWith(".json")).sort();
  return jsons.length ? jsons[jsons.length - 1] : null;
}
