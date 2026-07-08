# Plan 3 — Next.js 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. UI 태스크의 시각 구현은 frontend-design 스킬을 참고한다.

**Goal:** 저장된 채점 데이터(규칙 A/B/D + LLM 축 C, 모델별)를 순위·상세·비교·모델비교·방법론 5개 화면으로 시각화하는 Next.js 대시보드. 실데이터·라이브 DB 없이도 fixture로 개발·시각 검증되고, Supabase는 얇은 어댑터로 교체 가능하다.

**Architecture:** `packages/web` = Next.js(App Router). 대시보드는 `DashboardData` 형태만 소비한다. `DashboardProvider` 인터페이스의 두 구현 — `FixtureProvider`(시드 데이터, 기본) / `SupabaseProvider`(얇은 어댑터) — 중 env로 선택. 원점수 → DashboardData 변환은 순수 함수로 core의 `overallForView`/`axisForView`를 재사용(모델 평균 뷰 + 모델별 뷰). 서버 컴포넌트가 provider를 호출해 렌더.

**Tech Stack:** Next.js(App Router, React Server Components), TypeScript, Tailwind CSS, Recharts(레이더 차트), next/font(Space Grotesk·Inter·IBM Plex Mono), @supabase/supabase-js. vitest(순수 로직). 시각 검증은 브라우저(수동/자동화).

## Global Constraints

- Node.js >= 20, pnpm >= 9. ESM. TypeScript `^5.5` strict.
- `packages/web`는 Next 자체 빌드를 쓴다 — 루트 `tsconfig.json`의 project references(`tsc -b`)에 **포함하지 않는다**(라이브러리 tsc 빌드를 깨지 않기 위해). web 타입체크는 `next build`/`tsc --noEmit`로 별도.
- 워크스페이스 의존성은 Next에서 `transpilePackages`로 트랜스파일한다.
- 상대 import는 웹 앱 관례대로(App Router). 크로스패키지는 `@ai-benchmark/core` bare specifier.
- **점수 색상은 단일 발산 스케일 함수 하나에서만** 나온다(빨강<40 ≤ 앰버 <70 ≤ 초록). 컴포넌트에 색 하드코딩 금지.
- **가중치·루브릭은 config 단일 출처**(weights.yaml + rubric_v1.md)를 읽어 Methodology가 렌더 — 표시와 실제 채점 기준이 어긋나지 않게.
- 접근성 바닥: 반응형(모바일까지), 키보드 포커스 가시, `prefers-reduced-motion` 존중(스캔 애니메이션 비활성).
- 모델 뷰 = `'average' | { model }`. 축 C가 여러 모델일 때 core의 `collapseForView`로 이중 계산 방지(이미 구현됨).
- 커밋 메시지 마지막 줄: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Plan 1·2에서 이어지는 사실

- `@ai-benchmark/core`: `Axis`, `MetricScore { axis; metricKey; model; score; evidence? }`, `Weights`, `loadWeights(path)`, `ScoreView`('average'|{model}), `collapseForView`, `axisForView(scores,axis,w,view)`, `overallForView(scores,w,view)`.
- `metric_scores` 행: `(scan_id, axis, metric_key, model, score, evidence, raw_detail)`. `companies`: `slug, name, homepage_url, is_self, category`. `scans`: `company_id, scanned_at`. 규칙 점수 model='rule-based'; 축 C는 실제 모델 id(claude-…, gpt-…).
- config/weights.yaml 축 가중치 A.30/B.25/C.30/D.15; 축 C 지표 clarity/product_depth/key_info_present/freshness_clarity.
- 축 A/B/D 지표 키(규칙): A(robots_allowed, sitemap_present, llms_txt_present, ssr_rendered, not_bot_blocked, pages_reachable), B(json_ld_present, semantic_ratio, meta_completeness, heading_hierarchy, alt_coverage), D(load_time, mobile_ready, https_secure, multilingual).
- 개선항목(improvements): 규칙 축만 존재(Plan 1). 축 C 개선항목은 이 계획에서 **evidence 표시**로 대체.

## 디자인 토큰 (Readability Instrument)

- **팔레트(다크 기준, 라이트 대응)**: `--ink:#0E1116`(bg), `--surface:#171B22`(panel), `--line:#2A2F3A`(hairline), `--text:#E6E9EF`, `--muted:#8A93A3`, 시그니처 `--signal:#57C7D4`(active/scan). 점수 발산: `--score-low:#E5484D`, `--score-mid:#F5A524`, `--score-high:#30A46C`.
- **타입**: Space Grotesk(display/headings), Inter(body), IBM Plex Mono(점수·지표키·URL).
- **모티프**: 축 점수 = 신호강도 세그먼트 막대(signal bars); 랭킹 = 판독 원장(우리 회사 행 고정·강조); 로드 시 스캔 라인 스윕(reduced-motion시 없음); 데이터는 모노스페이스.

## 범위 밖 (YAGNI)

- 인증/권한(내부용). 시계열 추세 UI(최신 scan만). 실제 기업 리스트·실제 채점 실행(운영). 축 C 개선항목 생성.

---

## File Structure

```
packages/web/
├─ package.json
├─ next.config.mjs            # transpilePackages
├─ tsconfig.json              # Next용 (루트 references에 미포함)
├─ postcss.config.mjs
├─ tailwind.config.ts
├─ vitest는 루트 설정 사용 (packages/**/*.test.ts)
├─ src/
│   ├─ app/
│   │   ├─ layout.tsx         # 폰트·테마·네비
│   │   ├─ globals.css        # 토큰·리셋·스캔 애니메이션
│   │   ├─ page.tsx           # 화면1 종합 순위
│   │   ├─ company/[slug]/page.tsx   # 화면2 기업 상세
│   │   ├─ compare/page.tsx   # 화면3 우리 vs 경쟁사
│   │   ├─ models/page.tsx    # 화면4 모델 비교
│   │   └─ methodology/page.tsx      # 화면5 방법론
│   ├─ lib/
│   │   ├─ scoreColor.ts      # 발산 색 단일 출처
│   │   ├─ data/
│   │   │   ├─ types.ts       # DashboardData 형태
│   │   │   ├─ build.ts       # metric rows → DashboardData (core 집계 재사용)
│   │   │   ├─ provider.ts    # DashboardProvider 인터페이스 + 선택
│   │   │   ├─ fixtures.ts    # FixtureProvider (시드)
│   │   │   └─ supabase.ts    # SupabaseProvider (얇은 어댑터)
│   │   └─ methodology.ts     # weights.yaml + rubric 로드
│   └─ components/
│       ├─ ScorePill.tsx      # 색 입힌 점수
│       ├─ SignalBars.tsx     # 4축 신호막대
│       ├─ ModelToggle.tsx    # 평균/Claude/GPT (client)
│       ├─ AxisRadar.tsx      # Recharts 레이더 (client)
│       ├─ MetricTable.tsx    # 지표 표 + evidence
│       └─ RankLedger.tsx     # 순위 원장
└─ scripts/seed.ts            # (선택) Supabase에 fixture 시드
```

---

## Task 1: Next.js 앱 스캐폴드 + 디자인 토큰 + 레이아웃

**Files:**
- Create: `packages/web/package.json`, `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `next-env.d.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`(임시)
- Modify: `.gitignore`(`.next/` 추가), 루트 `package.json`(web 스크립트)

**Interfaces:**
- Consumes: (없음)
- Produces: 빌드되는 Next 앱 셸, 폰트·토큰·네비, `pnpm --filter @ai-benchmark/web build` 성공.

- [ ] **Step 1: 패키지/설정 파일 작성**

`packages/web/package.json`:
```json
{
  "name": "@ai-benchmark/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-benchmark/core": "workspace:*",
    "@ai-benchmark/db": "workspace:*",
    "@supabase/supabase-js": "^2.45.4",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^2.12.7",
    "yaml": "^2.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7"
  }
}
```

`packages/web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ai-benchmark/core", "@ai-benchmark/db"],
};
export default nextConfig;
```

`packages/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true,
    "resolveJsonModule": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`packages/web/postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`packages/web/tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        surface: "var(--surface)",
        line: "var(--line)",
        signal: "var(--signal)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
```

`packages/web/next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

`.gitignore`에 추가:
```
.next/
```

루트 `package.json` scripts에 추가:
```json
"web:dev": "pnpm --filter @ai-benchmark/web dev",
"web:build": "pnpm --filter @ai-benchmark/web build"
```
Run: `pnpm install`

- [ ] **Step 2: globals.css (토큰·리셋·스캔 애니메이션)**

`packages/web/src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --ink: #0e1116;
  --surface: #171b22;
  --line: #2a2f3a;
  --text: #e6e9ef;
  --muted: #8a93a3;
  --signal: #57c7d4;
  --score-low: #e5484d;
  --score-mid: #f5a524;
  --score-high: #30a46c;
}
:root[data-theme="light"] {
  --ink: #f7f8fa;
  --surface: #ffffff;
  --line: #e3e6eb;
  --text: #14181f;
  --muted: #5b6472;
}
html { color-scheme: dark; }
body {
  background: var(--ink);
  color: var(--text);
  font-family: var(--font-body), system-ui, sans-serif;
}
.mono { font-family: var(--font-mono), ui-monospace, monospace; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }

@keyframes scan {
  from { transform: translateY(-100%); opacity: 0.0; }
  10% { opacity: 0.35; }
  to { transform: translateY(1200%); opacity: 0.0; }
}
.scanline {
  position: absolute; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--signal), transparent);
  animation: scan 2.2s ease-out 1;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .scanline { animation: none; display: none; }
}
:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
```

- [ ] **Step 3: 루트 레이아웃 (폰트·네비)**

`packages/web/src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AI Readability Benchmark",
  description: "국내 블록체인 기업 홈페이지 AI 친화도 벤치마크",
};

const NAV = [
  { href: "/", label: "순위" },
  { href: "/compare", label: "우리 vs 경쟁사" },
  { href: "/models", label: "모델 비교" },
  { href: "/methodology", label: "방법론" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <header className="border-b" style={{ borderColor: "var(--line)" }}>
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight">
              READABILITY<span style={{ color: "var(--signal)" }}>/</span>BENCH
            </Link>
            <ul className="flex gap-4 text-sm" style={{ color: "var(--muted)" }}>
              {NAV.map((n) => (
                <li key={n.href}><Link href={n.href} className="hover:text-[var(--text)]">{n.label}</Link></li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
```

`packages/web/src/app/page.tsx` (임시 placeholder — Task 6에서 교체):
```tsx
export default function Home() {
  return <p className="mono" style={{ color: "var(--muted)" }}>스캐폴드 준비됨.</p>;
}
```

- [ ] **Step 4: 빌드 검증**

Run: `pnpm --filter @ai-benchmark/web build`
Expected: 빌드 성공(경고 허용). `.next/` 생성.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(web): Next.js scaffold with Readability Instrument design tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 데이터 형태 + 원점수→DashboardData 변환 (순수)

**Files:**
- Create: `packages/web/src/lib/data/types.ts`, `packages/web/src/lib/data/build.ts`
- Test: `packages/web/src/lib/data/build.test.ts`

**Interfaces:**
- Consumes: `MetricScore`, `Weights`, `ScoreView`, `overallForView`, `axisForView`, `collapseForView` (core)
- Produces:
  - `interface CompanyRecord { slug: string; name: string; homepageUrl: string; isSelf: boolean; category?: string; scores: MetricScore[] }`
  - `interface AxisScore { axis: Axis; score: number | null }`
  - `interface RankingRow { slug: string; name: string; isSelf: boolean; overall: number | null; axes: AxisScore[] }`
  - `interface DashboardData { rankings(view: ScoreView): RankingRow[]; models: string[] }` — 아니라 순수 함수로:
  - `function buildRanking(companies: CompanyRecord[], w: Weights, view: ScoreView): RankingRow[]` — overall 내림차순 정렬(null 최하), 각 축 점수 포함.
  - `function listModels(companies: CompanyRecord[]): string[]` — 축 C에 등장한 LLM 모델 id 유니크 정렬(‘rule-based’ 제외).
  - `function industryAverage(rows: RankingRow[]): number | null` — overall 평균(null 제외).

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/lib/data/build.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildRanking, listModels, industryAverage } from "./build.js";
import type { CompanyRecord } from "./types.js";
import type { MetricScore, Weights } from "@ai-benchmark/core";

const w: Weights = {
  axes: { A: 0.5, B: 0, C: 0.5, D: 0 },
  metrics: { A: { a1: 1 }, B: {}, C: { c1: 1 }, D: {} },
};
function s(axis: MetricScore["axis"], k: string, model: string, score: number): MetricScore {
  return { axis, metricKey: k, model, score };
}
const companies: CompanyRecord[] = [
  { slug: "us", name: "Us", homepageUrl: "https://us", isSelf: true,
    scores: [s("A", "a1", "rule-based", 80), s("C", "c1", "claude-x", 40), s("C", "c1", "gpt-x", 60)] },
  { slug: "riv", name: "Rival", homepageUrl: "https://riv", isSelf: false,
    scores: [s("A", "a1", "rule-based", 60), s("C", "c1", "claude-x", 100), s("C", "c1", "gpt-x", 100)] },
];

describe("buildRanking", () => {
  it("ranks by overall desc for the average view", () => {
    // us: A80,C avg50 → 65 ; riv: A60,C100 → 80 → riv first
    const rows = buildRanking(companies, w, "average");
    expect(rows.map((r) => r.slug)).toEqual(["riv", "us"]);
    expect(rows.find((r) => r.slug === "us")!.overall).toBe(65);
  });
  it("recomputes per model view", () => {
    // claude: us A80,C40→60 ; riv A60,C100→80
    const rows = buildRanking(companies, w, { model: "claude-x" });
    expect(rows.find((r) => r.slug === "us")!.overall).toBe(60);
  });
  it("includes per-axis scores", () => {
    const rows = buildRanking(companies, w, "average");
    const us = rows.find((r) => r.slug === "us")!;
    expect(us.axes.find((a) => a.axis === "C")!.score).toBe(50);
  });
});

describe("listModels", () => {
  it("returns unique sorted LLM models, excluding rule-based", () => {
    expect(listModels(companies)).toEqual(["claude-x", "gpt-x"]);
  });
});

describe("industryAverage", () => {
  it("averages overall across rows", () => {
    const rows = buildRanking(companies, w, "average"); // 80, 65
    expect(industryAverage(rows)).toBe(72.5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/web/src/lib/data/build.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`packages/web/src/lib/data/types.ts`:
```ts
import type { Axis, MetricScore } from "@ai-benchmark/core";

export interface CompanyRecord {
  slug: string;
  name: string;
  homepageUrl: string;
  isSelf: boolean;
  category?: string;
  scores: MetricScore[];
}

export interface AxisScore {
  axis: Axis;
  score: number | null;
}

export interface RankingRow {
  slug: string;
  name: string;
  isSelf: boolean;
  overall: number | null;
  axes: AxisScore[];
}
```

`packages/web/src/lib/data/build.ts`:
```ts
import type { Axis, Weights, ScoreView, MetricScore } from "@ai-benchmark/core";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord, RankingRow } from "./types.js";

const AXES: Axis[] = ["A", "B", "C", "D"];

export function buildRanking(companies: CompanyRecord[], w: Weights, view: ScoreView): RankingRow[] {
  const rows: RankingRow[] = companies.map((c) => ({
    slug: c.slug,
    name: c.name,
    isSelf: c.isSelf,
    overall: overallForView(c.scores, w, view),
    axes: AXES.map((axis) => ({ axis, score: axisForView(c.scores, axis, w, view) })),
  }));
  return rows.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
}

export function listModels(companies: CompanyRecord[]): string[] {
  const set = new Set<string>();
  for (const c of companies) {
    for (const s of c.scores as MetricScore[]) {
      if (s.model !== "rule-based" && s.model !== "average") set.add(s.model);
    }
  }
  return [...set].sort();
}

export function industryAverage(rows: RankingRow[]): number | null {
  const vals = rows.map((r) => r.overall).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test packages/web/src/lib/data/build.test.ts`
Expected: 5개 PASS.
Run: `pnpm test`
Expected: 기존 64 + build 5 = 69 PASS.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(web): DashboardData shapes and pure ranking builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Provider (fixtures + supabase 어댑터) + 선택

**Files:**
- Create: `packages/web/src/lib/data/fixtures.ts`, `packages/web/src/lib/data/supabase.ts`, `packages/web/src/lib/data/provider.ts`
- Test: `packages/web/src/lib/data/fixtures.test.ts`

**Interfaces:**
- Consumes: `CompanyRecord` (Task 2), `MetricScore` (core), `@supabase/supabase-js`
- Produces:
  - `interface DashboardProvider { getCompanies(): Promise<CompanyRecord[]> }`
  - `function fixtureCompanies(): CompanyRecord[]` — 시드 4개(우리 회사 포함), 규칙 A/B/D + claude/gpt 축 C 점수.
  - `class FixtureProvider implements DashboardProvider`
  - `class SupabaseProvider implements DashboardProvider` — 최신 scan의 metric_scores를 기업별로 모아 CompanyRecord[] 구성(얇은 어댑터, 단위 테스트 안 함).
  - `function getProvider(): DashboardProvider` — SUPABASE_URL/키 있으면 Supabase, 없으면 Fixture.

- [ ] **Step 1: 실패 테스트 작성 (fixture 형태 검증)**

`packages/web/src/lib/data/fixtures.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { fixtureCompanies } from "./fixtures.js";
import { buildRanking, listModels } from "./build.js";
import { loadWeights } from "@ai-benchmark/core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const w = loadWeights(resolve(here, "../../../../../config/weights.yaml"));

describe("fixtureCompanies", () => {
  const cos = fixtureCompanies();
  it("has at least 3 companies including exactly one self", () => {
    expect(cos.length).toBeGreaterThanOrEqual(3);
    expect(cos.filter((c) => c.isSelf)).toHaveLength(1);
  });
  it("includes rule-based and two LLM models", () => {
    expect(listModels(cos)).toEqual(expect.arrayContaining(["claude", "gpt"].map((m) => expect.stringContaining(m))));
    expect(cos.every((c) => c.scores.some((s) => s.model === "rule-based"))).toBe(true);
  });
  it("produces a valid ranking with the real weights", () => {
    const rows = buildRanking(cos, w, "average");
    expect(rows).toHaveLength(cos.length);
    expect(rows.every((r) => r.overall == null || (r.overall >= 0 && r.overall <= 100))).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/web/src/lib/data/fixtures.test.ts`
Expected: FAIL.

- [ ] **Step 3: fixtures 구현**

`packages/web/src/lib/data/fixtures.ts` — 시드 데이터. 각 기업에 규칙 축 A/B/D 대표 지표 + 축 C(claude·gpt) 점수를 넣는다. (지표 키는 실제 키 사용.)
```ts
import type { MetricScore } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";

function rule(axis: MetricScore["axis"], k: string, score: number): MetricScore {
  return { axis, metricKey: k, model: "rule-based", score };
}
function llm(k: string, model: string, score: number, evidence: string): MetricScore {
  return { axis: "C", metricKey: k, model, score, evidence };
}

/** 한 기업의 축 C 점수(두 모델)를 생성하는 헬퍼. */
function cScores(base: number, claudeDelta: number, gptDelta: number): MetricScore[] {
  const keys = ["clarity", "product_depth", "key_info_present", "freshness_clarity"];
  const out: MetricScore[] = [];
  keys.forEach((k, i) => {
    out.push(llm(k, "claude-opus-4-8", clamp(base + claudeDelta - i * 5), `Claude 근거: ${k}`));
    out.push(llm(k, "gpt-4o", clamp(base + gptDelta - i * 4), `GPT 근거: ${k}`));
  });
  return out;
}
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
function abd(a: Partial<Record<string, number>>): MetricScore[] {
  // 축 A/B/D 대표 지표에 점수 부여
  return [
    rule("A", "robots_allowed", a.robots ?? 100),
    rule("A", "sitemap_present", a.sitemap ?? 100),
    rule("A", "llms_txt_present", a.llms ?? 0),
    rule("A", "ssr_rendered", a.ssr ?? 100),
    rule("A", "not_bot_blocked", 100),
    rule("A", "pages_reachable", 100),
    rule("B", "json_ld_present", a.jsonld ?? 0),
    rule("B", "semantic_ratio", a.semantic ?? 67),
    rule("B", "meta_completeness", a.meta ?? 75),
    rule("B", "heading_hierarchy", a.heading ?? 100),
    rule("B", "alt_coverage", a.alt ?? 50),
    rule("D", "load_time", a.load ?? 80),
    rule("D", "mobile_ready", a.mobile ?? 100),
    rule("D", "https_secure", 100),
    rule("D", "multilingual", a.multi ?? 0),
  ];
}

export function fixtureCompanies(): CompanyRecord[] {
  return [
    {
      slug: "our-company", name: "우리회사", homepageUrl: "https://our.example", isSelf: true, category: "L1",
      scores: [...abd({ llms: 0, jsonld: 0, multi: 0 }), ...cScores(62, 6, -4)],
    },
    {
      slug: "chain-alpha", name: "체인알파", homepageUrl: "https://alpha.example", isSelf: false, category: "L1",
      scores: [...abd({ llms: 100, jsonld: 100, multi: 100, alt: 90 }), ...cScores(84, 4, 2)],
    },
    {
      slug: "block-beta", name: "블록베타", homepageUrl: "https://beta.example", isSelf: false, category: "DeFi",
      scores: [...abd({ sitemap: 0, ssr: 0, jsonld: 0, meta: 50 }), ...cScores(48, 8, -6)],
    },
    {
      slug: "ledger-gamma", name: "레저감마", homepageUrl: "https://gamma.example", isSelf: false, category: "Infra",
      scores: [...abd({ llms: 100, jsonld: 100, semantic: 100, multi: 100 }), ...cScores(73, 2, 10)],
    },
  ];
}
```

- [ ] **Step 4: provider + supabase 구현**

`packages/web/src/lib/data/provider.ts`:
```ts
import type { CompanyRecord } from "./types.js";
import { FixtureProvider } from "./fixtures-provider.js";
import { SupabaseProvider } from "./supabase.js";

export interface DashboardProvider {
  getCompanies(): Promise<CompanyRecord[]>;
}

export function getProvider(): DashboardProvider {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? new SupabaseProvider(url, key) : new FixtureProvider();
}
```

`packages/web/src/lib/data/fixtures-provider.ts`:
```ts
import type { DashboardProvider } from "./provider.js";
import type { CompanyRecord } from "./types.js";
import { fixtureCompanies } from "./fixtures.js";

export class FixtureProvider implements DashboardProvider {
  async getCompanies(): Promise<CompanyRecord[]> {
    return fixtureCompanies();
  }
}
```

`packages/web/src/lib/data/supabase.ts` (얇은 어댑터 — 최신 scan당 점수 수집):
```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MetricScore, Axis } from "@ai-benchmark/core";
import type { DashboardProvider } from "./provider.js";
import type { CompanyRecord } from "./types.js";

export class SupabaseProvider implements DashboardProvider {
  private client: SupabaseClient;
  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async getCompanies(): Promise<CompanyRecord[]> {
    const { data: companies, error } = await this.client
      .from("companies")
      .select("slug, name, homepage_url, is_self, category");
    if (error) throw new Error(`companies query failed: ${error.message}`);

    const out: CompanyRecord[] = [];
    for (const c of companies ?? []) {
      const { data: scan } = await this.client
        .from("scans")
        .select("id")
        .eq("company_id", (c as { id?: string }).id ?? "")
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let scores: MetricScore[] = [];
      if (scan?.id) {
        const { data: rows } = await this.client
          .from("metric_scores")
          .select("axis, metric_key, model, score, evidence")
          .eq("scan_id", scan.id);
        scores = (rows ?? []).map((r) => ({
          axis: r.axis as Axis,
          metricKey: r.metric_key as string,
          model: r.model as string,
          score: Number(r.score),
          evidence: (r.evidence as string | null) ?? undefined,
        }));
      }
      out.push({
        slug: c.slug as string,
        name: c.name as string,
        homepageUrl: c.homepage_url as string,
        isSelf: Boolean(c.is_self),
        category: (c.category as string | null) ?? undefined,
        scores,
      });
    }
    return out;
  }
}
```
> 주: 위 companies select에 `id`도 포함해야 scan 조회가 된다 — 구현 시 `select("id, slug, name, homepage_url, is_self, category")`로 하고 매핑에서 id는 scan 조회에만 사용한다. (테스트는 fixture만 검증.)

- [ ] **Step 5: 통과 확인 + 빌드**

Run: `pnpm test`
Expected: 69 + fixtures 3 = 72 PASS.
Run: `pnpm --filter @ai-benchmark/web build`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(web): dashboard providers (fixtures seed + supabase adapter)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 점수 색 유틸 + 공용 프리미티브 컴포넌트

**Files:**
- Create: `packages/web/src/lib/scoreColor.ts`, `src/components/ScorePill.tsx`, `src/components/SignalBars.tsx`
- Test: `packages/web/src/lib/scoreColor.test.ts`

**Interfaces:**
- Consumes: `AxisScore` (types)
- Produces:
  - `function scoreColor(score: number | null): string` — null→muted, <40→low, <70→mid, else high (CSS var 반환).
  - `function scoreBand(score: number | null): "none" | "low" | "mid" | "high"`
  - `ScorePill({ score, size? })` — 모노스페이스 점수 + 색.
  - `SignalBars({ axes })` — 4축 세그먼트 막대(축 라벨 A/B/C/D + 색 높이).

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/lib/scoreColor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreBand, scoreColor } from "./scoreColor.js";

describe("scoreBand", () => {
  it("maps ranges to bands", () => {
    expect(scoreBand(null)).toBe("none");
    expect(scoreBand(0)).toBe("low");
    expect(scoreBand(39.9)).toBe("low");
    expect(scoreBand(40)).toBe("mid");
    expect(scoreBand(69.9)).toBe("mid");
    expect(scoreBand(70)).toBe("high");
    expect(scoreBand(100)).toBe("high");
  });
});

describe("scoreColor", () => {
  it("returns the CSS var for the band", () => {
    expect(scoreColor(20)).toBe("var(--score-low)");
    expect(scoreColor(55)).toBe("var(--score-mid)");
    expect(scoreColor(85)).toBe("var(--score-high)");
    expect(scoreColor(null)).toBe("var(--muted)");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/web/src/lib/scoreColor.test.ts`
Expected: FAIL.

- [ ] **Step 3: scoreColor 구현**

`packages/web/src/lib/scoreColor.ts`:
```ts
export type ScoreBand = "none" | "low" | "mid" | "high";

export function scoreBand(score: number | null): ScoreBand {
  if (score == null) return "none";
  if (score < 40) return "low";
  if (score < 70) return "mid";
  return "high";
}

export function scoreColor(score: number | null): string {
  switch (scoreBand(score)) {
    case "low": return "var(--score-low)";
    case "mid": return "var(--score-mid)";
    case "high": return "var(--score-high)";
    default: return "var(--muted)";
  }
}
```

- [ ] **Step 4: 컴포넌트 구현**

`packages/web/src/components/ScorePill.tsx`:
```tsx
import { scoreColor } from "../lib/scoreColor.js";

export function ScorePill({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-4xl" : size === "sm" ? "text-sm" : "text-xl";
  return (
    <span className={`mono font-semibold ${cls}`} style={{ color: scoreColor(score) }}>
      {score == null ? "—" : Math.round(score)}
    </span>
  );
}
```

`packages/web/src/components/SignalBars.tsx`:
```tsx
import type { AxisScore } from "../lib/data/types.js";
import { scoreColor } from "../lib/scoreColor.js";

export function SignalBars({ axes }: { axes: AxisScore[] }) {
  return (
    <div className="flex items-end gap-1" aria-label="axis scores">
      {axes.map((a) => {
        const h = a.score == null ? 4 : 4 + (a.score / 100) * 28;
        return (
          <div key={a.axis} className="flex flex-col items-center gap-1">
            <div
              style={{ height: h, width: 8, background: scoreColor(a.score), borderRadius: 2 }}
              title={`${a.axis}: ${a.score == null ? "—" : Math.round(a.score)}`}
            />
            <span className="mono text-[10px]" style={{ color: "var(--muted)" }}>{a.axis}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: 통과 확인 + 빌드**

Run: `pnpm test`
Expected: 72 + scoreColor 2 = 74 PASS.
Run: `pnpm --filter @ai-benchmark/web build`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(web): score color scale + ScorePill/SignalBars primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 모델 토글 + 레이더 + 지표 표 컴포넌트

**Files:**
- Create: `src/components/ModelToggle.tsx`, `src/components/AxisRadar.tsx`, `src/components/MetricTable.tsx`
- Test: `packages/web/src/components/metricRows.test.ts` (지표 표에 쓰는 순수 변환)
- Create: `packages/web/src/lib/data/metricRows.ts` (순수 변환)

**Interfaces:**
- Consumes: `MetricScore`, `ScoreView`, `collapseForView` (core), `scoreColor`
- Produces:
  - `interface MetricRow { axis: Axis; metricKey: string; score: number | null; evidence?: string }`
  - `function metricRowsForView(scores: MetricScore[], view: ScoreView): MetricRow[]` — collapseForView 후 axis→metricKey 순 정렬, 지표별 1행.
  - `ModelToggle({ models, value, onChange })` — 'average'|모델 세그먼트 컨트롤 (client component).
  - `AxisRadar({ series })` — Recharts 레이더 (client). series: `{ label; values: {axis; score}[] }[]`.
  - `MetricTable({ rows })` — 모노스페이스 지표 표 + evidence 펼침.

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/components/metricRows.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { metricRowsForView } from "../lib/data/metricRows.js";
import type { MetricScore } from "@ai-benchmark/core";

const scores: MetricScore[] = [
  { axis: "A", metricKey: "robots_allowed", model: "rule-based", score: 100 },
  { axis: "C", metricKey: "clarity", model: "claude-x", score: 60, evidence: "cl" },
  { axis: "C", metricKey: "clarity", model: "gpt-x", score: 80, evidence: "gp" },
];

describe("metricRowsForView", () => {
  it("collapses to one row per metric for the average view", () => {
    const rows = metricRowsForView(scores, "average");
    const clarity = rows.find((r) => r.metricKey === "clarity")!;
    expect(clarity.score).toBe(70);
    expect(rows.filter((r) => r.metricKey === "clarity")).toHaveLength(1);
  });
  it("uses the selected model for the model view", () => {
    const rows = metricRowsForView(scores, { model: "gpt-x" });
    expect(rows.find((r) => r.metricKey === "clarity")!.score).toBe(80);
    expect(rows.find((r) => r.metricKey === "clarity")!.evidence).toBe("gp");
  });
  it("sorts by axis then metricKey", () => {
    const rows = metricRowsForView(scores, "average");
    expect(rows[0].axis).toBe("A");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test packages/web/src/components/metricRows.test.ts`
Expected: FAIL.

- [ ] **Step 3: metricRows 구현**

`packages/web/src/lib/data/metricRows.ts`:
```ts
import type { Axis, MetricScore, ScoreView } from "@ai-benchmark/core";
import { collapseForView } from "@ai-benchmark/core";

export interface MetricRow {
  axis: Axis;
  metricKey: string;
  score: number | null;
  evidence?: string;
}

export function metricRowsForView(scores: MetricScore[], view: ScoreView): MetricRow[] {
  const collapsed = collapseForView(scores, view);
  const rows: MetricRow[] = collapsed.map((s) => ({
    axis: s.axis,
    metricKey: s.metricKey,
    score: s.score,
    evidence: s.evidence,
  }));
  const axisOrder: Record<Axis, number> = { A: 0, B: 1, C: 2, D: 3 };
  return rows.sort((a, b) => axisOrder[a.axis] - axisOrder[b.axis] || a.metricKey.localeCompare(b.metricKey));
}
```

- [ ] **Step 4: 컴포넌트 구현**

`packages/web/src/components/ModelToggle.tsx`:
```tsx
"use client";
import type { ScoreView } from "@ai-benchmark/core";

export function ModelToggle({
  models, value, onChange,
}: { models: string[]; value: ScoreView; onChange: (v: ScoreView) => void }) {
  const isAvg = value === "average";
  const current = isAvg ? "average" : value.model;
  const options: { key: string; label: string; view: ScoreView }[] = [
    { key: "average", label: "평균", view: "average" },
    ...models.map((m) => ({ key: m, label: m, view: { model: m } as ScoreView })),
  ];
  return (
    <div className="inline-flex rounded-md border" style={{ borderColor: "var(--line)" }} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={current === o.key}
          onClick={() => onChange(o.view)}
          className="mono px-3 py-1.5 text-xs"
          style={{
            background: current === o.key ? "var(--signal)" : "transparent",
            color: current === o.key ? "#0e1116" : "var(--muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

`packages/web/src/components/AxisRadar.tsx`:
```tsx
"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend } from "recharts";
import type { Axis } from "@ai-benchmark/core";

export interface RadarSeries {
  label: string;
  color: string;
  values: { axis: Axis; score: number | null }[];
}
const AXIS_LABEL: Record<Axis, string> = { A: "접근성", B: "구조화", C: "콘텐츠", D: "기술위생" };

export function AxisRadar({ series }: { series: RadarSeries[] }) {
  const axes: Axis[] = ["A", "B", "C", "D"];
  const data = axes.map((axis) => {
    const row: Record<string, string | number> = { axis: AXIS_LABEL[axis] };
    series.forEach((s) => (row[s.label] = s.values.find((v) => v.axis === axis)?.score ?? 0));
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--line)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted)", fontSize: 12 }} />
        {series.map((s) => (
          <Radar key={s.label} dataKey={s.label} stroke={s.color} fill={s.color} fillOpacity={0.15} />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

`packages/web/src/components/MetricTable.tsx`:
```tsx
import type { MetricRow } from "../lib/data/metricRows.js";
import { scoreColor } from "../lib/scoreColor.js";

const AXIS_LABEL: Record<string, string> = { A: "접근성", B: "구조화", C: "콘텐츠", D: "기술위생" };

export function MetricTable({ rows }: { rows: MetricRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ color: "var(--muted)" }} className="text-left">
          <th className="py-2 font-normal">축</th>
          <th className="py-2 font-normal">지표</th>
          <th className="py-2 text-right font-normal">점수</th>
          <th className="py-2 font-normal">근거</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.axis}-${r.metricKey}`} className="border-t" style={{ borderColor: "var(--line)" }}>
            <td className="py-2" style={{ color: "var(--muted)" }}>{AXIS_LABEL[r.axis] ?? r.axis}</td>
            <td className="mono py-2">{r.metricKey}</td>
            <td className="mono py-2 text-right" style={{ color: scoreColor(r.score) }}>
              {r.score == null ? "—" : Math.round(r.score)}
            </td>
            <td className="py-2" style={{ color: "var(--muted)" }}>{r.evidence ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: 통과 확인 + 빌드**

Run: `pnpm test`
Expected: 74 + metricRows 3 = 77 PASS.
Run: `pnpm --filter @ai-benchmark/web build`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat(web): ModelToggle, AxisRadar, MetricTable + metric row transform

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 화면 1 — 종합 순위(홈) + 모델 뷰 클라이언트

**Files:**
- Create: `src/components/RankingView.tsx` (client), `src/app/page.tsx`(교체)
- Test: (없음 — 순수 로직은 Task 2에서 검증; 시각은 브라우저 검증)

**Interfaces:**
- Consumes: `getProvider` (Task 3), `buildRanking`/`industryAverage`/`listModels` (Task 2), `loadWeights` (core), `ModelToggle`/`SignalBars`/`ScorePill`
- Produces: 서버 컴포넌트 `Home`이 provider·weights로 `CompanyRecord[]`·모델 목록을 가져와 client `RankingView`에 넘김. RankingView가 모델 토글 상태로 `buildRanking`을 재계산해 원장 렌더(우리 회사 행 고정 강조 + 업계 평균 대비).

- [ ] **Step 1: RankingView 클라이언트 구현**

`packages/web/src/components/RankingView.tsx`:
```tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ScoreView, Weights } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { buildRanking, industryAverage } from "../lib/data/build.js";
import { ModelToggle } from "./ModelToggle.js";
import { SignalBars } from "./SignalBars.js";
import { ScorePill } from "./ScorePill.js";

export function RankingView({ companies, weights, models }: { companies: CompanyRecord[]; weights: Weights; models: string[] }) {
  const [view, setView] = useState<ScoreView>("average");
  const rows = useMemo(() => buildRanking(companies, weights, view), [companies, weights, view]);
  const avg = industryAverage(rows);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">종합 순위</h1>
        <ModelToggle models={models} value={view} onChange={setView} />
      </div>
      <div className="panel relative overflow-hidden">
        <div className="scanline" />
        <table className="w-full">
          <tbody>
            {rows.map((r, i) => {
              const delta = avg != null && r.overall != null ? r.overall - avg : null;
              return (
                <tr key={r.slug} className="border-t first:border-t-0"
                    style={{ borderColor: "var(--line)", background: r.isSelf ? "rgba(87,199,212,0.08)" : "transparent" }}>
                  <td className="mono px-4 py-3 text-sm" style={{ color: "var(--muted)", width: 48 }}>
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/company/${r.slug}`} className="font-medium hover:text-[var(--signal)]">
                      {r.name}{r.isSelf && <span className="mono ml-2 text-xs" style={{ color: "var(--signal)" }}>US</span>}
                    </Link>
                  </td>
                  <td className="px-2 py-3"><SignalBars axes={r.axes} /></td>
                  <td className="px-4 py-3 text-right"><ScorePill score={r.overall} /></td>
                  <td className="mono px-4 py-3 text-right text-xs" style={{ width: 80, color: "var(--muted)" }}>
                    {delta == null ? "" : `${delta >= 0 ? "+" : ""}${Math.round(delta)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mono mt-3 text-xs" style={{ color: "var(--muted)" }}>
        업계 평균 {avg == null ? "—" : Math.round(avg)} · 우측 값은 평균 대비 · 현재 뷰: {view === "average" ? "모델 평균" : view.model}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 홈 서버 컴포넌트 (page.tsx 교체)**

`packages/web/src/app/page.tsx`:
```tsx
import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { getProvider } from "../lib/data/provider.js";
import { listModels } from "../lib/data/build.js";
import { RankingView } from "../components/RankingView.js";

export default async function Home() {
  const companies = await getProvider().getCompanies();
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  const models = listModels(companies);
  return <RankingView companies={companies} weights={weights} models={models} />;
}
```
> 주: `process.cwd()`는 `pnpm --filter web dev/build` 시 `packages/web`. 루트의 `config/weights.yaml`은 `../../config/…`. Supabase 미설정 시 fixture로 동작.

- [ ] **Step 3: 빌드 + 시각 검증**

Run: `pnpm test` (회귀 없음 확인, 77 유지)
Run: `pnpm --filter @ai-benchmark/web build`
Expected: 성공.

**시각 검증(수동/브라우저):** `pnpm web:dev` 후 http://localhost:3000 — 순위 원장에 4개 기업, 우리회사 행 강조·US 배지, 신호막대, 모델 토글(평균/claude-opus-4-8/gpt-4o) 전환 시 순위·점수 재계산, 스캔라인 1회. reduced-motion에서 스캔라인 없음.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(web): ranking home with model toggle and self-company highlight

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 화면 2 — 기업 상세

**Files:**
- Create: `src/components/CompanyDetailView.tsx` (client), `src/app/company/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getProvider`, `loadWeights`, `metricRowsForView`, `axisForView`/`overallForView` (core), `AxisRadar`/`MetricTable`/`ScorePill`/`ModelToggle`
- Produces: 서버 컴포넌트가 slug로 기업을 찾아 client `CompanyDetailView`에 넘김. 뷰: 헤더(이름·URL·종합 ScorePill lg), 레이더(선택 뷰 + Claude/GPT 오버레이 가능), 지표 표(evidence), 없으면 404.

- [ ] **Step 1: CompanyDetailView 구현**

`packages/web/src/components/CompanyDetailView.tsx`:
```tsx
"use client";
import { useMemo, useState } from "react";
import type { Axis, ScoreView, Weights } from "@ai-benchmark/core";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { metricRowsForView } from "../lib/data/metricRows.js";
import { ModelToggle } from "./ModelToggle.js";
import { MetricTable } from "./MetricTable.js";
import { ScorePill } from "./ScorePill.js";
import { AxisRadar, type RadarSeries } from "./AxisRadar.js";

const AXES: Axis[] = ["A", "B", "C", "D"];

export function CompanyDetailView({ company, weights, models }: { company: CompanyRecord; weights: Weights; models: string[] }) {
  const [view, setView] = useState<ScoreView>("average");
  const overall = useMemo(() => overallForView(company.scores, weights, view), [company, weights, view]);
  const rows = useMemo(() => metricRowsForView(company.scores, view), [company, view]);

  const series: RadarSeries[] = useMemo(() => {
    const colors: Record<string, string> = { "claude-opus-4-8": "#57C7D4", "gpt-4o": "#F5A524" };
    const list: RadarSeries[] = models.map((m, i) => ({
      label: m,
      color: colors[m] ?? (i === 0 ? "#57C7D4" : "#8B7CF6"),
      values: AXES.map((axis) => ({ axis, score: axisForView(company.scores, axis, weights, { model: m }) })),
    }));
    return list.length ? list : [{
      label: "평균", color: "#57C7D4",
      values: AXES.map((axis) => ({ axis, score: axisForView(company.scores, axis, weights, "average") })),
    }];
  }, [company, weights, models]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{company.name}</h1>
          <a href={company.homepageUrl} className="mono text-sm" style={{ color: "var(--muted)" }} target="_blank" rel="noreferrer">
            {company.homepageUrl}
          </a>
        </div>
        <div className="text-right">
          <ScorePill score={overall} size="lg" />
          <div className="mt-2"><ModelToggle models={models} value={view} onChange={setView} /></div>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="panel p-4">
          <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>축별 (모델 오버레이)</h2>
          <AxisRadar series={series} />
        </div>
        <div className="panel p-4">
          <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>지표</h2>
          <MetricTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 상세 서버 컴포넌트**

`packages/web/src/app/company/[slug]/page.tsx`:
```tsx
import { resolve } from "node:path";
import { notFound } from "next/navigation";
import { loadWeights } from "@ai-benchmark/core";
import { getProvider } from "../../../lib/data/provider.js";
import { listModels } from "../../../lib/data/build.js";
import { CompanyDetailView } from "../../../components/CompanyDetailView.js";

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const companies = await getProvider().getCompanies();
  const company = companies.find((c) => c.slug === params.slug);
  if (!company) notFound();
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  return <CompanyDetailView company={company} weights={weights} models={listModels(companies)} />;
}
```

- [ ] **Step 3: 빌드 + 시각 검증**

Run: `pnpm --filter @ai-benchmark/web build` (성공)
**시각 검증:** `/company/our-company` — 종합 점수 lg, 레이더에 claude/gpt 두 시리즈, 지표 표에 축 C evidence. 모델 토글 전환 시 종합·지표 반영. 없는 slug는 404.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(web): company detail with axis radar and metric evidence table

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 화면 3·4 — 우리 vs 경쟁사 + 모델 비교

**Files:**
- Create: `src/lib/data/compare.ts`, `src/app/compare/page.tsx`, `src/app/models/page.tsx`
- Create: `src/components/CompareView.tsx`, `src/components/ModelCompareView.tsx` (client)
- Test: `packages/web/src/lib/data/compare.test.ts`

**Interfaces:**
- Consumes: `metricRowsForView`, `axisForView` (core), `CompanyRecord`
- Produces:
  - `interface GapRow { axis: Axis; metricKey: string; self: number | null; best: number | null; bestName: string; gap: number }`
  - `function losingMetrics(self: CompanyRecord, others: CompanyRecord[], view: ScoreView): GapRow[]` — 우리보다 높은 경쟁사가 있는 지표만, gap=best-self 내림차순.
  - `interface ModelDelta { axis: Axis; metricKey: string; a: number | null; b: number | null; delta: number }`
  - `function modelDeltas(company: CompanyRecord, modelA: string, modelB: string): ModelDelta[]` — 두 모델 축 C 지표 점수 차(|delta| 내림차순).

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/lib/data/compare.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { losingMetrics, modelDeltas } from "./compare.js";
import type { CompanyRecord } from "./types.js";
import type { MetricScore } from "@ai-benchmark/core";

function co(slug: string, isSelf: boolean, scores: MetricScore[]): CompanyRecord {
  return { slug, name: slug, homepageUrl: "https://x", isSelf, scores };
}
const self = co("us", true, [
  { axis: "A", metricKey: "sitemap_present", model: "rule-based", score: 0 },
  { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 100 },
]);
const rival = co("riv", false, [
  { axis: "A", metricKey: "sitemap_present", model: "rule-based", score: 100 },
  { axis: "B", metricKey: "json_ld_present", model: "rule-based", score: 100 },
]);

describe("losingMetrics", () => {
  it("finds metrics where a competitor beats us, gap desc", () => {
    const gaps = losingMetrics(self, [rival], "average");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].metricKey).toBe("sitemap_present");
    expect(gaps[0].gap).toBe(100);
    expect(gaps[0].bestName).toBe("riv");
  });
});

describe("modelDeltas", () => {
  it("computes per-metric score delta between two models", () => {
    const c = co("x", false, [
      { axis: "C", metricKey: "clarity", model: "claude", score: 60 },
      { axis: "C", metricKey: "clarity", model: "gpt", score: 90 },
    ]);
    const d = modelDeltas(c, "claude", "gpt");
    expect(d[0].metricKey).toBe("clarity");
    expect(d[0].delta).toBe(30);
  });
});
```

- [ ] **Step 2: 실패 확인 → 구현**

`packages/web/src/lib/data/compare.ts`:
```ts
import type { Axis, MetricScore, ScoreView } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";
import { metricRowsForView } from "./metricRows.js";

export interface GapRow {
  axis: Axis;
  metricKey: string;
  self: number | null;
  best: number | null;
  bestName: string;
  gap: number;
}

export function losingMetrics(self: CompanyRecord, others: CompanyRecord[], view: ScoreView): GapRow[] {
  const selfRows = metricRowsForView(self.scores, view);
  const gaps: GapRow[] = [];
  for (const sr of selfRows) {
    let best = sr.score ?? 0;
    let bestName = self.name;
    let bestVal: number | null = sr.score;
    for (const o of others) {
      const orow = metricRowsForView(o.scores, view).find((r) => r.axis === sr.axis && r.metricKey === sr.metricKey);
      if (orow?.score != null && orow.score > best) {
        best = orow.score;
        bestName = o.name;
        bestVal = orow.score;
      }
    }
    const selfScore = sr.score ?? 0;
    if (best > selfScore) {
      gaps.push({ axis: sr.axis, metricKey: sr.metricKey, self: sr.score, best: bestVal, bestName, gap: best - selfScore });
    }
  }
  return gaps.sort((a, b) => b.gap - a.gap);
}

export interface ModelDelta {
  axis: Axis;
  metricKey: string;
  a: number | null;
  b: number | null;
  delta: number;
}

export function modelDeltas(company: CompanyRecord, modelA: string, modelB: string): ModelDelta[] {
  const pick = (m: string) => (s: MetricScore) => s.model === m && s.axis === "C";
  const keys = [...new Set(company.scores.filter((s) => s.axis === "C").map((s) => s.metricKey))];
  const out: ModelDelta[] = keys.map((k) => {
    const a = company.scores.find((s) => pick(modelA)(s) && s.metricKey === k)?.score ?? null;
    const b = company.scores.find((s) => pick(modelB)(s) && s.metricKey === k)?.score ?? null;
    return { axis: "C" as Axis, metricKey: k, a, b, delta: (a ?? 0) - (b ?? 0) };
  });
  return out.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}
```

- [ ] **Step 3: Compare/ModelCompare 뷰 + 페이지**

`packages/web/src/components/CompareView.tsx`:
```tsx
"use client";
import { useMemo, useState } from "react";
import type { ScoreView } from "@ai-benchmark/core";
import type { CompanyRecord } from "../lib/data/types.js";
import { losingMetrics } from "../lib/data/compare.js";
import { scoreColor } from "../lib/scoreColor.js";

export function CompareView({ self, others }: { self: CompanyRecord; others: CompanyRecord[] }) {
  const [view] = useState<ScoreView>("average");
  const gaps = useMemo(() => losingMetrics(self, others, view), [self, others, view]);
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">우리 vs 경쟁사</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        경쟁사가 앞서는 지표(개선 우선순위) — {self.name} 기준, 모델 평균.
      </p>
      <div className="panel divide-y" style={{ borderColor: "var(--line)" }}>
        {gaps.length === 0 && <p className="p-4 mono text-sm" style={{ color: "var(--muted)" }}>뒤처지는 지표 없음.</p>}
        {gaps.map((g) => (
          <div key={`${g.axis}-${g.metricKey}`} className="flex items-center justify-between p-3">
            <span className="mono text-sm">{g.metricKey}</span>
            <span className="flex items-center gap-4 text-sm">
              <span className="mono" style={{ color: scoreColor(g.self) }}>우리 {g.self == null ? "—" : Math.round(g.self)}</span>
              <span className="mono" style={{ color: scoreColor(g.best) }}>{g.bestName} {Math.round(g.best ?? 0)}</span>
              <span className="mono font-semibold" style={{ color: "var(--score-low)" }}>−{Math.round(g.gap)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

`packages/web/src/components/ModelCompareView.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { CompanyRecord } from "../lib/data/types.js";
import { modelDeltas } from "../lib/data/compare.js";

export function ModelCompareView({ companies, models }: { companies: CompanyRecord[]; models: string[] }) {
  const [slug, setSlug] = useState(companies[0]?.slug ?? "");
  const company = companies.find((c) => c.slug === slug) ?? companies[0];
  const [a, b] = models;
  const rows = company && a && b ? modelDeltas(company, a, b) : [];
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">모델 비교</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
        같은 사이트를 두 모델이 어떻게 다르게 봤나 (축 C). 편차 큰 지표 상단.
      </p>
      <select value={slug} onChange={(e) => setSlug(e.target.value)}
        className="mono mb-4 rounded border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--line)", color: "var(--text)" }}>
        {companies.map((c) => <option key={c.slug} value={c.slug} style={{ color: "#000" }}>{c.name}</option>)}
      </select>
      {(!a || !b) && <p className="mono text-sm" style={{ color: "var(--muted)" }}>모델이 2개 이상 필요합니다.</p>}
      <div className="panel divide-y" style={{ borderColor: "var(--line)" }}>
        {rows.map((r) => (
          <div key={r.metricKey} className="flex items-center justify-between p-3 text-sm">
            <span className="mono">{r.metricKey}</span>
            <span className="flex items-center gap-4">
              <span className="mono" style={{ color: "#57C7D4" }}>{a} {r.a == null ? "—" : Math.round(r.a)}</span>
              <span className="mono" style={{ color: "#F5A524" }}>{b} {r.b == null ? "—" : Math.round(r.b)}</span>
              <span className="mono font-semibold" style={{ width: 44, textAlign: "right" }}>{r.delta >= 0 ? "+" : ""}{Math.round(r.delta)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```
`packages/web/src/app/compare/page.tsx`:
```tsx
import { getProvider } from "../../lib/data/provider.js";
import { CompareView } from "../../components/CompareView.js";

export default async function ComparePage() {
  const companies = await getProvider().getCompanies();
  const self = companies.find((c) => c.isSelf);
  const others = companies.filter((c) => !c.isSelf);
  if (!self) return <p className="mono" style={{ color: "var(--muted)" }}>우리 회사(is_self)가 설정되지 않았습니다.</p>;
  return <CompareView self={self} others={others} />;
}
```

`packages/web/src/app/models/page.tsx`:
```tsx
import { getProvider } from "../../lib/data/provider.js";
import { listModels } from "../../lib/data/build.js";
import { ModelCompareView } from "../../components/ModelCompareView.js";

export default async function ModelsPage() {
  const companies = await getProvider().getCompanies();
  return <ModelCompareView companies={companies} models={listModels(companies)} />;
}
```

- [ ] **Step 4: 통과 + 빌드 + 시각 검증**

Run: `pnpm test`
Expected: 77 + compare 2 = 79 PASS.
Run: `pnpm --filter @ai-benchmark/web build` (성공)
**시각 검증:** `/compare` 뒤처지는 지표 목록(−gap 빨강), `/models` 기업 선택 시 claude vs gpt 지표별 diff.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(web): compare (self vs rivals) and model-diff screens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 화면 5 — 방법론(Methodology) + 시드 스크립트 + 마무리

**Files:**
- Create: `src/lib/methodology.ts`, `src/app/methodology/page.tsx`, `packages/web/scripts/seed.ts`
- Test: `packages/web/src/lib/methodology.test.ts`

**Interfaces:**
- Consumes: `loadWeights` (core), yaml, config/weights.yaml + config/rubric/rubric_v1.md
- Produces:
  - `interface AxisInfo { axis: Axis; weight: number; label: string; metrics: { key: string; weight: number }[]; scorer: "규칙" | "LLM" }`
  - `function loadMethodology(weightsPath: string): AxisInfo[]` — 축별 가중치·지표·채점 주체(C=LLM, 나머지=규칙).
  - `packages/web/scripts/seed.ts` — (선택) fixtureCompanies를 Supabase에 적재(크롤 없이 대시보드 데모용). importScan 재사용.

- [ ] **Step 1: 실패 테스트 작성**

`packages/web/src/lib/methodology.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadMethodology } from "./methodology.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const weightsPath = resolve(here, "../../../../config/weights.yaml");

describe("loadMethodology", () => {
  const axes = loadMethodology(weightsPath);
  it("returns four axes whose weights sum to 1.0", () => {
    expect(axes).toHaveLength(4);
    expect(axes.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1.0, 5);
  });
  it("marks axis C as LLM and others as rule-based", () => {
    expect(axes.find((a) => a.axis === "C")!.scorer).toBe("LLM");
    expect(axes.find((a) => a.axis === "A")!.scorer).toBe("규칙");
  });
  it("lists axis C metric keys", () => {
    const c = axes.find((a) => a.axis === "C")!;
    expect(c.metrics.map((m) => m.key).sort()).toEqual(["clarity", "freshness_clarity", "key_info_present", "product_depth"]);
  });
});
```

- [ ] **Step 2: 구현**

`packages/web/src/lib/methodology.ts`:
```ts
import type { Axis } from "@ai-benchmark/core";
import { loadWeights } from "@ai-benchmark/core";

export interface AxisInfo {
  axis: Axis;
  weight: number;
  label: string;
  metrics: { key: string; weight: number }[];
  scorer: "규칙" | "LLM";
}

const LABELS: Record<Axis, string> = { A: "크롤링/접근성", B: "구조화/시맨틱", C: "콘텐츠 품질", D: "응답성/기술위생" };

export function loadMethodology(weightsPath: string): AxisInfo[] {
  const w = loadWeights(weightsPath);
  const axes: Axis[] = ["A", "B", "C", "D"];
  return axes.map((axis) => ({
    axis,
    weight: w.axes[axis],
    label: LABELS[axis],
    metrics: Object.entries(w.metrics[axis] ?? {}).map(([key, weight]) => ({ key, weight })),
    scorer: axis === "C" ? "LLM" : "규칙",
  }));
}
```

`packages/web/src/app/methodology/page.tsx`:
```tsx
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { loadMethodology } from "../../lib/methodology.js";

export default function MethodologyPage() {
  const root = resolve(process.cwd(), "../..");
  const axes = loadMethodology(resolve(root, "config/weights.yaml"));
  const rubric = readFileSync(resolve(root, "config/rubric/rubric_v1.md"), "utf8");
  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-semibold">평가 방법론</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--muted)" }}>
        아래 가중치·지표는 실제 채점에 쓰인 <span className="mono">config/weights.yaml</span>을 그대로 읽어 표시합니다.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {axes.map((a) => (
          <div key={a.axis} className="panel p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display font-semibold">{a.axis}. {a.label}</h2>
              <span className="mono text-sm" style={{ color: "var(--signal)" }}>{Math.round(a.weight * 100)}% · {a.scorer}</span>
            </div>
            <ul className="space-y-1">
              {a.metrics.map((m) => (
                <li key={m.key} className="mono flex justify-between text-xs" style={{ color: "var(--muted)" }}>
                  <span>{m.key}</span><span>{Math.round(m.weight * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="panel mt-6 p-4">
        <h2 className="mb-2 font-display text-sm" style={{ color: "var(--muted)" }}>축 C 루브릭</h2>
        <pre className="mono whitespace-pre-wrap text-xs" style={{ color: "var(--text)" }}>{rubric}</pre>
      </div>
    </div>
  );
}
```

`packages/web/scripts/seed.ts` (선택 데모 시드 — importScan 재사용):
```ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { importScan, importModelScores } from "@ai-benchmark/db";
import { fixtureCompanies } from "../src/lib/data/fixtures.js";

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  const client = createClient(url, key);
  const now = new Date().toISOString();
  for (const c of fixtureCompanies()) {
    const rule = c.scores.filter((s) => s.model === "rule-based");
    const llm = c.scores.filter((s) => s.model !== "rule-based");
    await importScan(client, { name: c.name, slug: c.slug, homepageUrl: c.homepageUrl, isSelf: c.isSelf, category: c.category }, {
      scannedAt: now, rubricVersion: "rubric_v1", scores: rule, improvements: [],
    });
    const byModel = new Map<string, typeof llm>();
    for (const s of llm) { const a = byModel.get(s.model) ?? []; a.push(s); byModel.set(s.model, a); }
    for (const [, scores] of byModel) await importModelScores(client, c.slug, scores);
  }
  console.log("seeded fixtures");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
```
루트 `package.json`에 스크립트 추가:
```json
"web:seed": "tsx packages/web/scripts/seed.ts"
```

- [ ] **Step 3: 통과 + 빌드 + 전체 시각 검증**

Run: `pnpm test`
Expected: 79 + methodology 3 = 82 PASS.
Run: `pnpm --filter @ai-benchmark/web build` (성공)
Run: `pnpm test` (전체 회귀), `pnpm typecheck`(라이브러리 tsc -b, exit 0 — web은 미포함), `pnpm --filter @ai-benchmark/web run typecheck`(web tsc --noEmit).
**시각 검증(5개 화면 전체):** `/`, `/company/our-company`, `/compare`, `/models`, `/methodology` 순회. 모바일 폭에서 레이아웃·수평 스크롤 없음, 키보드 포커스 가시, reduced-motion 스캔라인 없음.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat(web): methodology screen from config + optional seed script

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 결과 (작성자 확인)

**1. 스펙 커버리지 (Plan 3 = 스펙 §7 5개 화면):**
- 화면1 종합 순위(모델 토글·우리회사 강조·업계평균 대비) → Task 6 ✅
- 화면2 기업 상세(레이더 모델 오버레이·지표 evidence) → Task 7 ✅
- 화면3 우리 vs 경쟁사(뒤처지는 지표 자동 추출) → Task 8 ✅
- 화면4 모델 비교(Claude vs GPT diff) → Task 8 ✅
- 화면5 방법론(weights.yaml·루브릭 단일 출처 렌더) → Task 9 ✅
- 모델 평균 뷰 + 모델별 뷰 → core 재사용(Task 2·5·6·7) ✅
- 점수 색 단일 출처·모노스페이스 데이터 모티프·반응형·reduced-motion → Task 1·4 ✅

**2. Placeholder 스캔:** 코드 스텝 완전. placeholder·트랩 없음(초안에 잘못 들어간 `challenge` 토큰은 제거됨).

**3. 타입 일관성:** `CompanyRecord`(types) → provider → build/metricRows/compare → 컴포넌트 전 구간 정합. core `ScoreView`/`axisForView`/`overallForView`/`collapseForView` 시그니처 일치. web은 루트 tsc -b 미포함(별도 next/tsc). config 경로는 `process.cwd()`(packages/web) 기준 `../../config/…`로 통일.

**Plan 3 범위 밖(후속/운영):** 실제 기업 리스트·실제 채점 실행, 축 C 개선항목, 시계열 추세 UI, 인증.
