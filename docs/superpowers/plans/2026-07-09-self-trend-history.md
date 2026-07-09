# 자사 추이(히스토리) 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `gen-measured` 실행마다 전 회사 스냅샷을 `snapshots/<날짜>.json`으로 아카이브하고, 웹에 자사 단독 추이 차트(`/trend`)를 추가한다.

**Architecture:** 원본 `CompanyRecord[]`를 날짜별 JSON으로 저장(파생 아님) → 웹이 빌드타임에 fs로 읽어 core 함수(`overallForView`/`axisForView`)로 자사 종합·축별 점수를 파생 → recharts 라인 차트. 집계는 항상 현재 weights 기준이라 추이가 일관된 잣대로 비교된다.

**Tech Stack:** TypeScript(ESM, NodeNext `.js` import), Node ≥20, pnpm 워크스페이스, Next 14 App Router(React 18), recharts(설치됨), vitest.

## Global Constraints

- ESM 모듈. 내부 상대 import는 `.js` 확장자 사용(예: `./snapshot.js`, `../lib/data/history.js`).
- 점수 집계는 core의 `overallForView(scores, w, view)` / `axisForView(scores, axis, w, view)` 재사용. 직접 재구현 금지.
- `ScoreView = "average" | { model: string }`. 추이 차트는 `"average"` 뷰 고정.
- `Axis = "A" | "B" | "C" | "D"`.
- 루브릭 버전 문자열: `"rubric_v1"`.
- 스냅샷 저장 위치: 저장소 루트 `snapshots/<YYYY-MM-DD>.json`. `.gitignore`에 없으므로 커밋 대상.
- 빌드타임 파일 경로는 `process.cwd()`(=`packages/web`) 기준: config는 `../../config/...`, 스냅샷은 `../../snapshots`.
- 모든 UI 문구는 한국어.
- 테스트 파일은 대상과 같은 디렉터리에 `*.test.ts`(레포 관례). `vitest run`은 저장소 루트에서 실행되어 `process.cwd()`가 루트다.
- 커밋 메시지 말미에 다음 트레일러 포함:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: 스냅샷 파일 빌더 (순수 함수)

**Files:**
- Create: `packages/scoring/src/snapshot.ts`
- Create: `packages/scoring/src/snapshot.test.ts`
- Modify: `packages/scoring/src/index.ts` (export 추가)

**Interfaces:**
- Produces:
  - `interface SnapshotFile<T> { date: string; generatedAt: string; rubricVersion: string; companies: T[] }`
  - `buildSnapshotFile<T>(companies: T[], meta: { date: string; generatedAt: string; rubricVersion: string }): SnapshotFile<T>`
  - `snapshotFilename(date: string): string` → `"<date>.json"`
  - `localDateString(d: Date): string` → 로컬 타임존 기준 `"YYYY-MM-DD"`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/scoring/src/snapshot.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSnapshotFile, snapshotFilename, localDateString } from "./snapshot.js";

describe("buildSnapshotFile", () => {
  it("메타와 companies를 스냅샷 객체로 합친다", () => {
    const companies = [{ slug: "parameta", isSelf: true }];
    const out = buildSnapshotFile(companies, {
      date: "2026-07-09",
      generatedAt: "2026-07-09T03:00:00.000Z",
      rubricVersion: "rubric_v1",
    });
    expect(out).toEqual({
      date: "2026-07-09",
      generatedAt: "2026-07-09T03:00:00.000Z",
      rubricVersion: "rubric_v1",
      companies,
    });
    // companies 참조를 그대로 전달(복사 아님)
    expect(out.companies).toBe(companies);
  });
});

describe("snapshotFilename", () => {
  it("날짜에 .json 확장자를 붙인다", () => {
    expect(snapshotFilename("2026-07-09")).toBe("2026-07-09.json");
  });
});

describe("localDateString", () => {
  it("로컬 연-월-일을 0패딩된 YYYY-MM-DD로 만든다", () => {
    // 로컬 타임존 기준 생성자(연, 월index, 일)
    expect(localDateString(new Date(2026, 6, 9))).toBe("2026-07-09");
    expect(localDateString(new Date(2026, 11, 1))).toBe("2026-12-01");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run packages/scoring/src/snapshot.test.ts`
Expected: FAIL — `Cannot find module './snapshot.js'`

- [ ] **Step 3: 구현 작성**

`packages/scoring/src/snapshot.ts`:
```ts
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
```

- [ ] **Step 4: index export 추가**

`packages/scoring/src/index.ts` 끝에 한 줄 추가:
```ts
export * from "./snapshot.js";
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm vitest run packages/scoring/src/snapshot.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add packages/scoring/src/snapshot.ts packages/scoring/src/snapshot.test.ts packages/scoring/src/index.ts
git commit -m "$(cat <<'EOF'
feat(scoring): 스냅샷 파일 빌더(buildSnapshotFile/snapshotFilename/localDateString)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: gen-measured에서 날짜별 스냅샷 기록 + 백필

**Files:**
- Modify: `packages/scoring/scripts/gen-measured.ts`

**Interfaces:**
- Consumes: Task 1의 `buildSnapshotFile`, `snapshotFilename`, `localDateString` (from `../src/index.js`).
- 산출물: 실행 시 `snapshots/<date>.json` 파일 생성/덮어쓰기.

- [ ] **Step 1: import에 `mkdirSync`와 신규 함수 추가**

`packages/scoring/scripts/gen-measured.ts`의 fs import를 수정:
```ts
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
```
그리고 scoring index import에 함수 3개를 추가:
```ts
import {
  parseAndValidate, toLlmScores, loadLlmMetrics, llmAxisByKey,
  buildSnapshotFile, snapshotFilename, localDateString,
} from "../src/index.js";
```

- [ ] **Step 2: measured.ts 기록 직후 스냅샷 기록 블록 추가**

`writeFileSync(resolve(root, "packages/web/src/lib/data/measured.ts"), banner + body);` 다음 줄에 추가:
```ts
// 날짜별 전 회사 스냅샷 아카이브. --date=YYYY-MM-DD 로 날짜 지정(백필용), 없으면 오늘.
const RUBRIC_VERSION = "rubric_v1";
const dateArg = process.argv.find((a) => a.startsWith("--date="));
const snapshotDate = dateArg ? dateArg.slice("--date=".length) : localDateString(new Date());
const snapshotsDir = resolve(root, "snapshots");
mkdirSync(snapshotsDir, { recursive: true });
const snapshot = buildSnapshotFile(records, {
  date: snapshotDate,
  generatedAt: new Date().toISOString(),
  rubricVersion: RUBRIC_VERSION,
});
writeFileSync(
  resolve(snapshotsDir, snapshotFilename(snapshotDate)),
  JSON.stringify(snapshot, null, 2),
);
console.log(`wrote snapshots/${snapshotFilename(snapshotDate)} (${records.length} companies)`);
```

- [ ] **Step 3: 백필 실행 — 현재 데이터를 2026-07-08 첫 점으로**

Run: `pnpm exec tsx packages/scoring/scripts/gen-measured.ts --date=2026-07-08`
Expected: stdout에 `wrote snapshots/2026-07-08.json (N companies)` 출력.
검증: `test -f snapshots/2026-07-08.json && node -e "const s=require('./snapshots/2026-07-08.json'); if(s.date!=='2026-07-08'||!Array.isArray(s.companies)||!s.companies.some(c=>c.isSelf)) throw new Error('bad snapshot'); console.log('ok', s.companies.length)"`
Expected: `ok N` (N ≥ 1, 자사 레코드 포함)

- [ ] **Step 4: 오늘 날짜 스냅샷 생성 — 두 번째 점**

Run: `pnpm exec tsx packages/scoring/scripts/gen-measured.ts`
Expected: `wrote snapshots/2026-07-09.json (N companies)` (오늘 날짜; 실행일이 다르면 그 날짜).
검증: `ls snapshots/` 에 최소 2개의 `*.json` 존재.

- [ ] **Step 5: 커밋 (스크립트 + 스냅샷 데이터)**

```bash
git add packages/scoring/scripts/gen-measured.ts snapshots/
git commit -m "$(cat <<'EOF'
feat(scoring): gen-measured가 snapshots/<date>.json 아카이브 기록(--date 백필)

전 회사 원본 CompanyRecord[]를 날짜별로 저장. 2026-07-08 백필 + 당일 점 포함.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 웹 읽기 레이어 (history.ts)

**Files:**
- Create: `packages/web/src/lib/data/history.ts`
- Create: `packages/web/src/lib/data/history.test.ts`

**Interfaces:**
- Consumes: `CompanyRecord`(`./types.js`), core의 `overallForView`/`axisForView`, 타입 `Axis`/`Weights`/`ScoreView`.
- Produces:
  - `interface DaySnapshot { date: string; companies: CompanyRecord[] }`
  - `type SnapshotHistory = DaySnapshot[]` (date 오름차순)
  - `interface TrendPoint { date: string; overall: number | null; A: number | null; B: number | null; C: number | null; D: number | null }`
  - `loadSnapshotHistory(dir: string): SnapshotHistory`
  - `buildSelfTrend(history: SnapshotHistory, w: Weights, view: ScoreView): TrendPoint[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/web/src/lib/data/history.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { loadSnapshotHistory, buildSelfTrend } from "./history.js";
import { overallForView, axisForView } from "@ai-benchmark/core";
import type { CompanyRecord } from "./types.js";

const weights = loadWeights(resolve(process.cwd(), "config/weights.yaml"));

function selfRecord(): CompanyRecord {
  return {
    slug: "parameta",
    name: "파라메타",
    homepageUrl: "https://example.com",
    isSelf: true,
    scores: [{ axis: "A", metricKey: "robots_allowed", model: "rule-based", score: 100 }],
  };
}

describe("loadSnapshotHistory", () => {
  it("없는 디렉터리는 빈 배열", () => {
    expect(loadSnapshotHistory(resolve(tmpdir(), "definitely-missing-xyz"))).toEqual([]);
  });

  it("날짜 오름차순 정렬 + 깨진 파일 skip", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "snap-"));
    writeFileSync(resolve(dir, "2026-07-09.json"), JSON.stringify({ date: "2026-07-09", companies: [] }));
    writeFileSync(resolve(dir, "2026-07-08.json"), JSON.stringify({ date: "2026-07-08", companies: [] }));
    writeFileSync(resolve(dir, "broken.json"), "{ not json");
    writeFileSync(resolve(dir, "no-date.json"), JSON.stringify({ companies: [] }));
    const hist = loadSnapshotHistory(dir);
    expect(hist.map((d) => d.date)).toEqual(["2026-07-08", "2026-07-09"]);
  });
});

describe("buildSelfTrend", () => {
  it("자사 레코드의 종합/축 점수를 core로 파생한다", () => {
    const self = selfRecord();
    const hist = [{ date: "2026-07-08", companies: [self] }];
    const trend = buildSelfTrend(hist, weights, "average");
    expect(trend).toHaveLength(1);
    expect(trend[0].date).toBe("2026-07-08");
    expect(trend[0].overall).toBe(overallForView(self.scores, weights, "average"));
    expect(trend[0].A).toBe(axisForView(self.scores, "A", weights, "average"));
  });

  it("자사 레코드가 없는 날은 제외한다", () => {
    const other: CompanyRecord = { ...selfRecord(), slug: "x", isSelf: false };
    const hist = [{ date: "2026-07-08", companies: [other] }];
    expect(buildSelfTrend(hist, weights, "average")).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run packages/web/src/lib/data/history.test.ts`
Expected: FAIL — `Cannot find module './history.js'`

- [ ] **Step 3: 구현 작성**

`packages/web/src/lib/data/history.ts`:
```ts
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
    if (!self) continue;
    const [a, b, c, d] = axes.map((ax) => axisForView(self.scores, ax, w, view));
    out.push({
      date: day.date,
      overall: overallForView(self.scores, w, view),
      A: a, B: b, C: c, D: d,
    });
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run packages/web/src/lib/data/history.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add packages/web/src/lib/data/history.ts packages/web/src/lib/data/history.test.ts
git commit -m "$(cat <<'EOF'
feat(web): 스냅샷 히스토리 읽기·자사 추이 파생(history.ts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 추이 차트 컴포넌트 (SelfTrendView)

**Files:**
- Create: `packages/web/src/components/SelfTrendView.tsx`

**Interfaces:**
- Consumes: `TrendPoint`(`../lib/data/history.js`), `Axis`(core), `AXIS_INFO`(`../lib/glossary.js`).
- Produces: `SelfTrendView({ trend }: { trend: TrendPoint[] })` — 기본 export 아님, named export.

- [ ] **Step 1: 컴포넌트 작성**

`packages/web/src/components/SelfTrendView.tsx`:
```tsx
"use client";
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Axis } from "@ai-benchmark/core";
import { AXIS_INFO } from "../lib/glossary.js";
import type { TrendPoint } from "../lib/data/history.js";

type Metric = "overall" | Axis;

const METRICS: { key: Metric; label: string }[] = [
  { key: "overall", label: "종합" },
  { key: "A", label: AXIS_INFO.A.label },
  { key: "B", label: AXIS_INFO.B.label },
  { key: "C", label: AXIS_INFO.C.label },
  { key: "D", label: AXIS_INFO.D.label },
];

export function SelfTrendView({ trend }: { trend: TrendPoint[] }) {
  const [metric, setMetric] = useState<Metric>("overall");

  if (trend.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold tracking-tight">자사 추이</h1>
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          아직 추이 데이터가 없습니다. 다음을 1회 이상 실행하세요:
          <code className="mono ml-1">pnpm exec tsx packages/scoring/scripts/gen-measured.ts</code>
        </p>
      </section>
    );
  }

  const label = METRICS.find((m) => m.key === metric)!.label;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">자사 추이</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        측정 시점별 자사(파라메타) 점수 변화. 항상 현재 평가 기준으로 재계산됩니다.
      </p>

      <div className="mt-6 inline-flex rounded-md border" style={{ borderColor: "var(--line)" }} role="tablist">
        {METRICS.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={metric === m.key}
            onClick={() => setMetric(m.key)}
            className="mono px-3 py-1.5 text-xs"
            style={{
              background: metric === m.key ? "var(--signal)" : "transparent",
              color: metric === m.key ? "#0e1116" : "var(--muted)",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {trend.length === 1 && (
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          측정이 1회뿐입니다. 추이 선은 2회차 측정부터 그려집니다.
        </p>
      )}

      <div className="mt-6">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "var(--bg)", border: "1px solid var(--line)", fontSize: 12 }}
              formatter={(v: number | null) => [v ?? "—", label]}
            />
            <Line
              type="monotone"
              dataKey={metric}
              name={label}
              stroke="var(--signal)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `pnpm --filter @ai-benchmark/web typecheck`
Expected: 에러 없음(exit 0). (컴포넌트는 Task 5의 page에서 소비되지만, 단독으로도 타입 성립해야 함.)

- [ ] **Step 3: 커밋**

```bash
git add packages/web/src/components/SelfTrendView.tsx
git commit -m "$(cat <<'EOF'
feat(web): 자사 추이 라인 차트 컴포넌트(SelfTrendView, 종합·축별 토글)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: /trend 페이지 + 네비 탭

**Files:**
- Create: `packages/web/src/app/trend/page.tsx`
- Modify: `packages/web/src/app/layout.tsx` (nav 배열에 항목 추가)

**Interfaces:**
- Consumes: `loadSnapshotHistory`/`buildSelfTrend`(`../../lib/data/history.js`), `SelfTrendView`(`../../components/SelfTrendView.js`), `loadWeights`(core).

- [ ] **Step 1: 페이지 작성**

`packages/web/src/app/trend/page.tsx`:
```tsx
import { resolve } from "node:path";
import { loadWeights } from "@ai-benchmark/core";
import { loadSnapshotHistory, buildSelfTrend } from "../../lib/data/history.js";
import { SelfTrendView } from "../../components/SelfTrendView.js";

export default function TrendPage() {
  const weights = loadWeights(resolve(process.cwd(), "../../config/weights.yaml"));
  const history = loadSnapshotHistory(resolve(process.cwd(), "../../snapshots"));
  const trend = buildSelfTrend(history, weights, "average");
  return <SelfTrendView trend={trend} />;
}
```

- [ ] **Step 2: 네비 탭 추가**

`packages/web/src/app/layout.tsx`의 nav 배열에서 `자사 개선 방향` 다음 줄에 항목을 추가:
```tsx
  { href: "/", label: "순위" },
  { href: "/improvement", label: "자사 개선 방향" },
  { href: "/trend", label: "자사 추이" },
  { href: "/methodology", label: "평가 기준·방식" },
```

- [ ] **Step 3: 빌드로 통합 검증**

Run: `pnpm --filter @ai-benchmark/web build`
Expected: 빌드 성공. 출력 라우트 목록에 `/trend` 포함.

- [ ] **Step 4: 개발 서버 수동 확인(선택)**

Run: `pnpm web:dev` 후 브라우저에서 `http://localhost:3000/trend` 접속.
Expected: "자사 추이" 제목, 종합/축 토글, 2개 날짜(07-08, 07-09) 라인. 토글 전환 시 축별 값으로 선이 바뀜.

- [ ] **Step 5: 커밋**

```bash
git add packages/web/src/app/trend/page.tsx packages/web/src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(web): /trend 페이지·'자사 추이' 네비 탭 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 최종 검증

- [ ] `pnpm test` — 전체 테스트 통과(신규 snapshot/history 테스트 포함).
- [ ] `pnpm typecheck` — 전 패키지 타입 통과.
- [ ] `pnpm --filter @ai-benchmark/web build` — 빌드 성공, `/trend` 라우트 생성.
- [ ] `snapshots/`에 `2026-07-08.json`, `2026-07-09.json`(실행일) 커밋됨.

## Self-Review 결과 (작성자 확인)

- **스펙 커버리지:** 아카이브(Task 1·2) / 백필(Task 2 Step 3) / 읽기 레이어(Task 3) / 차트·빈·단일 상태(Task 4) / 라우트·nav(Task 5) / 테스트(Task 1·3) — 스펙 산출물 목록 전부 대응.
- **플레이스홀더:** 없음(모든 스텝에 실제 코드/명령/기대출력 포함).
- **타입 일관성:** `buildSnapshotFile`/`snapshotFilename`/`localDateString`(Task1) → gen-measured 소비(Task2), `TrendPoint`/`loadSnapshotHistory`/`buildSelfTrend`(Task3) → 컴포넌트·페이지 소비(Task4·5) 시그니처 일치. `ScoreView="average"`, `Axis` 키 A/B/C/D 일관.
- **경로 일관성:** 빌드타임 `process.cwd()`(=packages/web) 기준 `../../snapshots`·`../../config`, 테스트는 루트 cwd 기준 `config/weights.yaml` — 코드베이스 기존 패턴과 일치.
