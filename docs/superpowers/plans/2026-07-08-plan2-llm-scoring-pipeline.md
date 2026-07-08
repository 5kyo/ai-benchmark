# Plan 2 — LLM 채점 파이프라인 (축 C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 크롤링된 홈페이지 원문을 자기완결적 채점 입력(inbox)으로 만들고, Claude·Codex가 동일 루브릭·동일 입력으로 낸 축 C(콘텐츠 품질) 점수를 검증·모델별로 Supabase에 적재하며, 대시보드가 쓸 모델 인지 집계(모델 평균 / 모델별 뷰)를 제공한다.

**Architecture:** 배치 구동 방식 = **수동 드롭인 + 가드레일**. `packages/scoring/prepare`가 `scoring/inbox/<slug>.md`(루브릭 프롬프트 + 원문 + 출력 스키마가 모두 박힌 파일)를 생성 → 사용자가 Claude Code / Codex CLI로 채점해 `scoring/outbox/<model>/<slug>.json` 저장 → `packages/scoring/import`가 스키마 검증 후 축 C `metric_scores`를 **가장 최근 scan에 model 태그로 upsert**. `packages/core`에 모델 인지 집계(`collapseForView`)를 추가해, 같은 metricKey를 여러 모델이 채점해도 이중 계산되지 않도록 뷰별로 지표당 1점으로 collapse한다.

**Tech Stack:** TypeScript(ESM), pnpm workspaces, vitest, cheerio(원문 텍스트 추출), yaml, @supabase/supabase-js, tsx. Plan 1 산출물 위에서 동작.

## Global Constraints

- Node.js >= 20, pnpm >= 9. 모든 패키지 ESM(`"type": "module"`). TypeScript `^5.5` strict. vitest `^2`.
- 상대 import는 `.js` 확장자 지정(예: `from "./schema.js"`). 크로스패키지는 `@ai-benchmark/core` 등 bare specifier.
- 축 C 지표 키는 정확히 `clarity`, `product_depth`, `key_info_present`, `freshness_clarity` (config/weights.yaml 축 C 단일 출처에서 읽는다 — 코드에 하드코딩 금지).
- 모든 점수는 0~100 number. 축 C 점수의 `model` 값은 채점에 쓴 실제 모델 id(예: `claude-opus-4-8`, `gpt-...`) — 절대 `'rule-based'`가 아니다.
- `metric_scores`의 유니크 키는 `(scan_id, axis, metric_key, model)`. 모델 점수는 이 키로 **upsert**(재실행 안전).
- CLI 진입점(`cli-*.ts`)의 `main()`은 반드시 엔트리포인트 가드 뒤에서 실행 — 모듈 import 시 부작용 없어야 함(테스트가 순수 헬퍼를 import 함).
- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Plan 1에서 이어지는 사실 (구현자가 알아야 할 인터페이스)

- `@ai-benchmark/core` 익스포트: `Axis`('A'|'B'|'C'|'D'), `MetricScore { axis; metricKey; model; score; evidence?; rawDetail? }`, `Weights { axes; metrics }`, `loadWeights(path)`, `axisScore(scores, axis, w)`, `overallScore(scores, w)`.
- `@ai-benchmark/db` 익스포트: `toMetricScoreRows(scanId, scores)`, `importScan(...)`, `CompanyLike`. 패키지 `main`은 `./src/index.ts`.
- `@ai-benchmark/crawler` 익스포트: `loadCompanies(path): CompanyConfig[]`(필드 `name, slug, homepageUrl, isSelf, category?`), `RawSnapshot { company; scannedAt; homepage; robots; sitemap; llmsTxt }`(`homepage.body`가 HTML 문자열), `snapshotPath(rawDir, slug, scannedAt)`.
- Plan 1의 배치 CLI(`pnpm crawl`)는 `raw/<slug>/<ts>.json`에 `RawSnapshot`을 저장하고 규칙 점수를 최근 scan에 적재한다. Plan 2는 그 raw 스냅샷을 재사용(재크롤 안 함).
- 루트 `tsconfig.json`은 project references 방식(`tsc -b`). 각 패키지 tsconfig는 `composite: true` + 자신이 import하는 패키지를 `references`에 나열.
- config/weights.yaml 축 C: `clarity: 0.30, product_depth: 0.25, key_info_present: 0.25, freshness_clarity: 0.20`. config/rubric/rubric_v1.md에 지표 정의 존재.

## 범위 밖 (YAGNI)

- 축 C 개선항목(improvements) 생성 — Plan 3(대시보드)에서 evidence·점수로 표시. (Plan 1의 A/B/D 개선항목은 이미 존재.)
- 스크립트 자동 구동(codex exec 셸아웃) — 이번엔 수동 드롭인만.
- 대시보드 렌더(Plan 3), 실제 기업 리스트 확보(운영).

---

## File Structure

```
ai-benchmark/
├─ config/ (기존)                       # weights.yaml, rubric/rubric_v1.md 재사용
├─ scoring/                             # 배치 작업 디렉터리 (gitignore)
│   ├─ inbox/<slug>.md                  # prepare 생성: 자기완결 채점 입력
│   └─ outbox/<model>/<slug>.json       # 사용자가 Claude/Codex로 채점해 저장
├─ packages/
│   ├─ core/
│   │   └─ src/view.ts                  # (신규) 모델 인지 집계: collapseForView 등
│   ├─ db/
│   │   ├─ src/model-scores.ts          # (신규) getLatestScanId, importModelScores
│   │   └─ src/index.ts                 # (수정) model-scores 재수출
│   └─ scoring/                         # (신규 패키지) @ai-benchmark/scoring
│       ├─ package.json
│       ├─ tsconfig.json
│       └─ src/
│           ├─ rubric.ts                # 축 C 지표·루브릭 로더
│           ├─ text.ts                  # HTML → 원문 텍스트 추출
│           ├─ prepare.ts               # buildInboxDoc + 최근 스냅샷 선택
│           ├─ schema.ts                # LLM 출력 파싱·검증 + toAxisCScores
│           ├─ cli-prepare.ts           # 배치: inbox 생성 (엔트리포인트 가드)
│           ├─ cli-import.ts            # 배치: outbox 검증·적재 (엔트리포인트 가드)
│           └─ index.ts                 # 배럴
└─ .gitignore                           # (수정) scoring/ 추가
```

---

## Task 1: core — 모델 인지 집계 뷰

**Files:**
- Create: `packages/core/src/view.ts`, `packages/core/src/view.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `Axis`, `MetricScore`, `Weights`, `axisScore`, `overallScore` (기존 core)
- Produces:
  - `type ScoreView = "average" | { model: string }`
  - `const RULE_MODEL = "rule-based"`
  - `function isRuleBased(model: string): boolean`
  - `function collapseForView(scores: MetricScore[], view: ScoreView): MetricScore[]` — 규칙 점수는 유지, LLM 점수는 뷰별로 (axis,metricKey)당 1점으로 collapse. average는 모델 평균(model="average"), {model}는 해당 모델만.
  - `function axisForView(scores, axis, w, view): number | null`
  - `function overallForView(scores, w, view): number | null`

- [ ] **Step 1: 실패 테스트 작성**

`packages/core/src/view.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { collapseForView, axisForView, overallForView } from "./view.js";
import type { MetricScore, Weights } from "./types.js";

const w: Weights = {
  axes: { A: 0.5, B: 0, C: 0.5, D: 0 },
  metrics: { A: { m1: 1.0 }, B: {}, C: { c1: 0.5, c2: 0.5 }, D: {} },
};

function ms(axis: MetricScore["axis"], metricKey: string, model: string, score: number): MetricScore {
  return { axis, metricKey, model, score };
}

describe("collapseForView", () => {
  const scores: MetricScore[] = [
    ms("A", "m1", "rule-based", 80),
    ms("C", "c1", "claude-x", 60),
    ms("C", "c1", "gpt-x", 100),
    ms("C", "c2", "claude-x", 40),
    ms("C", "c2", "gpt-x", 60),
  ];

  it("average view collapses each C metric to the model mean and keeps rule scores", () => {
    const out = collapseForView(scores, "average");
    const c1 = out.find((s) => s.axis === "C" && s.metricKey === "c1")!;
    expect(c1.score).toBe(80); // (60+100)/2
    expect(c1.model).toBe("average");
    expect(out.find((s) => s.metricKey === "m1")!.score).toBe(80); // rule kept
    // 지표당 1점만 남는다: C c1,c2 각각 1개 + A m1 1개 = 3
    expect(out).toHaveLength(3);
  });

  it("model view keeps only that model's C scores", () => {
    const out = collapseForView(scores, { model: "gpt-x" });
    expect(out.find((s) => s.metricKey === "c1")!.score).toBe(100);
    expect(out.find((s) => s.metricKey === "c2")!.score).toBe(60);
    expect(out.some((s) => s.model === "claude-x")).toBe(false);
  });
});

describe("axisForView / overallForView", () => {
  const scores: MetricScore[] = [
    ms("A", "m1", "rule-based", 80),
    ms("C", "c1", "claude-x", 60),
    ms("C", "c1", "gpt-x", 100),
    ms("C", "c2", "claude-x", 40),
    ms("C", "c2", "gpt-x", 60),
  ];

  it("axis C differs by view", () => {
    // claude: c1=60,c2=40 → 0.5*60+0.5*40=50 ; gpt: c1=100,c2=60 → 80 ; average: 65
    expect(axisForView(scores, "C", w, { model: "claude-x" })).toBe(50);
    expect(axisForView(scores, "C", w, { model: "gpt-x" })).toBe(80);
    expect(axisForView(scores, "C", w, "average")).toBe(65);
  });

  it("overall combines rule axis A with the chosen C view (no double counting)", () => {
    // axes A:0.5 C:0.5 → average: 0.5*80 + 0.5*65 = 72.5
    expect(overallForView(scores, w, "average")).toBe(72.5);
    // claude: 0.5*80 + 0.5*50 = 65
    expect(overallForView(scores, w, { model: "claude-x" })).toBe(65);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/core/src/view.test.ts`
Expected: FAIL ("Cannot find module './view.js'" 또는 함수 미정의).

- [ ] **Step 3: 구현**

`packages/core/src/view.ts`:
```ts
import type { Axis, MetricScore, Weights } from "./types.js";
import { axisScore, overallScore } from "./aggregate.js";

export type ScoreView = "average" | { model: string };
export const RULE_MODEL = "rule-based";

export function isRuleBased(model: string): boolean {
  return model === RULE_MODEL;
}

/** 뷰에 따라 (axis, metricKey)당 점수 하나만 남긴다.
 * 규칙 점수는 항상 유지. LLM 점수는 average면 모델 평균, {model}이면 해당 모델만. */
export function collapseForView(scores: MetricScore[], view: ScoreView): MetricScore[] {
  const rule = scores.filter((s) => isRuleBased(s.model));
  const llm = scores.filter((s) => !isRuleBased(s.model));

  const groups = new Map<string, MetricScore[]>();
  for (const s of llm) {
    const key = `${s.axis}::${s.metricKey}`;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const collapsed: MetricScore[] = [];
  for (const group of groups.values()) {
    if (view === "average") {
      const avg = group.reduce((sum, s) => sum + s.score, 0) / group.length;
      collapsed.push({ axis: group[0].axis, metricKey: group[0].metricKey, model: "average", score: avg });
    } else {
      const picked = group.find((s) => s.model === view.model);
      if (picked) collapsed.push(picked);
    }
  }
  return [...rule, ...collapsed];
}

export function axisForView(scores: MetricScore[], axis: Axis, w: Weights, view: ScoreView): number | null {
  return axisScore(collapseForView(scores, view), axis, w);
}

export function overallForView(scores: MetricScore[], w: Weights, view: ScoreView): number | null {
  return overallScore(collapseForView(scores, view), w);
}
```

- [ ] **Step 4: index.ts에 재수출 추가**

`packages/core/src/index.ts`의 마지막에 한 줄 추가:
```ts
export * from "./view.js";
```

- [ ] **Step 5: 통과 확인 + 전체 테스트**

Run: `pnpm test`
Expected: 기존 39 + view 4 = 43 tests PASS.
Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(core): model-aware score views (collapseForView, overallForView)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: scoring 패키지 스캐폴드 + 루브릭/텍스트 로더

**Files:**
- Create: `packages/scoring/package.json`, `packages/scoring/tsconfig.json`
- Create: `packages/scoring/src/rubric.ts`, `packages/scoring/src/text.ts`, `packages/scoring/src/index.ts`
- Test: `packages/scoring/src/rubric.test.ts`, `packages/scoring/src/text.test.ts`

**Interfaces:**
- Consumes: config/weights.yaml (축 C), config/rubric/rubric_v1.md, cheerio
- Produces:
  - `interface AxisCMetric { key: string; weight: number }`
  - `function loadAxisCMetrics(weightsPath: string): AxisCMetric[]` — 축 C 지표 키·가중치.
  - `function loadRubricText(rubricPath: string): string`
  - `function extractText(html: string, maxChars?: number): string` — script/style 제거, 공백 정규화, maxChars(기본 12000) 절단.

- [ ] **Step 1: 패키지 초기화**

`packages/scoring/package.json`:
```json
{
  "name": "@ai-benchmark/scoring",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@ai-benchmark/core": "workspace:*",
    "@ai-benchmark/db": "workspace:*",
    "@ai-benchmark/crawler": "workspace:*",
    "@supabase/supabase-js": "^2.45.4",
    "cheerio": "^1.0.0",
    "yaml": "^2.5.0",
    "dotenv": "^16.4.5"
  }
}
```

`packages/scoring/tsconfig.json` (import하는 패키지를 references에 나열):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "outDir": "dist", "rootDir": "src" },
  "references": [
    { "path": "../core" },
    { "path": "../db" },
    { "path": "../crawler" }
  ],
  "include": ["src"]
}
```

루트 `tsconfig.json`의 references 배열에 추가:
```json
{ "path": "packages/scoring" }
```
Run: `pnpm install`

- [ ] **Step 2: 텍스트 추출 테스트 작성**

`packages/scoring/src/text.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractText } from "./text.js";

describe("extractText", () => {
  it("strips script/style and collapses whitespace", () => {
    const html = `<html><head><style>.a{}</style></head>
      <body><script>var x=1;</script><h1>Acme</h1>   <p>We build\n\n chains.</p></body></html>`;
    const t = extractText(html);
    expect(t).toContain("Acme");
    expect(t).toContain("We build chains.");
    expect(t).not.toContain("var x");
    expect(t).not.toContain(".a{}");
  });

  it("truncates to maxChars", () => {
    const html = `<body>${"a".repeat(500)}</body>`;
    expect(extractText(html, 100).length).toBe(100);
  });
});
```

- [ ] **Step 3: 텍스트 추출 구현**

`packages/scoring/src/text.ts`:
```ts
import * as cheerio from "cheerio";

const MAX_CHARS = 12000;

export function extractText(html: string, maxChars = MAX_CHARS): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text() || $.root().text();
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxChars ? clean.slice(0, maxChars) : clean;
}
```

- [ ] **Step 4: 루브릭 로더 테스트 작성**

`packages/scoring/src/rubric.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadAxisCMetrics, loadRubricText } from "./rubric.js";

const here = dirname(fileURLToPath(import.meta.url));
const weightsPath = resolve(here, "../../../config/weights.yaml");
const rubricPath = resolve(here, "../../../config/rubric/rubric_v1.md");

describe("loadAxisCMetrics", () => {
  it("loads exactly the four axis-C metric keys from weights.yaml", () => {
    const metrics = loadAxisCMetrics(weightsPath);
    const keys = metrics.map((m) => m.key).sort();
    expect(keys).toEqual(["clarity", "freshness_clarity", "key_info_present", "product_depth"]);
  });

  it("metric weights sum to 1.0", () => {
    const sum = loadAxisCMetrics(weightsPath).reduce((a, m) => a + m.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe("loadRubricText", () => {
  it("returns the rubric markdown text", () => {
    expect(loadRubricText(rubricPath)).toContain("clarity");
  });
});
```

- [ ] **Step 5: 루브릭 로더 구현**

`packages/scoring/src/rubric.ts`:
```ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface AxisCMetric {
  key: string;
  weight: number;
}

/** config/weights.yaml의 축 C 지표 키·가중치를 읽는다 (단일 출처). */
export function loadAxisCMetrics(weightsPath: string): AxisCMetric[] {
  const doc = parse(readFileSync(weightsPath, "utf8")) as {
    metrics?: { C?: Record<string, number> };
  };
  const c = doc.metrics?.C ?? {};
  return Object.entries(c).map(([key, weight]) => ({ key, weight }));
}

export function loadRubricText(rubricPath: string): string {
  return readFileSync(rubricPath, "utf8");
}
```

- [ ] **Step 6: 배럴 + 테스트 실행**

`packages/scoring/src/index.ts`:
```ts
export * from "./rubric.js";
export * from "./text.js";
```

Run: `pnpm test`
Expected: 기존 43 + text 2 + rubric 3 = 48 PASS.
Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat(scoring): package scaffold, axis-C rubric loader, HTML text extraction

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: prepare — inbox 문서 생성 + 배치 CLI

**Files:**
- Create: `packages/scoring/src/prepare.ts`, `packages/scoring/src/cli-prepare.ts`
- Modify: `packages/scoring/src/index.ts` (prepare 재수출), `.gitignore` (scoring/ 추가), 루트 `package.json` (prepare-scores 스크립트)
- Test: `packages/scoring/src/prepare.test.ts`

**Interfaces:**
- Consumes: `AxisCMetric` (Task 2), `loadCompanies`/`RawSnapshot` (crawler), `extractText`/`loadAxisCMetrics`/`loadRubricText` (Task 2)
- Produces:
  - `interface InboxInput { name: string; slug: string; url: string; text: string; rubricVersion: string; metrics: AxisCMetric[]; rubricText: string }`
  - `function buildInboxDoc(input: InboxInput): string` — 루브릭 프롬프트 + 원문 + 출력 스키마가 박힌 자기완결 마크다운.
  - `function pickLatestSnapshot(files: string[]): string | null` — `.json` 파일명 중 사전순 최대(타임스탬프 최신) 반환.

- [ ] **Step 1: 실패 테스트 작성**

`packages/scoring/src/prepare.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildInboxDoc, pickLatestSnapshot } from "./prepare.js";
import type { AxisCMetric } from "./rubric.js";

const metrics: AxisCMetric[] = [
  { key: "clarity", weight: 0.3 },
  { key: "product_depth", weight: 0.25 },
  { key: "key_info_present", weight: 0.25 },
  { key: "freshness_clarity", weight: 0.2 },
];

describe("buildInboxDoc", () => {
  const doc = buildInboxDoc({
    name: "Acme", slug: "acme", url: "https://acme.example",
    text: "Acme builds blockchains.", rubricVersion: "rubric_v1",
    metrics, rubricText: "루브릭 본문",
  });

  it("embeds company, url, and extracted text", () => {
    expect(doc).toContain("Acme");
    expect(doc).toContain("https://acme.example");
    expect(doc).toContain("Acme builds blockchains.");
  });

  it("lists every axis-C metric key", () => {
    for (const m of metrics) expect(doc).toContain(m.key);
  });

  it("embeds the output JSON schema with the slug and a model placeholder", () => {
    expect(doc).toContain(`"slug": "acme"`);
    expect(doc).toContain(`"model"`);
    expect(doc).toContain(`outbox/<model>/acme.json`);
  });
});

describe("pickLatestSnapshot", () => {
  it("returns the lexicographically greatest json filename", () => {
    const files = [
      "2026-07-01T00-00-00-000Z.json",
      "2026-07-08T09-30-00-000Z.json",
      "2026-07-05T12-00-00-000Z.json",
      "notes.txt",
    ];
    expect(pickLatestSnapshot(files)).toBe("2026-07-08T09-30-00-000Z.json");
  });

  it("returns null when there are no json files", () => {
    expect(pickLatestSnapshot(["a.txt", "b.md"])).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/scoring/src/prepare.test.ts`
Expected: FAIL (모듈/함수 미정의).

- [ ] **Step 3: prepare 구현**

`packages/scoring/src/prepare.ts`:
```ts
import type { AxisCMetric } from "./rubric.js";

export interface InboxInput {
  name: string;
  slug: string;
  url: string;
  text: string;
  rubricVersion: string;
  metrics: AxisCMetric[];
  rubricText: string;
}

/** 루브릭 프롬프트 + 원문 + 출력 스키마가 모두 박힌 자기완결 채점 입력 문서. */
export function buildInboxDoc(input: InboxInput): string {
  const metricList = input.metrics.map((m) => `- ${m.key}`).join("\n");
  const exampleScores = input.metrics
    .map((m) => `    { "metricKey": "${m.key}", "score": 0, "evidence": "..." }`)
    .join(",\n");
  return `# AI 채점 작업: ${input.name} (${input.slug})

## 지시 (그대로 따르세요)
아래 [홈페이지 원문]을 읽고, [루브릭]의 축 C 지표 ${input.metrics.length}개를 각각 0~100 정수로 채점하세요.
각 지표에 1~2문장 근거(evidence)를 쓰세요. 마지막에 [출력 형식]의 JSON만 출력하세요.
채점 대상 지표(정확히 이 키들만, 추가/누락 금지):
${metricList}

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
  "model": "<사용한 모델 id, 예: claude-opus-4-8 또는 gpt-4o>",
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
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test packages/scoring/src/prepare.test.ts`
Expected: 5개 PASS.

- [ ] **Step 5: 배럴/gitignore/스크립트 갱신**

`packages/scoring/src/index.ts`에 추가:
```ts
export * from "./prepare.js";
```

`.gitignore`에 한 줄 추가:
```
scoring/
```

루트 `package.json`의 `scripts`에 추가:
```json
"prepare-scores": "tsx packages/scoring/src/cli-prepare.ts"
```

- [ ] **Step 6: 배치 CLI 구현 (엔트리포인트 가드 필수)**

`packages/scoring/src/cli-prepare.ts`:
```ts
import "dotenv/config";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCompanies } from "@ai-benchmark/crawler";
import type { RawSnapshot } from "@ai-benchmark/crawler";
import { loadAxisCMetrics, loadRubricText } from "./rubric.js";
import { extractText } from "./text.js";
import { buildInboxDoc, pickLatestSnapshot } from "./prepare.js";

const RUBRIC_VERSION = "rubric_v1";

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const companies = loadCompanies(resolve(root, "config/companies.yaml"));
  const metrics = loadAxisCMetrics(resolve(root, "config/weights.yaml"));
  const rubricText = loadRubricText(resolve(root, "config/rubric/rubric_v1.md"));
  const inboxDir = resolve(root, "scoring/inbox");
  mkdirSync(inboxDir, { recursive: true });

  let written = 0;
  for (const company of companies) {
    const rawCompanyDir = resolve(root, "raw", company.slug);
    if (!existsSync(rawCompanyDir)) {
      console.log(`[${company.slug}] no raw snapshot — run \`pnpm crawl\` first, skipped`);
      continue;
    }
    const latest = pickLatestSnapshot(readdirSync(rawCompanyDir));
    if (!latest) {
      console.log(`[${company.slug}] no .json snapshot, skipped`);
      continue;
    }
    const snap = JSON.parse(readFileSync(resolve(rawCompanyDir, latest), "utf8")) as RawSnapshot;
    const text = extractText(snap.homepage.body);
    const doc = buildInboxDoc({
      name: company.name,
      slug: company.slug,
      url: company.homepageUrl,
      text,
      rubricVersion: RUBRIC_VERSION,
      metrics,
      rubricText,
    });
    writeFileSync(resolve(inboxDir, `${company.slug}.md`), doc);
    written += 1;
    console.log(`[${company.slug}] inbox written`);
  }
  console.log(`\n${written} inbox file(s) in scoring/inbox/. Score each with Claude Code / Codex, save JSON to scoring/outbox/<model>/<slug>.json, then run \`pnpm import-scores\`.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 7: 전체 테스트 + 타입체크**

Run: `pnpm test`
Expected: 48 + prepare 5 = 53 PASS.
Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat(scoring): self-contained inbox docs + prepare batch CLI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: schema — LLM 출력 검증 + 축 C 매핑

**Files:**
- Create: `packages/scoring/src/schema.ts`
- Modify: `packages/scoring/src/index.ts` (schema 재수출)
- Test: `packages/scoring/src/schema.test.ts`

**Interfaces:**
- Consumes: `MetricScore` (core)
- Produces:
  - `interface ScoreEntry { metricKey: string; score: number; evidence: string }`
  - `interface ScoreOutput { slug: string; model: string; rubricVersion: string; scores: ScoreEntry[] }`
  - `function parseAndValidate(raw: string, expectedMetricKeys: string[]): ScoreOutput` — JSON 파싱 + 필수 필드/범위/지표 집합 검증. 실패 시 throw.
  - `function toAxisCScores(output: ScoreOutput): MetricScore[]` — 각 항목을 `{ axis:'C', metricKey, model, score, evidence }`로 매핑.

- [ ] **Step 1: 실패 테스트 작성**

`packages/scoring/src/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseAndValidate, toAxisCScores } from "./schema.js";

const KEYS = ["clarity", "product_depth", "key_info_present", "freshness_clarity"];

function validJson(over: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    slug: "acme",
    model: "claude-opus-4-8",
    rubricVersion: "rubric_v1",
    scores: [
      { metricKey: "clarity", score: 80, evidence: "명확" },
      { metricKey: "product_depth", score: 60, evidence: "보통" },
      { metricKey: "key_info_present", score: 40, evidence: "부족" },
      { metricKey: "freshness_clarity", score: 70, evidence: "최신" },
    ],
    ...over,
  });
}

describe("parseAndValidate", () => {
  it("accepts a well-formed output with all four metrics", () => {
    const out = parseAndValidate(validJson(), KEYS);
    expect(out.slug).toBe("acme");
    expect(out.model).toBe("claude-opus-4-8");
    expect(out.scores).toHaveLength(4);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAndValidate("{not json", KEYS)).toThrow(/invalid JSON/);
  });

  it("throws when a required metric is missing", () => {
    const missing = JSON.stringify({
      slug: "acme", model: "gpt-x", rubricVersion: "rubric_v1",
      scores: [{ metricKey: "clarity", score: 80, evidence: "x" }],
    });
    expect(() => parseAndValidate(missing, KEYS)).toThrow(/missing metric/);
  });

  it("throws when a score is out of range", () => {
    const bad = validJson({
      scores: [
        { metricKey: "clarity", score: 120, evidence: "x" },
        { metricKey: "product_depth", score: 60, evidence: "x" },
        { metricKey: "key_info_present", score: 40, evidence: "x" },
        { metricKey: "freshness_clarity", score: 70, evidence: "x" },
      ],
    });
    expect(() => parseAndValidate(bad, KEYS)).toThrow(/out of range/);
  });

  it("throws on an unexpected extra metric", () => {
    const extra = validJson({
      scores: [
        { metricKey: "clarity", score: 80, evidence: "x" },
        { metricKey: "product_depth", score: 60, evidence: "x" },
        { metricKey: "key_info_present", score: 40, evidence: "x" },
        { metricKey: "freshness_clarity", score: 70, evidence: "x" },
        { metricKey: "made_up", score: 50, evidence: "x" },
      ],
    });
    expect(() => parseAndValidate(extra, KEYS)).toThrow(/unexpected metric/);
  });

  it("throws when model is missing", () => {
    expect(() => parseAndValidate(validJson({ model: "" }), KEYS)).toThrow(/missing model/);
  });
});

describe("toAxisCScores", () => {
  it("maps a validated output to axis-C MetricScores tagged with the model", () => {
    const out = parseAndValidate(validJson(), KEYS);
    const scores = toAxisCScores(out);
    expect(scores).toHaveLength(4);
    expect(scores.every((s) => s.axis === "C" && s.model === "claude-opus-4-8")).toBe(true);
    const clarity = scores.find((s) => s.metricKey === "clarity")!;
    expect(clarity.score).toBe(80);
    expect(clarity.evidence).toBe("명확");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/scoring/src/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`packages/scoring/src/schema.ts`:
```ts
import type { MetricScore } from "@ai-benchmark/core";

export interface ScoreEntry {
  metricKey: string;
  score: number;
  evidence: string;
}

export interface ScoreOutput {
  slug: string;
  model: string;
  rubricVersion: string;
  scores: ScoreEntry[];
}

/** LLM 출력 JSON을 파싱·검증한다. 형식/범위/지표 집합 불일치 시 throw. */
export function parseAndValidate(raw: string, expectedMetricKeys: string[]): ScoreOutput {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new Error("invalid JSON");
  }
  const d = doc as Record<string, unknown>;
  if (typeof d.slug !== "string" || d.slug.length === 0) throw new Error("missing slug");
  if (typeof d.model !== "string" || d.model.length === 0) throw new Error("missing model");
  if (typeof d.rubricVersion !== "string") throw new Error("missing rubricVersion");
  if (!Array.isArray(d.scores)) throw new Error("missing scores array");

  const seen = new Set<string>();
  for (const entry of d.scores as unknown[]) {
    const e = entry as Record<string, unknown>;
    if (typeof e.metricKey !== "string") throw new Error("score entry missing metricKey");
    if (typeof e.score !== "number" || e.score < 0 || e.score > 100) {
      throw new Error(`score out of range for ${String(e.metricKey)}`);
    }
    if (typeof e.evidence !== "string") throw new Error(`missing evidence for ${String(e.metricKey)}`);
    seen.add(e.metricKey);
  }
  for (const key of expectedMetricKeys) {
    if (!seen.has(key)) throw new Error(`missing metric ${key}`);
  }
  const extra = [...seen].filter((k) => !expectedMetricKeys.includes(k));
  if (extra.length) throw new Error(`unexpected metric(s): ${extra.join(", ")}`);

  return d as unknown as ScoreOutput;
}

/** 검증된 출력을 축 C MetricScore[]로 매핑(모델 태그 부여). */
export function toAxisCScores(output: ScoreOutput): MetricScore[] {
  return output.scores.map((s) => ({
    axis: "C",
    metricKey: s.metricKey,
    model: output.model,
    score: s.score,
    evidence: s.evidence,
  }));
}
```

- [ ] **Step 4: 배럴 + 통과 확인**

`packages/scoring/src/index.ts`에 추가:
```ts
export * from "./schema.js";
```

Run: `pnpm test`
Expected: 53 + schema 8 = 61 PASS.
Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(scoring): validate LLM output schema and map to axis-C scores

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: db — 최근 scan 조회 + 모델 점수 upsert

**Files:**
- Create: `packages/db/src/model-scores.ts`
- Modify: `packages/db/src/index.ts` (model-scores 재수출)
- Test: `packages/db/src/model-scores.test.ts`

**Interfaces:**
- Consumes: `MetricScore` (core), `toMetricScoreRows` (db, 기존)
- Produces:
  - `async function getLatestScanId(client: SupabaseClient, slug: string): Promise<string | null>` — slug로 기업 → 가장 최근 scanned_at의 scan id. 없으면 null.
  - `async function importModelScores(client: SupabaseClient, slug: string, scores: MetricScore[]): Promise<{ scanId: string; count: number }>` — 최근 scan에 metric_scores upsert(onConflict: scan_id,axis,metric_key,model). scan 없으면 throw.
  - (순수 헬퍼) `function metricScoreConflictTarget(): string` — 유니크 키 문자열 `"scan_id,axis,metric_key,model"` (테스트로 스키마와 동기화 보증).

**Interfaces note:** `getLatestScanId`/`importModelScores`는 네트워크 어댑터라 단위 테스트하지 않는다(Task 6 CLI + 수동 E2E로 검증). 순수 헬퍼 `metricScoreConflictTarget`만 테스트한다.

- [ ] **Step 1: 실패 테스트 작성**

`packages/db/src/model-scores.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { metricScoreConflictTarget } from "./model-scores.js";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "../migrations/0001_init.sql"), "utf8").toLowerCase();

describe("metricScoreConflictTarget", () => {
  it("matches the metric_scores unique key in the migration", () => {
    const target = metricScoreConflictTarget();
    expect(target).toBe("scan_id,axis,metric_key,model");
    // 스키마의 unique 절과 컬럼 집합이 일치하는지 방어적으로 확인
    expect(sql).toContain("unique (scan_id, axis, metric_key, model)");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/db/src/model-scores.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`packages/db/src/model-scores.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricScore } from "@ai-benchmark/core";
import { toMetricScoreRows } from "./rows.js";

/** metric_scores upsert의 onConflict 대상 (0001_init.sql의 unique 키와 동기화). */
export function metricScoreConflictTarget(): string {
  return "scan_id,axis,metric_key,model";
}

/** slug로 기업을 찾아 가장 최근 scan id를 반환. 없으면 null. */
export async function getLatestScanId(client: SupabaseClient, slug: string): Promise<string | null> {
  const { data: comp, error: cErr } = await client
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (cErr) throw new Error(`company lookup failed: ${cErr.message}`);
  if (!comp) return null;

  const { data: scan, error: sErr } = await client
    .from("scans")
    .select("id")
    .eq("company_id", comp.id)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) throw new Error(`scan lookup failed: ${sErr.message}`);
  return scan?.id ?? null;
}

/** 최근 scan에 모델 점수(축 C 등)를 upsert. scan이 없으면 throw. */
export async function importModelScores(
  client: SupabaseClient,
  slug: string,
  scores: MetricScore[],
): Promise<{ scanId: string; count: number }> {
  const scanId = await getLatestScanId(client, slug);
  if (!scanId) throw new Error(`no scan for '${slug}' — run \`pnpm crawl\` first`);

  const rows = toMetricScoreRows(scanId, scores);
  if (rows.length) {
    const { error } = await client
      .from("metric_scores")
      .upsert(rows, { onConflict: metricScoreConflictTarget() });
    if (error) throw new Error(`model score upsert failed: ${error.message}`);
  }
  return { scanId, count: rows.length };
}
```

- [ ] **Step 4: 배럴 + 통과 확인**

`packages/db/src/index.ts`에 추가:
```ts
export * from "./model-scores.js";
```

Run: `pnpm test`
Expected: 61 + model-scores 1 = 62 PASS.
Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(db): latest-scan lookup and model score upsert

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: import 배치 CLI (엔드투엔드 조립)

**Files:**
- Create: `packages/scoring/src/cli-import.ts`
- Modify: 루트 `package.json` (import-scores 스크립트)
- Test: `packages/scoring/src/cli-import.test.ts` (순수 경로 파서만)

**Interfaces:**
- Consumes: `parseAndValidate`/`toAxisCScores` (Task 4), `loadAxisCMetrics` (Task 2), `importModelScores` (Task 5), `@supabase/supabase-js`
- Produces:
  - `function parseOutboxPath(relPath: string): { model: string; slug: string } | null` — `"<model>/<slug>.json"`에서 model·slug 추출. 형식 불일치면 null.
  - 실행 가능한 배치 진입점(`main()`): `scoring/outbox/<model>/<slug>.json`을 순회해 검증·매핑·최근 scan에 upsert. DB env 없으면 검증만 하고 skip.

- [ ] **Step 1: 실패 테스트 작성**

`packages/scoring/src/cli-import.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseOutboxPath } from "./cli-import.js";

describe("parseOutboxPath", () => {
  it("extracts model and slug from '<model>/<slug>.json'", () => {
    expect(parseOutboxPath("claude-opus-4-8/acme.json")).toEqual({
      model: "claude-opus-4-8",
      slug: "acme",
    });
  });

  it("returns null for a non-json or malformed path", () => {
    expect(parseOutboxPath("acme.json")).toBeNull();
    expect(parseOutboxPath("claude/acme.txt")).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/scoring/src/cli-import.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 (엔트리포인트 가드 필수)**

`packages/scoring/src/cli-import.ts`:
```ts
import "dotenv/config";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { importModelScores } from "@ai-benchmark/db";
import { loadAxisCMetrics } from "./rubric.js";
import { parseAndValidate, toAxisCScores } from "./schema.js";

/** "<model>/<slug>.json" → { model, slug }. 형식 불일치면 null. */
export function parseOutboxPath(relPath: string): { model: string; slug: string } | null {
  const parts = relPath.split("/");
  if (parts.length !== 2) return null;
  const [model, file] = parts;
  if (!model || !file.endsWith(".json")) return null;
  const slug = file.slice(0, -".json".length);
  if (!slug) return null;
  return { model, slug };
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const outboxDir = resolve(root, "scoring/outbox");
  const expectedKeys = loadAxisCMetrics(resolve(root, "config/weights.yaml")).map((m) => m.key);

  if (!existsSync(outboxDir)) {
    console.log("no scoring/outbox — run `pnpm prepare-scores`, score files, then retry.");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key) : null;

  let imported = 0;
  let validated = 0;
  for (const model of readdirSync(outboxDir)) {
    const modelDir = resolve(outboxDir, model);
    for (const file of readdirSync(modelDir)) {
      const rel = `${model}/${file}`;
      const parsed = parseOutboxPath(rel);
      if (!parsed) continue;
      const raw = readFileSync(resolve(modelDir, file), "utf8");
      const output = parseAndValidate(raw, expectedKeys); // 실패 시 throw로 중단
      validated += 1;
      const scores = toAxisCScores(output);
      if (client) {
        const { scanId, count } = await importModelScores(client, parsed.slug, scores);
        imported += 1;
        console.log(`[${parsed.slug}/${output.model}] upserted ${count} scores to scan ${scanId}`);
      } else {
        console.log(`[${parsed.slug}/${output.model}] validated ${scores.length} scores (DB skipped: no env)`);
      }
    }
  }
  console.log(`\n${validated} file(s) validated, ${imported} imported.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: 루트 스크립트 추가**

루트 `package.json`의 `scripts`에 추가:
```json
"import-scores": "tsx packages/scoring/src/cli-import.ts"
```

- [ ] **Step 5: import가 부작용 없는지 확인 (전체 테스트 + 타입체크)**

Run: `pnpm test packages/scoring/src/cli-import.test.ts`
Expected: 2개 PASS (모듈 import가 크롤/DB를 건드리지 않음 — main은 가드됨).

Run: `pnpm test`
Expected: 62 + cli-import 2 = 64 PASS.

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(scoring): import batch CLI wiring validate->map->upsert

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: 수동 엔드투엔드 (실행 시, 선택)**

전제: Plan 1의 `pnpm crawl`로 raw 스냅샷 + scan이 존재.
1. `pnpm prepare-scores` → `scoring/inbox/<slug>.md` 생성.
2. 각 inbox 파일을 Claude Code로 채점해 `scoring/outbox/claude-opus-4-8/<slug>.json` 저장, Codex CLI로 채점해 `scoring/outbox/gpt-<...>/<slug>.json` 저장.
3. `.env`에 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 설정 후 `pnpm import-scores` → 축 C 점수가 최근 scan에 모델별로 upsert.
Expected: 잘못된 JSON/범위/지표 누락은 명확한 에러로 중단(부분 적재 방지). 정상은 `upserted 4 scores` 로그.

---

## Self-Review 결과 (작성자 확인)

**1. 스펙 커버리지 (Plan 2 범위):**
- 스펙 §3 [3b] 모델별 LLM 채점, 동일 루브릭·동일 입력 → Task 2·3(inbox에 프롬프트·원문·스키마 고정) ✅
- §4.2 모델별 값 + 평균, 두 종류 종합점수 → Task 1(collapseForView/overallForView) ✅
- §5 metric_scores에 model로 통일 관리, upsert 재실행 안전 → Task 5 ✅
- §6.1 LLM 채점 계약(표준 입력·정해진 JSON 스키마·model 태그) → Task 3·4·6 ✅
- 레저 기록 "축 C 다모델 이중 계산 방지" → Task 1에서 collapse로 해결, 테스트로 보증 ✅

**2. Placeholder 스캔:** "TBD/TODO/적절히" 없음. 모든 코드 스텝에 완전한 코드. ✅

**3. 타입 일관성:** `ScoreOutput`(schema) → `toAxisCScores` → `MetricScore`(core) → `toMetricScoreRows`/`importModelScores`(db) 전 구간 필드명 정합. 축 C 지표 키는 config 단일 출처(loadAxisCMetrics)에서만 흐르고, 검증(parseAndValidate)·집계(weights.metrics.C)가 같은 키 집합을 공유. CLI `main()`은 엔트리포인트 가드(Plan 1 Task 10 교훈 반영). ✅

**Plan 2 범위 밖(후속):** 축 C 개선항목·대시보드(Plan 3), 실제 기업 리스트·실제 LLM 채점 실행(운영).
