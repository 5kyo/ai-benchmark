# Plan 1 — 데이터 기반 + 크롤러 + 규칙 채점 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** URL 목록을 크롤링해 규칙 기반(축 A·B·D) 점수를 산출하고 Supabase에 저장하는, 독립적으로 동작·테스트 가능한 파이프라인을 만든다.

**Architecture:** pnpm 모노레포. `packages/core`(공용 타입 + 가중치 로더 + 점수 집계), `packages/crawler`(주입 가능한 fetcher로 원문 스냅샷 수집 + 규칙 채점기), `packages/db`(Supabase 스키마 + import). 크롤링/채점 로직은 순수 함수로 분리해 HTML 픽스처로 테스트한다. 실제 네트워크·DB 호출은 얇은 어댑터로 감싼다.

**Tech Stack:** TypeScript(ESM), pnpm workspaces, vitest(테스트), cheerio(HTML 파싱), yaml(설정 로딩), @supabase/supabase-js, tsx(스크립트 실행).

## Global Constraints

- Node.js >= 20, pnpm >= 9. 모든 패키지 ESM(`"type": "module"`).
- TypeScript `^5.5`, strict 모드. 테스트는 vitest `^2`.
- 모든 점수는 0~100 범위의 number로 정규화한다.
- 축(axis) 식별자는 정확히 `'A' | 'B' | 'C' | 'D'`. 축 C(콘텐츠 품질)는 **이 계획 범위 밖**(Plan 2). 규칙 채점 점수의 `model` 값은 정확히 문자열 `'rule-based'`.
- 축 가중치는 A=0.30, B=0.25, C=0.30, D=0.15 (합 1.0). 이 값들은 `config/weights.yaml` 단일 출처에서만 읽는다. 코드에 하드코딩 금지.
- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

```
ai-benchmark/
├─ package.json                         # 워크스페이스 루트
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ vitest.config.ts
├─ .gitignore
├─ config/
│   ├─ companies.yaml                   # 대상 기업 URL·메타
│   ├─ weights.yaml                     # 축·지표 가중치 (단일 출처)
│   └─ rubric/rubric_v1.md              # LLM 루브릭 (Plan 2에서 사용, 여기선 파일만 배치)
├─ packages/
│   ├─ core/
│   │   ├─ package.json
│   │   ├─ src/types.ts                 # 공용 타입
│   │   ├─ src/weights.ts               # weights.yaml 로더
│   │   ├─ src/aggregate.ts             # 축/종합 점수 집계
│   │   └─ src/index.ts
│   ├─ crawler/
│   │   ├─ package.json
│   │   ├─ src/fetcher.ts               # Fetcher 인터페이스 + HttpFetcher
│   │   ├─ src/companies.ts             # companies.yaml 로더
│   │   ├─ src/snapshot.ts              # 원문 스냅샷 수집(주입된 fetcher 사용)
│   │   ├─ src/rules/accessibility.ts   # 축 A
│   │   ├─ src/rules/structure.ts       # 축 B
│   │   ├─ src/rules/hygiene.ts         # 축 D
│   │   ├─ src/rule-score.ts            # 세 축 결합 → MetricScore[]
│   │   └─ src/cli-crawl.ts             # 배치 진입점
│   └─ db/
│       ├─ package.json
│       ├─ migrations/0001_init.sql
│       ├─ src/rows.ts                  # MetricScore[] → DB row 매핑(순수)
│       └─ src/import.ts                # Supabase 적재(얇은 어댑터)
├─ raw/                                 # 크롤링 스냅샷 (gitignore)
└─ docs/superpowers/...
```

각 파일은 하나의 책임만 가진다. 규칙 채점기는 축별로 분리(서로 독립 테스트·리뷰 가능).

---

## Task 1: 모노레포 스캐폴드 + 테스트 러너

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/smoke.test.ts`

**Interfaces:**
- Consumes: (없음)
- Produces: 동작하는 pnpm 워크스페이스와 `pnpm test` 실행 환경.

- [ ] **Step 1: 워크스페이스 루트 파일 작성**

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`package.json`:
```json
{
  "name": "ai-benchmark",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5",
    "tsx": "^4.16.2",
    "@types/node": "^20.14.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
  },
});
```

`.gitignore`:
```
node_modules/
dist/
raw/
.env
*.tsbuildinfo
```

- [ ] **Step 2: core 패키지 초기화**

`packages/core/package.json`:
```json
{
  "name": "@ai-benchmark/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`packages/core/src/index.ts`:
```ts
export const CORE_READY = true;
```

- [ ] **Step 3: 스모크 테스트 작성 (실패 확인용)**

`packages/core/src/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CORE_READY } from "./index.js";

describe("workspace smoke", () => {
  it("core package is importable", () => {
    expect(CORE_READY).toBe(true);
  });
});
```

- [ ] **Step 4: 의존성 설치 후 테스트 실행**

Run: `pnpm install && pnpm test`
Expected: 1개 테스트 PASS (`workspace smoke > core package is importable`).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with vitest

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 공용 타입 + 가중치 로더 + 점수 집계

**Files:**
- Create: `config/weights.yaml`, `config/companies.yaml`, `config/rubric/rubric_v1.md`
- Create: `packages/core/src/types.ts`, `packages/core/src/weights.ts`, `packages/core/src/aggregate.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/package.json` (yaml 의존성 추가)
- Test: `packages/core/src/aggregate.test.ts`, `packages/core/src/weights.test.ts`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `type Axis = 'A' | 'B' | 'C' | 'D'`
  - `type ModelId = string` (규칙 점수는 `'rule-based'`)
  - `interface MetricScore { axis: Axis; metricKey: string; model: ModelId; score: number; evidence?: string; rawDetail?: Record<string, unknown> }`
  - `interface Weights { axes: Record<Axis, number>; metrics: Record<Axis, Record<string, number>> }`
  - `function loadWeights(path: string): Weights`
  - `function axisScore(scores: MetricScore[], axis: Axis, w: Weights): number | null`
  - `function overallScore(scores: MetricScore[], w: Weights): number | null`

- [ ] **Step 1: 설정 파일 작성**

`config/weights.yaml`:
```yaml
# 축 가중치 (합 1.0). Methodology 페이지의 단일 출처.
axes:
  A: 0.30   # 크롤링/접근성
  B: 0.25   # 구조화/시맨틱
  C: 0.30   # 콘텐츠 품질 (LLM, Plan 2)
  D: 0.15   # 응답성/기술위생
# 축 내부 지표 가중치 (각 축 합 1.0)
metrics:
  A:
    robots_allowed: 0.20
    sitemap_present: 0.15
    llms_txt_present: 0.15
    ssr_rendered: 0.25
    not_bot_blocked: 0.10
    pages_reachable: 0.15
  B:
    json_ld_present: 0.25
    semantic_ratio: 0.20
    meta_completeness: 0.20
    heading_hierarchy: 0.20
    alt_coverage: 0.15
  C:
    clarity: 0.30
    product_depth: 0.25
    key_info_present: 0.25
    freshness_clarity: 0.20
  D:
    load_time: 0.35
    mobile_ready: 0.25
    https_secure: 0.20
    multilingual: 0.20
```

`config/companies.yaml` (초기 예시 2개 — 실제 20~50개는 운영 시 채움):
```yaml
companies:
  - name: "우리회사 (예시)"
    slug: "our-company"
    homepage_url: "https://example.com"
    is_self: true
    category: "blockchain"
  - name: "경쟁사 A (예시)"
    slug: "competitor-a"
    homepage_url: "https://example.org"
    is_self: false
    category: "blockchain"
```

`config/rubric/rubric_v1.md`:
```markdown
# LLM 채점 루브릭 v1 (축 C — 콘텐츠 품질/완성도)

> Plan 2에서 Claude Code / Codex CLI가 이 루브릭으로 채점한다. Plan 1에서는 파일만 배치한다.

각 지표는 0~100으로 채점하고, 1~2줄 근거(evidence)를 함께 낸다.

- **clarity**: 이 회사가 무엇을 하는지 홈페이지만으로 명확한가.
- **product_depth**: 제품/서비스 설명이 충분히 구체적인가.
- **key_info_present**: 토크노믹스·백서·팀·컨택 등 핵심 정보가 있는가.
- **freshness_clarity**: 최신성 있고 모호/과장 없는 서술인가.
```

- [ ] **Step 2: yaml 의존성 추가**

`packages/core/package.json`의 최상위에 추가:
```json
"dependencies": { "yaml": "^2.5.0" }
```
Run: `pnpm install`

- [ ] **Step 3: 타입 정의 작성**

`packages/core/src/types.ts`:
```ts
export type Axis = "A" | "B" | "C" | "D";
export type ModelId = string; // 규칙 점수는 "rule-based"

export interface MetricScore {
  axis: Axis;
  metricKey: string;
  model: ModelId;
  score: number; // 0..100
  evidence?: string;
  rawDetail?: Record<string, unknown>;
}

export interface Weights {
  axes: Record<Axis, number>;
  metrics: Record<Axis, Record<string, number>>;
}
```

- [ ] **Step 4: 집계 테스트 작성 (실패 확인용)**

`packages/core/src/aggregate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { axisScore, overallScore } from "./aggregate.js";
import type { MetricScore, Weights } from "./types.js";

const w: Weights = {
  axes: { A: 0.5, B: 0.5, C: 0, D: 0 },
  metrics: {
    A: { m1: 0.5, m2: 0.5 },
    B: { m3: 1.0 },
    C: {},
    D: {},
  },
};

function s(axis: MetricScore["axis"], metricKey: string, score: number): MetricScore {
  return { axis, metricKey, model: "rule-based", score };
}

describe("axisScore", () => {
  it("weighted-averages present metrics", () => {
    const scores = [s("A", "m1", 80), s("A", "m2", 40)];
    expect(axisScore(scores, "A", w)).toBe(60);
  });

  it("renormalizes over present metrics when some are missing", () => {
    const scores = [s("A", "m1", 80)]; // m2 없음 → m1 가중치 재정규화 → 80
    expect(axisScore(scores, "A", w)).toBe(80);
  });

  it("returns null when axis has no scores", () => {
    expect(axisScore([], "A", w)).toBeNull();
  });
});

describe("overallScore", () => {
  it("weighted-averages present axes, renormalizing axis weights", () => {
    // A=60, B=90. axis weights A:0.5 B:0.5 → 75
    const scores = [s("A", "m1", 80), s("A", "m2", 40), s("B", "m3", 90)];
    expect(overallScore(scores, w)).toBe(75);
  });

  it("renormalizes when an axis is absent (e.g. C not scored yet)", () => {
    // A만 존재(=60) → 재정규화 → 60
    const scores = [s("A", "m1", 80), s("A", "m2", 40)];
    expect(overallScore(scores, w)).toBe(60);
  });
});
```

- [ ] **Step 5: 집계 로직 구현**

`packages/core/src/aggregate.ts`:
```ts
import type { Axis, MetricScore, Weights } from "./types.js";

/** 존재하는 지표만으로 가중치를 재정규화해 가중평균. 없으면 null. */
export function axisScore(scores: MetricScore[], axis: Axis, w: Weights): number | null {
  const metricWeights = w.metrics[axis] ?? {};
  const present = scores.filter((s) => s.axis === axis && metricWeights[s.metricKey] != null);
  if (present.length === 0) return null;
  const totalW = present.reduce((sum, s) => sum + metricWeights[s.metricKey], 0);
  if (totalW === 0) return null;
  const weighted = present.reduce((sum, s) => sum + s.score * metricWeights[s.metricKey], 0);
  return weighted / totalW;
}

/** 존재하는 축 점수만으로 축 가중치를 재정규화해 가중평균. 없으면 null. */
export function overallScore(scores: MetricScore[], w: Weights): number | null {
  const axes: Axis[] = ["A", "B", "C", "D"];
  const parts = axes
    .map((axis) => ({ axis, value: axisScore(scores, axis, w), weight: w.axes[axis] ?? 0 }))
    .filter((p): p is { axis: Axis; value: number; weight: number } => p.value != null && p.weight > 0);
  if (parts.length === 0) return null;
  const totalW = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalW === 0) return null;
  const weighted = parts.reduce((sum, p) => sum + p.value * p.weight, 0);
  return weighted / totalW;
}
```

- [ ] **Step 6: 가중치 로더 테스트 작성 (실패 확인용)**

`packages/core/src/weights.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadWeights } from "./weights.js";

const here = dirname(fileURLToPath(import.meta.url));
const weightsPath = resolve(here, "../../../config/weights.yaml");

describe("loadWeights", () => {
  it("loads axis weights that sum to 1.0", () => {
    const w = loadWeights(weightsPath);
    const sum = w.axes.A + w.axes.B + w.axes.C + w.axes.D;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("loads axis A metric weights that sum to 1.0", () => {
    const w = loadWeights(weightsPath);
    const sum = Object.values(w.metrics.A).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
```

- [ ] **Step 7: 가중치 로더 구현**

`packages/core/src/weights.ts`:
```ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { Weights } from "./types.js";

export function loadWeights(path: string): Weights {
  const raw = parse(readFileSync(path, "utf8")) as Weights;
  if (!raw?.axes || !raw?.metrics) {
    throw new Error(`Invalid weights file: ${path}`);
  }
  return raw;
}
```

- [ ] **Step 8: index.ts에서 재수출**

`packages/core/src/index.ts` 전체 교체:
```ts
export const CORE_READY = true;
export * from "./types.js";
export * from "./weights.js";
export * from "./aggregate.js";
```

- [ ] **Step 9: 테스트 실행**

Run: `pnpm test`
Expected: Task 1·2의 모든 테스트 PASS (smoke 1 + aggregate 5 + weights 2).

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat(core): types, weights loader, score aggregation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Supabase 스키마 마이그레이션

**Files:**
- Create: `packages/db/package.json`, `packages/db/migrations/0001_init.sql`
- Test: `packages/db/migrations/0001_init.test.ts`

**Interfaces:**
- Consumes: (없음 — SQL 스키마)
- Produces: `companies`, `scans`, `metric_scores`, `improvements` 테이블 정의. 컬럼명은 §5 데이터 모델과 일치.

- [ ] **Step 1: db 패키지 초기화**

`packages/db/package.json`:
```json
{
  "name": "@ai-benchmark/db",
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@ai-benchmark/core": "workspace:*",
    "@supabase/supabase-js": "^2.45.4"
  }
}
```
Run: `pnpm install`

- [ ] **Step 2: 마이그레이션 SQL 작성**

`packages/db/migrations/0001_init.sql`:
```sql
-- 분석 대상 기업
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  homepage_url text not null,
  is_self boolean not null default false,
  category text,
  created_at timestamptz not null default now()
);

-- 한 번의 배치 실행(스냅샷)
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  rubric_version text not null,
  raw_snapshot_path text,
  status text not null default 'completed'
);

-- 지표별 점수 (규칙·모델 통합)
create table if not exists metric_scores (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  axis text not null check (axis in ('A','B','C','D')),
  metric_key text not null,
  model text not null,               -- 'rule-based' | 'claude-*' | 'gpt-*'
  score numeric not null check (score >= 0 and score <= 100),
  evidence text,
  raw_detail jsonb,
  unique (scan_id, axis, metric_key, model)
);

-- 자동 생성된 개선 항목
create table if not exists improvements (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  axis text not null check (axis in ('A','B','C','D')),
  metric_key text not null,
  severity int not null,
  message text not null,
  suggestion text
);

create index if not exists idx_scans_company on scans(company_id);
create index if not exists idx_metric_scores_scan on metric_scores(scan_id);
create index if not exists idx_improvements_scan on improvements(scan_id);
```

- [ ] **Step 3: 스키마 정합성 테스트 작성 (실패 확인용)**

이 테스트는 SQL 텍스트가 데이터 모델의 필수 컬럼·제약을 담고 있는지 정적 검증한다(DB 연결 불필요).

`packages/db/migrations/0001_init.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "0001_init.sql"), "utf8").toLowerCase();

describe("0001_init schema", () => {
  it("defines all four core tables", () => {
    for (const t of ["companies", "scans", "metric_scores", "improvements"]) {
      expect(sql).toContain(`create table if not exists ${t}`);
    }
  });

  it("constrains axis to A/B/C/D", () => {
    expect(sql).toContain("axis in ('a','b','c','d')");
  });

  it("constrains score to 0..100", () => {
    expect(sql).toContain("score >= 0 and score <= 100");
  });

  it("uniquely keys a metric score by scan/axis/metric/model", () => {
    expect(sql).toContain("unique (scan_id, axis, metric_key, model)");
  });
});
```

- [ ] **Step 4: 테스트 실행**

Run: `pnpm test`
Expected: 스키마 테스트 4개 PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(db): initial Supabase schema for companies/scans/scores

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **적용 안내(수동, 실행 시):** Supabase 프로젝트에 이 SQL을 적용한다 — Supabase MCP `apply_migration`(name: `0001_init`, query: 파일 내용) 또는 `supabase db push`. 적용은 실행 단계에서 수행하며 자동 테스트 범위 밖이다.

---

## Task 4: Fetcher 추상화 + 원문 스냅샷 수집

**Files:**
- Create: `packages/crawler/package.json`, `packages/crawler/tsconfig.json`
- Create: `packages/crawler/src/fetcher.ts`, `packages/crawler/src/companies.ts`, `packages/crawler/src/snapshot.ts`
- Test: `packages/crawler/src/snapshot.test.ts`, `packages/crawler/src/companies.test.ts`

**Interfaces:**
- Consumes: `config/companies.yaml`
- Produces:
  - `interface FetchResult { url: string; status: number; headers: Record<string,string>; body: string; elapsedMs: number }`
  - `interface Fetcher { fetch(url: string): Promise<FetchResult> }`
  - `interface CompanyConfig { name: string; slug: string; homepageUrl: string; isSelf: boolean; category?: string }`
  - `function loadCompanies(path: string): CompanyConfig[]`
  - `interface RawSnapshot { company: CompanyConfig; scannedAt: string; homepage: FetchResult; robots: FetchResult | null; sitemap: FetchResult | null; llmsTxt: FetchResult | null }`
  - `function collectSnapshot(company: CompanyConfig, fetcher: Fetcher, now: () => string): Promise<RawSnapshot>`

- [ ] **Step 1: crawler 패키지 초기화**

`packages/crawler/package.json`:
```json
{
  "name": "@ai-benchmark/crawler",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@ai-benchmark/core": "workspace:*",
    "cheerio": "^1.0.0",
    "yaml": "^2.5.0"
  }
}
```

`packages/crawler/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```
Run: `pnpm install`

- [ ] **Step 2: Fetcher 인터페이스 + HttpFetcher 구현**

`packages/crawler/src/fetcher.ts`:
```ts
export interface FetchResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
}

export interface Fetcher {
  fetch(url: string): Promise<FetchResult>;
}

/** 실제 네트워크 fetcher. 테스트에서는 사용하지 않는다(주입으로 대체). */
export class HttpFetcher implements Fetcher {
  constructor(private readonly timeoutMs = 15000) {}

  async fetch(url: string): Promise<FetchResult> {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await globalThis.fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": "ai-benchmark-crawler/1.0" },
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      return { url, status: res.status, headers, body, elapsedMs: performance.now() - start };
    } catch {
      return { url, status: 0, headers: {}, body: "", elapsedMs: performance.now() - start };
    } finally {
      clearTimeout(timer);
    }
  }
}
```

- [ ] **Step 3: companies 로더 테스트 작성 (실패 확인용)**

`packages/crawler/src/companies.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCompanies } from "./companies.js";

const here = dirname(fileURLToPath(import.meta.url));
const path = resolve(here, "../../../config/companies.yaml");

describe("loadCompanies", () => {
  it("parses companies with camelCase fields", () => {
    const list = loadCompanies(path);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]).toHaveProperty("homepageUrl");
    expect(list[0]).toHaveProperty("isSelf");
  });

  it("marks exactly the self company", () => {
    const list = loadCompanies(path);
    expect(list.some((c) => c.isSelf)).toBe(true);
  });
});
```

- [ ] **Step 4: companies 로더 구현**

`packages/crawler/src/companies.ts`:
```ts
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export interface CompanyConfig {
  name: string;
  slug: string;
  homepageUrl: string;
  isSelf: boolean;
  category?: string;
}

interface RawCompany {
  name: string;
  slug: string;
  homepage_url: string;
  is_self?: boolean;
  category?: string;
}

export function loadCompanies(path: string): CompanyConfig[] {
  const doc = parse(readFileSync(path, "utf8")) as { companies?: RawCompany[] };
  const rows = doc.companies ?? [];
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    homepageUrl: r.homepage_url,
    isSelf: r.is_self ?? false,
    category: r.category,
  }));
}
```

- [ ] **Step 5: 스냅샷 수집 테스트 작성 (실패 확인용)**

`packages/crawler/src/snapshot.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { collectSnapshot } from "./snapshot.js";
import type { CompanyConfig } from "./companies.js";
import type { Fetcher, FetchResult } from "./fetcher.js";

const company: CompanyConfig = {
  name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false,
};

function ok(url: string, body = "ok"): FetchResult {
  return { url, status: 200, headers: {}, body, elapsedMs: 10 };
}

class FakeFetcher implements Fetcher {
  constructor(private map: Record<string, FetchResult>) {}
  async fetch(url: string): Promise<FetchResult> {
    return this.map[url] ?? { url, status: 404, headers: {}, body: "", elapsedMs: 5 };
  }
}

const now = () => "2026-07-08T00:00:00.000Z";

describe("collectSnapshot", () => {
  it("fetches homepage + robots + sitemap + llms.txt at derived URLs", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
      "https://t.example/robots.txt": ok("https://t.example/robots.txt", "User-agent: *"),
      "https://t.example/sitemap.xml": ok("https://t.example/sitemap.xml", "<urlset/>"),
      "https://t.example/llms.txt": ok("https://t.example/llms.txt", "# llms"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.homepage.body).toContain("home");
    expect(snap.robots?.status).toBe(200);
    expect(snap.sitemap?.status).toBe(200);
    expect(snap.llmsTxt?.status).toBe(200);
    expect(snap.scannedAt).toBe("2026-07-08T00:00:00.000Z");
  });

  it("sets aux resources to a result object even when missing (status 404)", async () => {
    const f = new FakeFetcher({
      "https://t.example": ok("https://t.example", "<html>home</html>"),
    });
    const snap = await collectSnapshot(company, f, now);
    expect(snap.robots?.status).toBe(404);
    expect(snap.llmsTxt?.status).toBe(404);
  });
});
```

- [ ] **Step 6: 스냅샷 수집 구현**

`packages/crawler/src/snapshot.ts`:
```ts
import type { CompanyConfig } from "./companies.js";
import type { Fetcher, FetchResult } from "./fetcher.js";

export interface RawSnapshot {
  company: CompanyConfig;
  scannedAt: string;
  homepage: FetchResult;
  robots: FetchResult | null;
  sitemap: FetchResult | null;
  llmsTxt: FetchResult | null;
}

function auxUrl(homepageUrl: string, path: string): string {
  return new URL(path, homepageUrl).toString();
}

export async function collectSnapshot(
  company: CompanyConfig,
  fetcher: Fetcher,
  now: () => string,
): Promise<RawSnapshot> {
  const [homepage, robots, sitemap, llmsTxt] = await Promise.all([
    fetcher.fetch(company.homepageUrl),
    fetcher.fetch(auxUrl(company.homepageUrl, "/robots.txt")),
    fetcher.fetch(auxUrl(company.homepageUrl, "/sitemap.xml")),
    fetcher.fetch(auxUrl(company.homepageUrl, "/llms.txt")),
  ]);
  return { company, scannedAt: now(), homepage, robots, sitemap, llmsTxt };
}
```

- [ ] **Step 7: 테스트 실행**

Run: `pnpm test`
Expected: companies 2개 + snapshot 2개 PASS.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat(crawler): injectable fetcher, company loader, snapshot collection

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 규칙 채점 — 축 A (크롤링/접근성)

**Files:**
- Create: `packages/crawler/src/rules/accessibility.ts`
- Test: `packages/crawler/src/rules/accessibility.test.ts`

**Interfaces:**
- Consumes: `RawSnapshot` (Task 4), `MetricScore` (Task 2)
- Produces: `function scoreAccessibility(snap: RawSnapshot): MetricScore[]` — metricKey: `robots_allowed`, `sitemap_present`, `llms_txt_present`, `ssr_rendered`, `not_bot_blocked`, `pages_reachable`. 모두 `axis:'A'`, `model:'rule-based'`.
- Produces (헬퍼, 다른 축에서도 재사용): `function isServerRendered(html: string): boolean`

- [ ] **Step 1: 테스트 작성 (실패 확인용)**

`packages/crawler/src/rules/accessibility.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreAccessibility, isServerRendered } from "./accessibility.js";
import type { RawSnapshot } from "../snapshot.js";
import type { FetchResult } from "../fetcher.js";

function fr(status: number, body = "", url = "https://t.example"): FetchResult {
  return { url, status, headers: {}, body, elapsedMs: 10 };
}

function snap(over: Partial<RawSnapshot>): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: fr(200, "<html><body><h1>Hi</h1><p>content here</p></body></html>"),
    robots: fr(200, "User-agent: *\nAllow: /"),
    sitemap: fr(200, "<urlset/>"),
    llmsTxt: fr(200, "# llms"),
    ...over,
  };
}

function get(scores: ReturnType<typeof scoreAccessibility>, key: string) {
  const m = scores.find((s) => s.metricKey === key);
  if (!m) throw new Error(`missing metric ${key}`);
  return m.score;
}

describe("isServerRendered", () => {
  it("true when body has substantial text", () => {
    expect(isServerRendered("<body><p>" + "word ".repeat(80) + "</p></body>")).toBe(true);
  });
  it("false for empty SPA shell", () => {
    expect(isServerRendered('<body><div id="__next"></div><script src="app.js"></script></body>')).toBe(false);
  });
});

describe("scoreAccessibility", () => {
  it("gives full marks for a well-configured site", () => {
    const scores = scoreAccessibility(snap({}));
    expect(get(scores, "sitemap_present")).toBe(100);
    expect(get(scores, "llms_txt_present")).toBe(100);
    expect(get(scores, "not_bot_blocked")).toBe(100);
    expect(get(scores, "pages_reachable")).toBe(100);
    expect(get(scores, "robots_allowed")).toBe(100);
  });

  it("scores 0 for missing sitemap/llms and a 403 homepage", () => {
    const scores = scoreAccessibility(
      snap({ sitemap: fr(404), llmsTxt: fr(404), homepage: fr(403, "") }),
    );
    expect(get(scores, "sitemap_present")).toBe(0);
    expect(get(scores, "llms_txt_present")).toBe(0);
    expect(get(scores, "not_bot_blocked")).toBe(0);
    expect(get(scores, "pages_reachable")).toBe(0);
  });

  it("robots_allowed is 0 when root is disallowed for all agents", () => {
    const scores = scoreAccessibility(snap({ robots: fr(200, "User-agent: *\nDisallow: /") }));
    expect(get(scores, "robots_allowed")).toBe(0);
  });

  it("emits exactly six axis-A rule-based metrics", () => {
    const scores = scoreAccessibility(snap({}));
    expect(scores).toHaveLength(6);
    expect(scores.every((s) => s.axis === "A" && s.model === "rule-based")).toBe(true);
  });
});
```

- [ ] **Step 2: 구현**

`packages/crawler/src/rules/accessibility.ts`:
```ts
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

/** SPA 셸 여부 휴리스틱: 본문 텍스트가 충분하면 SSR로 간주. */
export function isServerRendered(html: string): boolean {
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return bodyText.length >= 200;
}

/** robots.txt에서 모든 에이전트에 대해 루트(/)가 Disallow 되는지. */
function rootDisallowedForAll(robotsBody: string): boolean {
  const lines = robotsBody.split(/\r?\n/).map((l) => l.trim().toLowerCase());
  let inStar = false;
  for (const line of lines) {
    if (line.startsWith("user-agent:")) inStar = line.includes("*");
    else if (inStar && line === "disallow: /") return true;
  }
  return false;
}

function m(metricKey: string, score: number, evidence?: string): MetricScore {
  return { axis: "A", metricKey, model: "rule-based", score, evidence };
}

export function scoreAccessibility(snap: RawSnapshot): MetricScore[] {
  const robotsOk = snap.robots?.status === 200 ? snap.robots.body : "";
  const robotsAllowed = rootDisallowedForAll(robotsOk) ? 0 : 100;
  const sitemap = snap.sitemap?.status === 200 ? 100 : 0;
  const llms = snap.llmsTxt?.status === 200 ? 100 : 0;
  const ssr = isServerRendered(snap.homepage.body) ? 100 : 0;
  const notBlocked = snap.homepage.status === 403 ? 0 : snap.homepage.status === 200 ? 100 : 50;
  const reachable = snap.homepage.status === 200 ? 100 : 0;

  return [
    m("robots_allowed", robotsAllowed),
    m("sitemap_present", sitemap),
    m("llms_txt_present", llms),
    m("ssr_rendered", ssr),
    m("not_bot_blocked", notBlocked),
    m("pages_reachable", reachable),
  ];
}
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm test packages/crawler/src/rules/accessibility.test.ts`
Expected: 6개 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(crawler): axis A accessibility rule scorer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 규칙 채점 — 축 B (구조화/시맨틱)

**Files:**
- Create: `packages/crawler/src/rules/structure.ts`
- Test: `packages/crawler/src/rules/structure.test.ts`

**Interfaces:**
- Consumes: `RawSnapshot`, `MetricScore`, cheerio
- Produces: `function scoreStructure(snap: RawSnapshot): MetricScore[]` — metricKey: `json_ld_present`, `semantic_ratio`, `meta_completeness`, `heading_hierarchy`, `alt_coverage`. 모두 `axis:'B'`, `model:'rule-based'`.

- [ ] **Step 1: 테스트 작성 (실패 확인용)**

`packages/crawler/src/rules/structure.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreStructure } from "./structure.js";
import type { RawSnapshot } from "../snapshot.js";
import type { FetchResult } from "../fetcher.js";

function homepage(body: string): FetchResult {
  return { url: "https://t.example", status: 200, headers: {}, body, elapsedMs: 10 };
}
function snap(body: string): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: homepage(body),
    robots: null, sitemap: null, llmsTxt: null,
  };
}
function get(scores: ReturnType<typeof scoreStructure>, key: string) {
  const s = scores.find((x) => x.metricKey === key);
  if (!s) throw new Error(`missing ${key}`);
  return s.score;
}

const RICH = `<html lang="ko"><head>
  <title>Acme</title>
  <meta name="description" content="d">
  <meta property="og:title" content="Acme">
  <meta property="og:description" content="d">
  <script type="application/ld+json">{"@type":"Organization"}</script>
</head><body>
  <header></header><nav></nav>
  <main><article><section>
    <h1>Acme</h1><h2>Product</h2>
    <img src="a.png" alt="a"><img src="b.png" alt="b">
  </section></article></main>
  <footer></footer>
</body></html>`;

describe("scoreStructure", () => {
  it("gives full json_ld and meta marks for a rich page", () => {
    const s = scoreStructure(snap(RICH));
    expect(get(s, "json_ld_present")).toBe(100);
    expect(get(s, "meta_completeness")).toBe(100);
    expect(get(s, "alt_coverage")).toBe(100);
    expect(get(s, "heading_hierarchy")).toBe(100);
  });

  it("json_ld_present is 0 when absent", () => {
    const s = scoreStructure(snap("<html><head><title>x</title></head><body><p>hi</p></body></html>"));
    expect(get(s, "json_ld_present")).toBe(0);
  });

  it("alt_coverage reflects fraction of images with alt", () => {
    const body = `<body><img src="a" alt="a"><img src="b"></body>`;
    const s = scoreStructure(snap(body));
    expect(get(s, "alt_coverage")).toBe(50);
  });

  it("alt_coverage is 100 when there are no images", () => {
    const s = scoreStructure(snap("<body><p>no images</p></body>"));
    expect(get(s, "alt_coverage")).toBe(100);
  });

  it("heading_hierarchy penalizes missing or multiple h1", () => {
    const s = scoreStructure(snap("<body><h2>no h1</h2><h3>x</h3></body>"));
    expect(get(s, "heading_hierarchy")).toBeLessThan(100);
  });

  it("emits exactly five axis-B rule-based metrics", () => {
    const s = scoreStructure(snap(RICH));
    expect(s).toHaveLength(5);
    expect(s.every((x) => x.axis === "B" && x.model === "rule-based")).toBe(true);
  });
});
```

- [ ] **Step 2: 구현**

`packages/crawler/src/rules/structure.ts`:
```ts
import * as cheerio from "cheerio";
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

const SEMANTIC_TAGS = ["header", "nav", "main", "article", "section", "footer"];

function m(metricKey: string, score: number, evidence?: string): MetricScore {
  return { axis: "B", metricKey, model: "rule-based", score, evidence };
}

function jsonLdScore($: cheerio.CheerioAPI): number {
  let valid = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      JSON.parse($(el).text());
      valid += 1;
    } catch {
      /* invalid JSON-LD ignored */
    }
  });
  return valid >= 1 ? 100 : 0;
}

function semanticRatioScore($: cheerio.CheerioAPI): number {
  const present = SEMANTIC_TAGS.filter((t) => $(t).length > 0).length;
  return Math.round((present / SEMANTIC_TAGS.length) * 100);
}

function metaCompletenessScore($: cheerio.CheerioAPI): number {
  const checks = [
    $("title").text().trim().length > 0,
    $('meta[name="description"]').attr("content")?.trim(),
    $('meta[property="og:title"]').attr("content")?.trim(),
    $('meta[property="og:description"]').attr("content")?.trim(),
  ].map(Boolean);
  const present = checks.filter(Boolean).length;
  return Math.round((present / checks.length) * 100);
}

function headingHierarchyScore($: cheerio.CheerioAPI): number {
  const h1 = $("h1").length;
  let score = 100;
  if (h1 !== 1) score -= 50; // 정확히 하나의 h1이 아니면 감점
  // 레벨 건너뜀 검사 (h1 없이 h2로 시작 등)
  const levels: number[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => levels.push(Number(el.tagName[1])));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      score -= 25;
      break;
    }
  }
  return Math.max(0, score);
}

function altCoverageScore($: cheerio.CheerioAPI): number {
  const imgs = $("img");
  if (imgs.length === 0) return 100;
  let withAlt = 0;
  imgs.each((_, el) => {
    if (($(el).attr("alt") ?? "").trim().length > 0) withAlt += 1;
  });
  return Math.round((withAlt / imgs.length) * 100);
}

export function scoreStructure(snap: RawSnapshot): MetricScore[] {
  const $ = cheerio.load(snap.homepage.body);
  return [
    m("json_ld_present", jsonLdScore($)),
    m("semantic_ratio", semanticRatioScore($)),
    m("meta_completeness", metaCompletenessScore($)),
    m("heading_hierarchy", headingHierarchyScore($)),
    m("alt_coverage", altCoverageScore($)),
  ];
}
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm test packages/crawler/src/rules/structure.test.ts`
Expected: 6개 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(crawler): axis B structure/semantic rule scorer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 규칙 채점 — 축 D (응답성/기술위생)

**Files:**
- Create: `packages/crawler/src/rules/hygiene.ts`
- Test: `packages/crawler/src/rules/hygiene.test.ts`

**Interfaces:**
- Consumes: `RawSnapshot`, `MetricScore`, cheerio
- Produces: `function scoreHygiene(snap: RawSnapshot): MetricScore[]` — metricKey: `load_time`, `mobile_ready`, `https_secure`, `multilingual`. 모두 `axis:'D'`, `model:'rule-based'`.

- [ ] **Step 1: 테스트 작성 (실패 확인용)**

`packages/crawler/src/rules/hygiene.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreHygiene } from "./hygiene.js";
import type { RawSnapshot } from "../snapshot.js";
import type { FetchResult } from "../fetcher.js";

function homepage(over: Partial<FetchResult>): FetchResult {
  return { url: "https://t.example", status: 200, headers: {}, body: "", elapsedMs: 300, ...over };
}
function snap(over: Partial<FetchResult>, url = "https://t.example"): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: url, isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: { ...homepage(over), url },
    robots: null, sitemap: null, llmsTxt: null,
  };
}
function get(scores: ReturnType<typeof scoreHygiene>, key: string) {
  const s = scores.find((x) => x.metricKey === key);
  if (!s) throw new Error(`missing ${key}`);
  return s.score;
}

describe("scoreHygiene", () => {
  it("fast load (<=500ms) scores 100, slow (>=3000ms) scores 0", () => {
    expect(get(scoreHygiene(snap({ elapsedMs: 400 })), "load_time")).toBe(100);
    expect(get(scoreHygiene(snap({ elapsedMs: 3500 })), "load_time")).toBe(0);
  });

  it("mobile_ready requires a viewport meta tag", () => {
    const withVp = `<head><meta name="viewport" content="width=device-width"></head>`;
    const noVp = `<head></head>`;
    expect(get(scoreHygiene(snap({ body: withVp })), "mobile_ready")).toBe(100);
    expect(get(scoreHygiene(snap({ body: noVp })), "mobile_ready")).toBe(0);
  });

  it("https_secure is 100 for https, 0 for http", () => {
    expect(get(scoreHygiene(snap({}, "https://t.example")), "https_secure")).toBe(100);
    expect(get(scoreHygiene(snap({}, "http://t.example")), "https_secure")).toBe(0);
  });

  it("multilingual is 100 when hreflang alternates exist", () => {
    const body = `<head><link rel="alternate" hreflang="en" href="/en"></head>`;
    expect(get(scoreHygiene(snap({ body })), "multilingual")).toBe(100);
    expect(get(scoreHygiene(snap({ body: "<head></head>" })), "multilingual")).toBe(0);
  });

  it("emits exactly four axis-D rule-based metrics", () => {
    const s = scoreHygiene(snap({}));
    expect(s).toHaveLength(4);
    expect(s.every((x) => x.axis === "D" && x.model === "rule-based")).toBe(true);
  });
});
```

- [ ] **Step 2: 구현**

`packages/crawler/src/rules/hygiene.ts`:
```ts
import * as cheerio from "cheerio";
import type { MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "../snapshot.js";

function m(metricKey: string, score: number, evidence?: string): MetricScore {
  return { axis: "D", metricKey, model: "rule-based", score, evidence };
}

/** 500ms 이하 100점, 3000ms 이상 0점, 사이는 선형 보간. */
function loadTimeScore(elapsedMs: number): number {
  const fast = 500;
  const slow = 3000;
  if (elapsedMs <= fast) return 100;
  if (elapsedMs >= slow) return 0;
  return Math.round(100 * (1 - (elapsedMs - fast) / (slow - fast)));
}

export function scoreHygiene(snap: RawSnapshot): MetricScore[] {
  const $ = cheerio.load(snap.homepage.body);
  const load = loadTimeScore(snap.homepage.elapsedMs);
  const mobile = $('meta[name="viewport"]').length > 0 ? 100 : 0;
  const https = snap.company.homepageUrl.startsWith("https://") ? 100 : 0;
  const multilingual = $("link[rel='alternate'][hreflang]").length > 0 ? 100 : 0;

  return [
    m("load_time", load),
    m("mobile_ready", mobile),
    m("https_secure", https),
    m("multilingual", multilingual),
  ];
}
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm test packages/crawler/src/rules/hygiene.test.ts`
Expected: 5개 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(crawler): axis D hygiene rule scorer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 규칙 채점 결합 + 개선항목 생성

**Files:**
- Create: `packages/crawler/src/rule-score.ts`, `packages/crawler/src/index.ts`
- Test: `packages/crawler/src/rule-score.test.ts`

**Interfaces:**
- Consumes: `scoreAccessibility` (Task 5), `scoreStructure` (Task 6), `scoreHygiene` (Task 7), `RawSnapshot`
- Produces:
  - `function scoreRules(snap: RawSnapshot): MetricScore[]` — 세 축 결합(15개 지표).
  - `interface Improvement { axis: Axis; metricKey: string; severity: number; message: string; suggestion: string }`
  - `function deriveImprovements(scores: MetricScore[]): Improvement[]` — 100점 미만 지표만, severity = round(100 - score).

- [ ] **Step 1: 테스트 작성 (실패 확인용)**

`packages/crawler/src/rule-score.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreRules, deriveImprovements } from "./rule-score.js";
import type { RawSnapshot } from "./snapshot.js";
import type { FetchResult } from "./fetcher.js";

function fr(status: number, body = "", url = "https://t.example", elapsedMs = 300): FetchResult {
  return { url, status, headers: {}, body, elapsedMs };
}
const goodBody = `<html lang="ko"><head><title>Acme</title>
  <meta name="description" content="d"><meta property="og:title" content="a">
  <meta property="og:description" content="d"><meta name="viewport" content="width=device-width">
  <script type="application/ld+json">{"@type":"Organization"}</script>
  <link rel="alternate" hreflang="en" href="/en"></head>
  <body><header></header><nav></nav><main><article><section>
  <h1>Acme</h1><h2>P</h2><img src="a" alt="a"></section></article></main><footer></footer>
  <p>${"content ".repeat(60)}</p></body></html>`;

function snap(over: Partial<RawSnapshot> = {}): RawSnapshot {
  return {
    company: { name: "T", slug: "t", homepageUrl: "https://t.example", isSelf: false },
    scannedAt: "2026-07-08T00:00:00.000Z",
    homepage: fr(200, goodBody),
    robots: fr(200, "User-agent: *\nAllow: /"),
    sitemap: fr(200, "<urlset/>"),
    llmsTxt: fr(200, "# llms"),
    ...over,
  };
}

describe("scoreRules", () => {
  it("combines all three rule axes into 15 metrics", () => {
    const scores = scoreRules(snap());
    expect(scores).toHaveLength(15);
    expect(new Set(scores.map((s) => s.axis))).toEqual(new Set(["A", "B", "D"]));
    expect(scores.every((s) => s.model === "rule-based")).toBe(true);
  });
});

describe("deriveImprovements", () => {
  it("creates one improvement per sub-100 metric with severity = 100 - score", () => {
    const withGaps = scoreRules(snap({ sitemap: fr(404), llmsTxt: fr(404) }));
    const imps = deriveImprovements(withGaps);
    const sitemap = imps.find((i) => i.metricKey === "sitemap_present");
    expect(sitemap).toBeDefined();
    expect(sitemap!.severity).toBe(100);
    expect(imps.every((i) => i.severity > 0)).toBe(true);
  });

  it("produces no improvements for a perfect page", () => {
    const perfect = scoreRules(snap({ homepage: fr(200, goodBody, "https://t.example", 200) }));
    const imps = deriveImprovements(perfect);
    expect(imps).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 구현**

`packages/crawler/src/rule-score.ts`:
```ts
import type { Axis, MetricScore } from "@ai-benchmark/core";
import type { RawSnapshot } from "./snapshot.js";
import { scoreAccessibility } from "./rules/accessibility.js";
import { scoreStructure } from "./rules/structure.js";
import { scoreHygiene } from "./rules/hygiene.js";

export function scoreRules(snap: RawSnapshot): MetricScore[] {
  return [...scoreAccessibility(snap), ...scoreStructure(snap), ...scoreHygiene(snap)];
}

export interface Improvement {
  axis: Axis;
  metricKey: string;
  severity: number;
  message: string;
  suggestion: string;
}

const SUGGESTIONS: Record<string, string> = {
  robots_allowed: "robots.txt에서 크롤러 접근을 허용하세요.",
  sitemap_present: "sitemap.xml을 추가해 주요 페이지를 노출하세요.",
  llms_txt_present: "llms.txt를 추가해 AI 에이전트용 안내를 제공하세요.",
  ssr_rendered: "핵심 콘텐츠를 서버 렌더링(SSR)하거나 정적으로 제공하세요.",
  not_bot_blocked: "봇 차단(403)을 완화해 정상 크롤러 접근을 허용하세요.",
  pages_reachable: "홈페이지가 200으로 응답하도록 가용성을 확보하세요.",
  json_ld_present: "Schema.org JSON-LD 구조화 데이터를 추가하세요.",
  semantic_ratio: "header/nav/main/article/section/footer 시맨틱 태그를 사용하세요.",
  meta_completeness: "title·description·og 태그를 채우세요.",
  heading_hierarchy: "정확히 하나의 h1과 순차적 heading 계층을 유지하세요.",
  alt_coverage: "이미지에 의미 있는 alt 텍스트를 추가하세요.",
  load_time: "페이지 로드 시간을 줄이세요.",
  mobile_ready: "viewport 메타 태그로 모바일 대응을 하세요.",
  https_secure: "HTTPS로 서비스하세요.",
  multilingual: "hreflang로 다국어(한/영) 대응을 명시하세요.",
};

export function deriveImprovements(scores: MetricScore[]): Improvement[] {
  return scores
    .filter((s) => s.score < 100)
    .map((s) => ({
      axis: s.axis,
      metricKey: s.metricKey,
      severity: Math.round(100 - s.score),
      message: `${s.metricKey} 점수 ${Math.round(s.score)} (감점)`,
      suggestion: SUGGESTIONS[s.metricKey] ?? "개선이 필요합니다.",
    }))
    .sort((a, b) => b.severity - a.severity);
}
```

`packages/crawler/src/index.ts`:
```ts
export * from "./fetcher.js";
export * from "./companies.js";
export * from "./snapshot.js";
export * from "./rule-score.js";
```

- [ ] **Step 3: 테스트 실행**

Run: `pnpm test`
Expected: Task 1~8 전체 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(crawler): combine rule axes and derive improvements

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: DB row 매핑 + import 어댑터

**Files:**
- Create: `packages/db/src/rows.ts`, `packages/db/src/import.ts`
- Test: `packages/db/src/rows.test.ts`

**Interfaces:**
- Consumes: `MetricScore` (Task 2), `Improvement` (Task 8)
- Produces:
  - `interface MetricScoreRow { scan_id: string; axis: string; metric_key: string; model: string; score: number; evidence: string | null; raw_detail: unknown }`
  - `interface ImprovementRow { scan_id: string; axis: string; metric_key: string; severity: number; message: string; suggestion: string }`
  - `function toMetricScoreRows(scanId: string, scores: MetricScore[]): MetricScoreRow[]`
  - `function toImprovementRows(scanId: string, imps: Improvement[]): ImprovementRow[]`
  - `async function importScan(client, company, snapshot, scores, imps, rubricVersion): Promise<{ scanId: string }>` (Supabase 어댑터, 얇음)

- [ ] **Step 1: row 매핑 테스트 작성 (실패 확인용)**

`packages/db/src/rows.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toMetricScoreRows, toImprovementRows } from "./rows.js";
import type { MetricScore } from "@ai-benchmark/core";

describe("toMetricScoreRows", () => {
  it("maps camelCase MetricScore to snake_case DB rows", () => {
    const scores: MetricScore[] = [
      { axis: "A", metricKey: "sitemap_present", model: "rule-based", score: 100, evidence: "found" },
      { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 0 },
    ];
    const rows = toMetricScoreRows("scan-1", scores);
    expect(rows[0]).toEqual({
      scan_id: "scan-1", axis: "A", metric_key: "sitemap_present",
      model: "rule-based", score: 100, evidence: "found", raw_detail: null,
    });
    expect(rows[1].evidence).toBeNull();
  });
});

describe("toImprovementRows", () => {
  it("maps improvements to DB rows", () => {
    const rows = toImprovementRows("scan-1", [
      { axis: "A", metricKey: "llms_txt_present", severity: 100, message: "m", suggestion: "s" },
    ]);
    expect(rows[0]).toEqual({
      scan_id: "scan-1", axis: "A", metric_key: "llms_txt_present",
      severity: 100, message: "m", suggestion: "s",
    });
  });
});
```

- [ ] **Step 2: row 매핑 구현**

`packages/db/src/rows.ts`:
```ts
import type { MetricScore } from "@ai-benchmark/core";

export interface MetricScoreRow {
  scan_id: string;
  axis: string;
  metric_key: string;
  model: string;
  score: number;
  evidence: string | null;
  raw_detail: unknown;
}

export interface ImprovementRow {
  scan_id: string;
  axis: string;
  metric_key: string;
  severity: number;
  message: string;
  suggestion: string;
}

export interface ImprovementLike {
  axis: string;
  metricKey: string;
  severity: number;
  message: string;
  suggestion: string;
}

export function toMetricScoreRows(scanId: string, scores: MetricScore[]): MetricScoreRow[] {
  return scores.map((s) => ({
    scan_id: scanId,
    axis: s.axis,
    metric_key: s.metricKey,
    model: s.model,
    score: s.score,
    evidence: s.evidence ?? null,
    raw_detail: s.rawDetail ?? null,
  }));
}

export function toImprovementRows(scanId: string, imps: ImprovementLike[]): ImprovementRow[] {
  return imps.map((i) => ({
    scan_id: scanId,
    axis: i.axis,
    metric_key: i.metricKey,
    severity: i.severity,
    message: i.message,
    suggestion: i.suggestion,
  }));
}
```

- [ ] **Step 3: import 어댑터 구현 (네트워크 얇은 층 — 매핑 함수 재사용)**

`packages/db/src/import.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetricScore } from "@ai-benchmark/core";
import { toMetricScoreRows, toImprovementRows, type ImprovementLike } from "./rows.js";

export interface CompanyLike {
  name: string;
  slug: string;
  homepageUrl: string;
  isSelf: boolean;
  category?: string;
}

/** 기업 upsert → scan 생성 → metric_scores/improvements 일괄 삽입. */
export async function importScan(
  client: SupabaseClient,
  company: CompanyLike,
  opts: {
    scannedAt: string;
    rubricVersion: string;
    rawSnapshotPath?: string;
    scores: MetricScore[];
    improvements: ImprovementLike[];
  },
): Promise<{ scanId: string }> {
  const { data: comp, error: cErr } = await client
    .from("companies")
    .upsert(
      {
        name: company.name,
        slug: company.slug,
        homepage_url: company.homepageUrl,
        is_self: company.isSelf,
        category: company.category ?? null,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (cErr || !comp) throw new Error(`company upsert failed: ${cErr?.message}`);

  const { data: scan, error: sErr } = await client
    .from("scans")
    .insert({
      company_id: comp.id,
      scanned_at: opts.scannedAt,
      rubric_version: opts.rubricVersion,
      raw_snapshot_path: opts.rawSnapshotPath ?? null,
      status: "completed",
    })
    .select("id")
    .single();
  if (sErr || !scan) throw new Error(`scan insert failed: ${sErr?.message}`);

  const scoreRows = toMetricScoreRows(scan.id, opts.scores);
  if (scoreRows.length) {
    const { error } = await client.from("metric_scores").insert(scoreRows);
    if (error) throw new Error(`metric_scores insert failed: ${error.message}`);
  }
  const impRows = toImprovementRows(scan.id, opts.improvements);
  if (impRows.length) {
    const { error } = await client.from("improvements").insert(impRows);
    if (error) throw new Error(`improvements insert failed: ${error.message}`);
  }
  return { scanId: scan.id };
}
```

- [ ] **Step 4: 테스트 실행**

Run: `pnpm test packages/db/src/rows.test.ts`
Expected: 매핑 테스트 2개 PASS. (`importScan`은 네트워크 어댑터로 자동 테스트 범위 밖 — Task 10 CLI에서 수동 검증)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(db): row mapping and Supabase import adapter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 배치 CLI (엔드투엔드 조립)

**Files:**
- Create: `packages/crawler/src/cli-crawl.ts`
- Modify: `package.json` (루트 scripts에 `crawl` 추가), `packages/crawler/package.json` (@ai-benchmark/db, dotenv 의존성)
- Test: `packages/crawler/src/cli-crawl.test.ts` (스냅샷 저장 순수 로직만)

**Interfaces:**
- Consumes: `loadCompanies`, `collectSnapshot`, `scoreRules`, `deriveImprovements`, `importScan`, `HttpFetcher`, `loadWeights`
- Produces: 실행 가능한 배치 진입점. `raw/<slug>/<timestamp>.json` 스냅샷 저장 + Supabase 적재.
  - `function snapshotPath(rawDir: string, slug: string, scannedAt: string): string` (순수, 테스트 대상)

- [ ] **Step 1: 의존성 추가**

`packages/crawler/package.json`의 `dependencies`에 추가:
```json
"@ai-benchmark/db": "workspace:*",
"dotenv": "^16.4.5"
```
Run: `pnpm install`

- [ ] **Step 2: snapshotPath 테스트 작성 (실패 확인용)**

`packages/crawler/src/cli-crawl.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { snapshotPath } from "./cli-crawl.js";

describe("snapshotPath", () => {
  it("builds a filesystem-safe path per slug and timestamp", () => {
    const p = snapshotPath("raw", "our-company", "2026-07-08T00:00:00.000Z");
    expect(p).toBe("raw/our-company/2026-07-08T00-00-00-000Z.json");
  });
});
```

- [ ] **Step 3: CLI 구현**

`packages/crawler/src/cli-crawl.ts`:
```ts
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { importScan } from "@ai-benchmark/db";
import { loadCompanies } from "./companies.js";
import { collectSnapshot } from "./snapshot.js";
import { HttpFetcher } from "./fetcher.js";
import { scoreRules, deriveImprovements } from "./rule-score.js";

const RUBRIC_VERSION = "rubric_v1";

/** 콜론을 하이픈으로 치환해 파일시스템 안전 경로 생성. */
export function snapshotPath(rawDir: string, slug: string, scannedAt: string): string {
  const safe = scannedAt.replace(/[:.]/g, "-");
  return `${rawDir}/${slug}/${safe}.json`;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const companies = loadCompanies(resolve(root, "config/companies.yaml"));
  const rawDir = resolve(root, "raw");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key) : null;

  const fetcher = new HttpFetcher();
  const now = () => new Date().toISOString();

  for (const company of companies) {
    const snap = await collectSnapshot(company, fetcher, now);
    const scores = scoreRules(snap);
    const improvements = deriveImprovements(scores);

    const relPath = snapshotPath("raw", company.slug, snap.scannedAt);
    const absPath = resolve(root, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, JSON.stringify(snap, null, 2));

    if (client) {
      const { scanId } = await importScan(client, company, {
        scannedAt: snap.scannedAt,
        rubricVersion: RUBRIC_VERSION,
        rawSnapshotPath: relPath,
        scores,
        improvements,
      });
      console.log(`[${company.slug}] imported scan ${scanId} (${scores.length} scores)`);
    } else {
      console.log(`[${company.slug}] scored ${scores.length} metrics (DB skipped: no env)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
```

- [ ] **Step 4: 루트 scripts에 crawl 추가**

`package.json`의 `scripts`에 추가:
```json
"crawl": "tsx packages/crawler/src/cli-crawl.ts"
```

- [ ] **Step 5: 테스트 실행**

Run: `pnpm test`
Expected: 전체 테스트 PASS (snapshotPath 포함). CLI의 `main()`은 자동 테스트하지 않는다.

- [ ] **Step 6: 타입체크 + 커밋**

Run: `pnpm typecheck`
Expected: 오류 없음.

```bash
git add -A
git commit -m "feat(crawler): batch CLI wiring crawl->score->import

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: 수동 엔드투엔드 검증 (실행 시, 선택)**

`.env`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 넣고(없으면 DB는 건너뜀):
Run: `pnpm crawl`
Expected: 각 기업에 대해 `raw/<slug>/<ts>.json`이 생성되고, DB env가 있으면 `imported scan ...` 로그. 예시 URL(example.com)은 점수가 낮게 나오는 게 정상 — 실제 기업 URL을 `companies.yaml`에 채운 뒤 재실행.

---

## Self-Review 결과 (작성자 확인)

**1. 스펙 커버리지 (Plan 1 범위):**
- §3 아키텍처 [1][2][3a][4] → Task 1·4·5·6·7·8·9·10 ✅
- §4 축 A/B/D 규칙 채점 + 정규화 → Task 5·6·7 ✅ (축 C는 명시적으로 Plan 2)
- §4.2 종합/축 집계, 재정규화 → Task 2 ✅
- §4.3 개선항목 자동 생성 → Task 8 ✅
- §5 데이터 모델 4개 테이블 → Task 3 ✅
- §6 모노레포 구조·LLM 계약용 rubric 파일 배치 → Task 1·2·10 ✅
- Methodology가 읽을 `weights.yaml` 단일 출처 → Task 2 ✅ (렌더는 Plan 3)

**2. Placeholder 스캔:** "TBD/TODO/적절히 처리" 없음. 모든 코드 스텝에 완전한 코드 포함. ✅

**3. 타입 일관성:** `MetricScore`(core) → 규칙 채점기 → `scoreRules` → `toMetricScoreRows`/`importScan` 전 구간 필드명 일치(`metricKey`↔`metric_key` 매핑은 Task 9에서 명시). `deriveImprovements` 반환형이 `toImprovementRows`의 `ImprovementLike`와 정합. ✅

**Plan 1 범위 밖(후속 계획):** 축 C LLM 채점(Plan 2), 대시보드 렌더(Plan 3), 실제 20~50개 기업 리스트 확보(운영).
