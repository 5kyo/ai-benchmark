# 경쟁사 변화 감지("변화 소식") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재측정 시 직전 측정 대비 경쟁사 홈페이지의 콘텐츠·점수·순위 변화를 감지해 CLI·JSON 기록·마크다운 리포트·대시보드 "변화 소식" 페이지로 전달한다.

**Architecture:** gen-measured가 콘텐츠 지문을 `snapshots/content/<date>/<slug>.json`으로 아카이브 → `pnpm detect-changes`가 두 시점을 순수함수로 비교해 `changes/<date>.json` + `scoring/changes-inbox/` 생성 → Claude Code 요약 → `pnpm import-change-summaries`가 summary 병합 + `reports/changes/<date>.md` 생성 → 웹은 빌드타임 fs로 `changes/*.json`을 읽어 `/changes` 타임라인 렌더.

**Tech Stack:** TypeScript(ESM), cheerio, node:crypto, vitest, Next.js(정적 export), 기존 워크스페이스 패키지(@ai-benchmark/core·crawler·scoring·web).

**스펙:** `docs/superpowers/specs/2026-07-22-competitor-change-detection-design.md` (이 계획의 JSON 필드 구조는 스펙 예시를 평탄화한 확정본이다 — entry에 `overall`/`axes`/`rank`/`metrics`/`content`를 최상위 필드로 둔다.)

## Global Constraints

- 점수 변화 임계값: 종합·축·규칙지표 |Δ| ≥ **3** (반올림 정수 기준). 본문 변경률 ≥ **1%**. 상수는 `THRESHOLDS` 객체 하나로만 정의.
- LLM 호출 없음 — 요약은 사용자가 Claude Code로 수행하는 로컬 배치(inbox/outbox 패턴).
- `changes/<date>.json`에는 **당시 계산된 delta를 저장**한다(/trend의 "파생값 저장 안 함" 원칙의 의도적 예외 — 기록물이므로 소급 변경 금지).
- 커밋 대상: `snapshots/content/`, `changes/`, `reports/changes/`. **비커밋**: `scoring/changes-inbox|outbox` — 루트 `.gitignore`의 기존 `/scoring/` 규칙이 이미 커버하므로 `.gitignore` 수정 불필요.
- 파일·주석은 기존 관례(한국어 주석, ESM `.js` import 확장자, `*.test.ts` vitest)를 따른다.
- 모든 테스트 실행은 레포 루트에서 `pnpm test`(vitest run) 또는 `pnpm exec vitest run <파일> `.

---

### Task 1: 콘텐츠 지문 모듈 (`fingerprint.ts`)

**Files:**
- Create: `packages/scoring/src/fingerprint.ts`
- Create: `packages/scoring/src/fingerprint.test.ts`
- Modify: `packages/scoring/src/index.ts` (export 한 줄 추가)

**Interfaces:**
- Consumes: `extractText(html)` (`packages/scoring/src/text.ts`), cheerio, node:crypto.
- Produces: `interface Heading { level: number; text: string }`, `interface Fingerprint { slug; date; url; title; metaDescription; headings: Heading[]; text; textHash }`, `extractFingerprint(html: string, meta: { slug: string; date: string; url: string }): Fingerprint`. Task 2(gen-measured)·Task 3(diffContent)·Task 6(CLI)이 이 타입/함수를 그대로 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/scoring/src/fingerprint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractFingerprint } from "./fingerprint.js";

const HTML = `<!doctype html><html><head><title> Acme —  Web3 </title>
<meta name="description" content="  블록체인   인프라  ">
</head><body>
<h1>Acme</h1>
<h2>제품 <span>소개</span></h2>
<h3>   </h3>
<script>ignored()</script>
<p>우리는 인프라를 만든다.</p>
</body></html>`;

describe("extractFingerprint", () => {
  it("title·메타·헤딩·본문·해시를 추출한다", () => {
    const fp = extractFingerprint(HTML, { slug: "acme", date: "2026-07-22", url: "https://acme.io/" });
    expect(fp.slug).toBe("acme");
    expect(fp.date).toBe("2026-07-22");
    expect(fp.url).toBe("https://acme.io/");
    expect(fp.title).toBe("Acme — Web3");
    expect(fp.metaDescription).toBe("블록체인 인프라");
    expect(fp.headings).toEqual([
      { level: 1, text: "Acme" },
      { level: 2, text: "제품 소개" },
    ]);
    expect(fp.text).toContain("우리는 인프라를 만든다.");
    expect(fp.text).not.toContain("ignored");
    expect(fp.textHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("본문이 다르면 해시가 다르고, 같으면 같다", () => {
    const a = extractFingerprint(HTML, { slug: "a", date: "d", url: "u" });
    const a2 = extractFingerprint(HTML, { slug: "a", date: "d", url: "u" });
    const b = extractFingerprint(HTML.replace("만든다", "만들었다"), { slug: "a", date: "d", url: "u" });
    expect(a.textHash).toBe(a2.textHash);
    expect(a.textHash).not.toBe(b.textHash);
  });

  it("빈/비정상 HTML도 관용적으로 처리한다", () => {
    const fp = extractFingerprint("<div>hi", { slug: "x", date: "d", url: "u" });
    expect(fp.title).toBe("");
    expect(fp.metaDescription).toBe("");
    expect(fp.headings).toEqual([]);
    expect(fp.text).toBe("hi");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run packages/scoring/src/fingerprint.test.ts`
Expected: FAIL — `Cannot find module './fingerprint.js'` 류.

- [ ] **Step 3: 구현**

`packages/scoring/src/fingerprint.ts`:

```ts
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { extractText } from "./text.js";

export interface Heading {
  level: number;
  text: string;
}

/** 한 회사·한 시점의 콘텐츠 지문 — 변화 감지(diffContent)의 비교 재료. */
export interface Fingerprint {
  slug: string;
  date: string;
  url: string;
  title: string;
  metaDescription: string;
  headings: Heading[];
  text: string;
  textHash: string;
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function extractFingerprint(
  html: string,
  meta: { slug: string; date: string; url: string },
): Fingerprint {
  const $ = cheerio.load(html);
  const title = norm($("head title").first().text() || "");
  const metaDescription = norm($('meta[name="description"]').attr("content") ?? "");
  const headings: Heading[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = norm($(el).text());
    if (text) headings.push({ level: Number(el.tagName.slice(1)), text });
  });
  const text = extractText(html);
  const textHash = createHash("sha256").update(text).digest("hex");
  return { slug: meta.slug, date: meta.date, url: meta.url, title, metaDescription, headings, text, textHash };
}
```

`packages/scoring/src/index.ts`에 추가:

```ts
export * from "./fingerprint.js";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run packages/scoring/src/fingerprint.test.ts`
Expected: PASS (3 tests). `el.tagName`이 타입 오류를 내면 `(el as { tagName: string }).tagName` 대신 `el.name`(domhandler Element)으로 교체.

- [ ] **Step 5: 커밋**

```bash
git add packages/scoring/src/fingerprint.ts packages/scoring/src/fingerprint.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): 콘텐츠 지문 추출 모듈(extractFingerprint)"
```

---

### Task 2: gen-measured 지문 아카이브 + 기준선 백필

**Files:**
- Modify: `packages/scoring/scripts/gen-measured.ts`

**Interfaces:**
- Consumes: Task 1의 `extractFingerprint` (`../src/index.js` 경유).
- Produces: `snapshots/content/<date>/<slug>.json` 파일(Fingerprint JSON). Task 6의 `loadFingerprints`가 이 경로·형식을 읽는다.

- [ ] **Step 1: gen-measured.ts 수정**

날짜 계산을 파일 상단(회사 루프 이전)으로 옮기고, 루프 안에서 지문을 기록한다. 수정 후 전체 흐름:

(a) import에 `extractFingerprint` 추가:

```ts
import {
  parseAndValidate, toLlmScores, loadLlmMetrics, llmAxisByKey,
  buildSnapshotFile, snapshotFilename, localDateString, extractFingerprint,
} from "../src/index.js";
```

(b) `const records = companies.map(...)` **위**에 날짜·디렉터리 준비를 이동/추가 (기존 파일 하단의 `RUBRIC_VERSION`/`dateArg`/`snapshotDate` 선언을 이 위치로 옮긴다 — 하단에 중복 선언을 남기지 않는다):

```ts
// 날짜별 아카이브 키. --date=YYYY-MM-DD 로 지정(백필용), 없으면 오늘.
const RUBRIC_VERSION = "rubric_v1";
const dateArg = process.argv.find((a) => a.startsWith("--date="));
const snapshotDate = dateArg ? dateArg.slice("--date=".length) : localDateString(new Date());
const snapshotsDir = resolve(root, "snapshots");
// 콘텐츠 지문 아카이브: 변화 감지(detect-changes)의 비교 재료.
const contentDir = resolve(snapshotsDir, "content", snapshotDate);
mkdirSync(contentDir, { recursive: true });
let fingerprintCount = 0;
```

(c) 기존 records 루프의 `if (latest) { ... scores.push(...scoreRules(snap)); }` 블록 안에 지문 기록 추가:

```ts
    if (latest) {
      const snap = JSON.parse(readFileSync(resolve(rawDir, latest), "utf8")) as RawSnapshot;
      scores.push(...scoreRules(snap));
      if (snap.homepage && snap.homepage.status === 200) {
        const fp = extractFingerprint(snap.homepage.body, {
          slug: c.slug, date: snapshotDate, url: c.homepageUrl,
        });
        writeFileSync(resolve(contentDir, `${c.slug}.json`), JSON.stringify(fp, null, 2));
        fingerprintCount += 1;
      }
    }
```

(d) 파일 하단 스냅샷 기록부는 상단으로 옮긴 선언들을 빼고 그대로 두고, 마지막에 로그 한 줄 추가:

```ts
console.log(`wrote snapshots/content/${snapshotDate}/ (${fingerprintCount} fingerprints)`);
```

- [ ] **Step 2: 기준선 백필 실행으로 검증**

raw/는 2026-07-08 크롤 데이터이므로, 기존 스냅샷 날짜(2026-07-09)에 맞춰 백필한다(오늘 날짜로 실행하면 가짜 07-22 스냅샷이 생기므로 금지):

Run: `pnpm exec tsx packages/scoring/scripts/gen-measured.ts --date=2026-07-09`
Expected 출력: `wrote measured.ts ...`, `wrote snapshots/2026-07-09.json (13 companies)`, `wrote snapshots/content/2026-07-09/ (13 fingerprints)`

검증:
- `ls snapshots/content/2026-07-09/ | wc -l` → 13
- `git diff --stat snapshots/2026-07-09.json` → generatedAt 외 내용 변화 없음(있다면 outbox/raw 상태가 달라진 것 — 중단하고 diff 내용을 사용자에게 보고)
- `git diff --stat packages/web/src/lib/data/measured.ts` → 동일 기준(내용 변화 없어야 정상)

- [ ] **Step 3: 커밋**

```bash
git add packages/scoring/scripts/gen-measured.ts snapshots/content/
git checkout -- snapshots/2026-07-09.json packages/web/src/lib/data/measured.ts
git commit -m "feat(scoring): gen-measured가 콘텐츠 지문을 snapshots/content/<date>/에 아카이브 + 07-09 기준선 백필"
```

(주: `git checkout --`은 generatedAt만 바뀐 재생성 파일을 되돌리는 것. 내용 변화가 있었다면 되돌리지 말고 보고.)

---

### Task 3: 순수 diff 로직 (`detect.ts`)

**Files:**
- Create: `packages/scoring/src/detect.ts`
- Create: `packages/scoring/src/detect.test.ts`
- Modify: `packages/scoring/src/index.ts` (export 한 줄 추가)

**Interfaces:**
- Consumes: core `overallForView/axisForView/RULE_MODEL`, `Axis/MetricScore/Weights`, Task 1의 `Fingerprint`.
- Produces (Task 4·5·6·7이 사용):
  - `type ChangeKind = "content" | "score" | "rank" | "new" | "removed"`
  - `interface ScoreDelta { from: number; to: number }`, `interface AxisDelta extends ScoreDelta { axis: Axis }`
  - `interface MetricChange { axis: Axis; metricKey: string; from: number; to: number; evidence?: string }`
  - `interface ContentChange { titleChanged; titleFrom?; titleTo?; metaChanged; headingsAdded: string[]; headingsRemoved: string[]; textChangedPct: number }`
  - `interface ChangeEntry { slug; name; kinds: ChangeKind[]; overall?: ScoreDelta; axes?: AxisDelta[]; rank?: ScoreDelta; metrics?: MetricChange[]; content?: ContentChange; summary: string | null }`
  - `interface ChangesFile { date; fromDate; generatedAt; entries: ChangeEntry[] }`
  - `interface CompanyLike { slug: string; name: string; scores: MetricScore[] }`
  - `const THRESHOLDS = { scoreDelta: 3, textChangedPct: 1 }`
  - `detectChanges(input: DetectInput): ChangesFile` (아래 시그니처)

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/scoring/src/detect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Axis, Weights } from "@ai-benchmark/core";
import type { Fingerprint } from "./fingerprint.js";
import {
  detectChanges, diffContent, diffScores, wordChangedPct, type CompanyLike,
} from "./detect.js";

const W: Weights = {
  axes: { A: 0.25, B: 0.25, C: 0.25, D: 0.25 },
  metrics: { A: { m1: 1 }, B: { m2: 1 }, C: { m3: 1 }, D: { m4: 1 } },
};
const AXIS_OF: Record<string, Axis> = { m1: "A", m2: "B", m3: "C", m4: "D" };

function co(slug: string, scores: Partial<Record<"m1" | "m2" | "m3" | "m4", number>>): CompanyLike {
  return {
    slug,
    name: slug.toUpperCase(),
    scores: Object.entries(scores).map(([k, v]) => ({
      axis: AXIS_OF[k], metricKey: k, model: "rule-based", score: v as number,
      evidence: `${k}=${v}`,
    })),
  };
}

function fp(over: Partial<Fingerprint>): Fingerprint {
  return {
    slug: "a", date: "d", url: "u", title: "T", metaDescription: "M",
    headings: [{ level: 1, text: "H" }],
    text: "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열", textHash: "hash-1",
    ...over,
  };
}

describe("diffScores", () => {
  it("종합·축 |Δ| < 3 이면 null", () => {
    expect(diffScores(co("a", { m1: 60, m2: 60, m3: 60, m4: 60 }),
      co("a", { m1: 62, m2: 62, m3: 62, m4: 62 }), W)).toBeNull();
  });
  it("임계값 이상이면 종합·축 delta 포함", () => {
    const d = diffScores(co("a", { m1: 60, m2: 60, m3: 60, m4: 60 }),
      co("a", { m1: 64, m2: 64, m3: 64, m4: 64 }), W);
    expect(d?.overall).toEqual({ from: 60, to: 64 });
    expect(d?.axes).toHaveLength(4);
  });
  it("축만 임계값을 넘고 종합은 못 넘으면 축만", () => {
    const d = diffScores(co("a", { m1: 60, m2: 60, m3: 60, m4: 60 }),
      co("a", { m1: 60, m2: 66, m3: 60, m4: 60 }), W); // 종합 60→61.5(반올림 62, Δ2)
    expect(d?.overall).toBeUndefined();
    expect(d?.axes).toEqual([{ axis: "B", from: 60, to: 66 }]);
  });
});

describe("wordChangedPct / diffContent", () => {
  it("해시 동일하면 변경률 0, title·헤딩도 같으면 null", () => {
    expect(diffContent(fp({}), fp({}))).toBeNull();
  });
  it("단어 변경률을 대칭차/합집합 %로 계산한다", () => {
    // from 10단어, to에서 1단어 교체 → 합집합 11, 대칭차 2 → 18.2%
    expect(wordChangedPct(
      "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열",
      "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 십",
    )).toBeCloseTo(18.2, 1);
  });
  it("헤딩 추가/삭제·title 변경을 감지한다", () => {
    const d = diffContent(
      fp({}),
      fp({ title: "T2", headings: [{ level: 1, text: "H2" }], textHash: "hash-1" }),
    );
    expect(d?.titleChanged).toBe(true);
    expect(d?.titleFrom).toBe("T");
    expect(d?.titleTo).toBe("T2");
    expect(d?.headingsAdded).toEqual(["H2"]);
    expect(d?.headingsRemoved).toEqual(["H"]);
    expect(d?.textChangedPct).toBe(0); // 해시 동일
  });
  it("변경률 1% 미만은 0으로 눌러 무시한다", () => {
    // 200 단어 중 1개 교체 → 대칭차 2/합집합 201 ≈ 0.995% < 1%
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`);
    const toWords = [...words.slice(0, 199), "changed"];
    const d = diffContent(
      fp({ text: words.join(" "), textHash: "h1" }),
      fp({ text: toWords.join(" "), textHash: "h2" }),
    );
    expect(d).toBeNull();
  });
});

describe("detectChanges", () => {
  const base = { fromDate: "2026-07-09", toDate: "2026-07-22", generatedAt: "2026-07-22T00:00:00.000Z" };

  it("변화 없으면 entries 빈 배열", () => {
    const c = co("a", { m1: 60, m2: 60, m3: 60, m4: 60 });
    const out = detectChanges({ ...base, from: [c], to: [c], fromFps: {}, toFps: {}, weights: W });
    expect(out).toEqual({ date: "2026-07-22", fromDate: "2026-07-09", generatedAt: base.generatedAt, entries: [] });
  });

  it("점수·순위 변화와 kinds를 기록한다", () => {
    const from = [co("a", { m1: 80, m2: 80, m3: 80, m4: 80 }), co("b", { m1: 70, m2: 70, m3: 70, m4: 70 })];
    const to = [co("a", { m1: 80, m2: 80, m3: 80, m4: 80 }), co("b", { m1: 85, m2: 85, m3: 85, m4: 85 })];
    const out = detectChanges({ ...base, from, to, fromFps: {}, toFps: {}, weights: W });
    const b = out.entries.find((e) => e.slug === "b");
    expect(b?.kinds).toEqual(["score", "rank"]);
    expect(b?.overall).toEqual({ from: 70, to: 85 });
    expect(b?.rank).toEqual({ from: 2, to: 1 });
    expect(b?.metrics?.map((m) => m.metricKey).sort()).toEqual(["m1", "m2", "m3", "m4"]);
    const a = out.entries.find((e) => e.slug === "a");
    expect(a?.kinds).toEqual(["rank"]); // 점수 그대로, 순위만 1→2
    expect(a?.rank).toEqual({ from: 1, to: 2 });
  });

  it("신규 편입·로스터 제외를 표기한다", () => {
    const out = detectChanges({
      ...base,
      from: [co("old", { m1: 50 })],
      to: [co("new", { m1: 50 })],
      fromFps: {}, toFps: {}, weights: W,
    });
    expect(out.entries.find((e) => e.slug === "new")?.kinds).toEqual(["new"]);
    expect(out.entries.find((e) => e.slug === "old")?.kinds).toEqual(["removed"]);
  });

  it("지문이 양쪽에 있어야 콘텐츠 diff를 수행한다", () => {
    const c = co("a", { m1: 60, m2: 60, m3: 60, m4: 60 });
    const out = detectChanges({
      ...base, from: [c], to: [c],
      fromFps: { a: fp({}) },
      toFps: { a: fp({ title: "T2", textHash: "hash-1" }) },
      weights: W,
    });
    expect(out.entries[0]?.kinds).toEqual(["content"]);
    expect(out.entries[0]?.content?.titleChanged).toBe(true);
    // 한쪽만 있으면 콘텐츠 diff 생략 → 변화 없음
    const out2 = detectChanges({
      ...base, from: [c], to: [c], fromFps: {}, toFps: { a: fp({}) }, weights: W,
    });
    expect(out2.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run packages/scoring/src/detect.test.ts`
Expected: FAIL — `Cannot find module './detect.js'`.

- [ ] **Step 3: 구현**

`packages/scoring/src/detect.ts`:

```ts
import type { Axis, MetricScore, Weights } from "@ai-benchmark/core";
import { overallForView, axisForView, RULE_MODEL } from "@ai-benchmark/core";
import type { Fingerprint } from "./fingerprint.js";

export type ChangeKind = "content" | "score" | "rank" | "new" | "removed";

export interface ScoreDelta { from: number; to: number }
export interface AxisDelta extends ScoreDelta { axis: Axis }
export interface MetricChange { axis: Axis; metricKey: string; from: number; to: number; evidence?: string }
export interface ContentChange {
  titleChanged: boolean;
  titleFrom?: string;
  titleTo?: string;
  metaChanged: boolean;
  headingsAdded: string[];
  headingsRemoved: string[];
  textChangedPct: number;
}
export interface ChangeEntry {
  slug: string;
  name: string;
  kinds: ChangeKind[];
  overall?: ScoreDelta;
  axes?: AxisDelta[];
  rank?: ScoreDelta;
  metrics?: MetricChange[];
  content?: ContentChange;
  summary: string | null;
}
/** 변화 기록물 — 당시 계산된 delta를 그대로 저장한다(weights 변경 시에도 소급 변경 없음). */
export interface ChangesFile {
  date: string;
  fromDate: string;
  generatedAt: string;
  entries: ChangeEntry[];
}

export interface CompanyLike { slug: string; name: string; scores: MetricScore[] }

/** 노이즈 임계값 — 이 미만의 변화는 "변화"로 치지 않는다. */
export const THRESHOLDS = {
  scoreDelta: 3,
  textChangedPct: 1,
};

const AXES: Axis[] = ["A", "B", "C", "D"];

function round(v: number | null): number | null {
  return v === null ? null : Math.round(v);
}

/** 종합·축 점수 변화(임계값 이상만). 변화 없으면 null. */
export function diffScores(
  from: CompanyLike, to: CompanyLike, w: Weights,
): { overall?: ScoreDelta; axes: AxisDelta[] } | null {
  const of = round(overallForView(from.scores, w, "average"));
  const ot = round(overallForView(to.scores, w, "average"));
  const overall =
    of !== null && ot !== null && Math.abs(ot - of) >= THRESHOLDS.scoreDelta
      ? { from: of, to: ot }
      : undefined;
  const axes: AxisDelta[] = [];
  for (const axis of AXES) {
    const af = round(axisForView(from.scores, axis, w, "average"));
    const at = round(axisForView(to.scores, axis, w, "average"));
    if (af !== null && at !== null && Math.abs(at - af) >= THRESHOLDS.scoreDelta) {
      axes.push({ axis, from: af, to: at });
    }
  }
  if (!overall && axes.length === 0) return null;
  return { overall, axes };
}

/** 종합점 내림차순 1-based 순위(종합 null인 회사는 순위 없음). */
export function computeRanks(companies: CompanyLike[], w: Weights): Map<string, number> {
  const scored = companies
    .map((c) => ({ slug: c.slug, overall: overallForView(c.scores, w, "average") }))
    .filter((c): c is { slug: string; overall: number } => c.overall !== null)
    .sort((a, b) => b.overall - a.overall);
  return new Map(scored.map((c, i) => [c.slug, i + 1]));
}

/** 규칙 지표 점수 변화(임계값 이상만). to쪽 evidence 병기. */
export function diffMetrics(from: CompanyLike, to: CompanyLike): MetricChange[] {
  const key = (s: MetricScore) => `${s.axis}::${s.metricKey}`;
  const fromRule = new Map(
    from.scores.filter((s) => s.model === RULE_MODEL).map((s) => [key(s), s]),
  );
  const out: MetricChange[] = [];
  for (const s of to.scores) {
    if (s.model !== RULE_MODEL) continue;
    const prev = fromRule.get(key(s));
    if (!prev) continue;
    if (Math.abs(s.score - prev.score) >= THRESHOLDS.scoreDelta) {
      out.push({
        axis: s.axis, metricKey: s.metricKey,
        from: Math.round(prev.score), to: Math.round(s.score), evidence: s.evidence,
      });
    }
  }
  return out;
}

/** 본문 단어(공백 분리) 집합의 대칭차/합집합 비율(%) — 소수 1자리. */
export function wordChangedPct(fromText: string, toText: string): number {
  const a = new Set(fromText.split(/\s+/).filter(Boolean));
  const b = new Set(toText.split(/\s+/).filter(Boolean));
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  const symDiff = union - inter;
  return Math.round((symDiff / union) * 1000) / 10;
}

/** 지문 비교. 의미 있는 변화 없으면 null. */
export function diffContent(from: Fingerprint, to: Fingerprint): ContentChange | null {
  const titleChanged = from.title !== to.title;
  const metaChanged = from.metaDescription !== to.metaDescription;
  const fromH = new Set(from.headings.map((h) => h.text));
  const toH = new Set(to.headings.map((h) => h.text));
  const headingsAdded = [...toH].filter((t) => !fromH.has(t));
  const headingsRemoved = [...fromH].filter((t) => !toH.has(t));
  const rawPct = from.textHash === to.textHash ? 0 : wordChangedPct(from.text, to.text);
  const textChangedPct = rawPct >= THRESHOLDS.textChangedPct ? rawPct : 0;
  if (!titleChanged && !metaChanged && headingsAdded.length === 0 &&
      headingsRemoved.length === 0 && textChangedPct === 0) {
    return null;
  }
  return {
    titleChanged,
    ...(titleChanged ? { titleFrom: from.title, titleTo: to.title } : {}),
    metaChanged,
    headingsAdded,
    headingsRemoved,
    textChangedPct,
  };
}

export interface DetectInput {
  fromDate: string;
  toDate: string;
  generatedAt: string;
  from: CompanyLike[];
  to: CompanyLike[];
  fromFps: Record<string, Fingerprint>;
  toFps: Record<string, Fingerprint>;
  weights: Weights;
}

/** 두 측정 시점을 비교해 변화 기록 파일 객체를 만든다(순수). */
export function detectChanges(input: DetectInput): ChangesFile {
  const fromBySlug = new Map(input.from.map((c) => [c.slug, c]));
  const toSlugs = new Set(input.to.map((c) => c.slug));
  const fromRanks = computeRanks(input.from, input.weights);
  const toRanks = computeRanks(input.to, input.weights);

  const entries: ChangeEntry[] = [];
  for (const toCo of input.to) {
    const fromCo = fromBySlug.get(toCo.slug);
    if (!fromCo) {
      entries.push({ slug: toCo.slug, name: toCo.name, kinds: ["new"], summary: null });
      continue;
    }
    const score = diffScores(fromCo, toCo, input.weights);
    const metrics = diffMetrics(fromCo, toCo);
    const fromFp = input.fromFps[toCo.slug];
    const toFp = input.toFps[toCo.slug];
    const content = fromFp && toFp ? diffContent(fromFp, toFp) : null;
    const rf = fromRanks.get(toCo.slug);
    const rt = toRanks.get(toCo.slug);
    const rank = rf !== undefined && rt !== undefined && rf !== rt ? { from: rf, to: rt } : null;

    const kinds: ChangeKind[] = [];
    if (content) kinds.push("content");
    if (score || metrics.length > 0) kinds.push("score");
    if (rank) kinds.push("rank");
    if (kinds.length === 0) continue;

    entries.push({
      slug: toCo.slug,
      name: toCo.name,
      kinds,
      ...(score?.overall ? { overall: score.overall } : {}),
      ...(score && score.axes.length ? { axes: score.axes } : {}),
      ...(rank ? { rank } : {}),
      ...(metrics.length ? { metrics } : {}),
      ...(content ? { content } : {}),
      summary: null,
    });
  }
  for (const fromCo of input.from) {
    if (!toSlugs.has(fromCo.slug)) {
      entries.push({ slug: fromCo.slug, name: fromCo.name, kinds: ["removed"], summary: null });
    }
  }
  return { date: input.toDate, fromDate: input.fromDate, generatedAt: input.generatedAt, entries };
}
```

`packages/scoring/src/index.ts`에 추가:

```ts
export * from "./detect.js";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run packages/scoring/src/detect.test.ts`
Expected: PASS (전체). 실패 시 기대값을 손으로 재계산해 테스트/구현 중 틀린 쪽을 고친다(예: 반올림 경계).

- [ ] **Step 5: 커밋**

```bash
git add packages/scoring/src/detect.ts packages/scoring/src/detect.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): 두 측정 시점 비교 순수 diff 로직(detectChanges)"
```

---

### Task 4: 문서 생성기 (`changeReport.ts`) — inbox 문서·마크다운 리포트

**Files:**
- Create: `packages/scoring/src/changeReport.ts`
- Create: `packages/scoring/src/changeReport.test.ts`
- Modify: `packages/scoring/src/index.ts` (export 한 줄 추가)

**Interfaces:**
- Consumes: Task 3의 `ChangeEntry`, `ChangesFile`.
- Produces (Task 6·7이 사용):
  - `formatEntryLines(e: ChangeEntry): string[]` — CLI·inbox·리포트 공용 불릿 라인.
  - `buildChangeInboxDoc(input: { entry: ChangeEntry; url: string; fromDate: string; toDate: string; fromText: string; toText: string }): string`
  - `buildChangeReport(changes: ChangesFile): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/scoring/src/changeReport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ChangeEntry, ChangesFile } from "./detect.js";
import { buildChangeInboxDoc, buildChangeReport, formatEntryLines } from "./changeReport.js";

const entry: ChangeEntry = {
  slug: "alchemy",
  name: "Alchemy",
  kinds: ["content", "score", "rank"],
  overall: { from: 78, to: 83 },
  axes: [{ axis: "B", from: 54, to: 66 }],
  rank: { from: 3, to: 2 },
  metrics: [{ axis: "A", metricKey: "llms_txt_present", from: 0, to: 100, evidence: "llms.txt 제공" }],
  content: {
    titleChanged: false, metaChanged: true,
    headingsAdded: ["AI Agent Platform"], headingsRemoved: [],
    textChangedPct: 12.4,
  },
  summary: null,
};

describe("formatEntryLines", () => {
  it("종합·축·순위·지표·콘텐츠 변화를 라인으로 만든다", () => {
    const lines = formatEntryLines(entry).join("\n");
    expect(lines).toContain("종합 78 → 83 (+5)");
    expect(lines).toContain("축 B 54 → 66 (+12)");
    expect(lines).toContain("순위 3위 → 2위");
    expect(lines).toContain("llms_txt_present 0 → 100");
    expect(lines).toContain("헤딩 추가: AI Agent Platform");
    expect(lines).toContain("12.4% 변경");
  });
});

describe("buildChangeInboxDoc", () => {
  it("지시·기계 diff·발췌·출력 계약이 담긴 자기완결 문서를 만든다", () => {
    const doc = buildChangeInboxDoc({
      entry, url: "https://www.alchemy.com/",
      fromDate: "2026-07-09", toDate: "2026-07-22",
      fromText: "이전 본문", toText: "현재 본문",
    });
    expect(doc).toContain("Alchemy");
    expect(doc).toContain("2026-07-09 → 2026-07-22");
    expect(doc).toContain("이전 본문");
    expect(doc).toContain("현재 본문");
    expect(doc).toContain("scoring/changes-outbox/alchemy.json");
    expect(doc).toContain('"slug": "alchemy"');
  });

  it("긴 본문은 발췌 상한으로 자른다", () => {
    const long = "가".repeat(10000);
    const doc = buildChangeInboxDoc({
      entry, url: "u", fromDate: "f", toDate: "t", fromText: long, toText: long,
    });
    expect(doc.length).toBeLessThan(20000);
  });
});

describe("buildChangeReport", () => {
  it("회사 섹션·요약·delta 라인을 담은 마크다운을 만든다", () => {
    const changes: ChangesFile = {
      date: "2026-07-22", fromDate: "2026-07-09", generatedAt: "iso",
      entries: [{ ...entry, summary: "AI 에이전트 제품 페이지를 새로 열었다." }],
    };
    const md = buildChangeReport(changes);
    expect(md).toContain("# 경쟁사 변화 리포트 2026-07-22");
    expect(md).toContain("2026-07-09 → 2026-07-22");
    expect(md).toContain("## Alchemy");
    expect(md).toContain("> AI 에이전트 제품 페이지를 새로 열었다.");
    expect(md).toContain("종합 78 → 83 (+5)");
  });

  it("변화 없으면 그 사실을 명시한다", () => {
    const md = buildChangeReport({ date: "d", fromDate: "f", generatedAt: "g", entries: [] });
    expect(md).toContain("변화가 감지되지 않았습니다");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run packages/scoring/src/changeReport.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`packages/scoring/src/changeReport.ts`:

```ts
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
```

`packages/scoring/src/index.ts`에 추가:

```ts
export * from "./changeReport.js";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run packages/scoring/src/changeReport.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/scoring/src/changeReport.ts packages/scoring/src/changeReport.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): 변화 inbox 문서·마크다운 리포트 생성기"
```

---

### Task 5: 요약 파싱·병합 (`summaries.ts`)

**Files:**
- Create: `packages/scoring/src/summaries.ts`
- Create: `packages/scoring/src/summaries.test.ts`
- Modify: `packages/scoring/src/index.ts` (export 한 줄 추가)

**Interfaces:**
- Consumes: Task 3의 `ChangesFile`.
- Produces (Task 7이 사용):
  - `interface ChangeSummary { slug: string; summary: string }`
  - `parseSummaryFile(raw: string): ChangeSummary` — 실패 시 throw.
  - `mergeSummaries(changes: ChangesFile, summaries: ChangeSummary[]): { merged: ChangesFile; unmatched: string[] }`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/scoring/src/summaries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ChangesFile } from "./detect.js";
import { mergeSummaries, parseSummaryFile } from "./summaries.js";

describe("parseSummaryFile", () => {
  it("정상 JSON을 파싱하고 summary를 trim한다", () => {
    expect(parseSummaryFile('{ "slug": "a", "summary": "  요약  " }'))
      .toEqual({ slug: "a", summary: "요약" });
  });
  it("slug/summary 누락·빈 값은 throw", () => {
    expect(() => parseSummaryFile('{ "summary": "x" }')).toThrow();
    expect(() => parseSummaryFile('{ "slug": "a", "summary": "  " }')).toThrow();
    expect(() => parseSummaryFile("not json")).toThrow();
  });
});

describe("mergeSummaries", () => {
  const changes: ChangesFile = {
    date: "d", fromDate: "f", generatedAt: "g",
    entries: [
      { slug: "a", name: "A", kinds: ["score"], summary: null },
      { slug: "b", name: "B", kinds: ["content"], summary: null },
    ],
  };
  it("slug가 일치하는 엔트리에만 summary를 채운다", () => {
    const { merged, unmatched } = mergeSummaries(changes, [
      { slug: "a", summary: "A 요약" },
      { slug: "ghost", summary: "없는 회사" },
    ]);
    expect(merged.entries.find((e) => e.slug === "a")?.summary).toBe("A 요약");
    expect(merged.entries.find((e) => e.slug === "b")?.summary).toBeNull();
    expect(unmatched).toEqual(["ghost"]);
  });
  it("원본 객체를 변형하지 않는다", () => {
    mergeSummaries(changes, [{ slug: "a", summary: "x" }]);
    expect(changes.entries[0].summary).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run packages/scoring/src/summaries.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`packages/scoring/src/summaries.ts`:

```ts
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
```

`packages/scoring/src/index.ts`에 추가:

```ts
export * from "./summaries.js";
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run packages/scoring/src/summaries.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/scoring/src/summaries.ts packages/scoring/src/summaries.test.ts packages/scoring/src/index.ts
git commit -m "feat(scoring): 변화 요약 파싱·병합(summaries)"
```

---

### Task 6: `pnpm detect-changes` CLI

**Files:**
- Create: `packages/scoring/src/cli-detect.ts`
- Modify: `package.json` (루트 — scripts에 한 줄 추가)

**Interfaces:**
- Consumes: Task 1 `Fingerprint`, Task 3 `detectChanges/CompanyLike`, Task 4 `buildChangeInboxDoc/buildChangeReport/formatEntryLines`, core `loadWeights`, crawler `loadCompanies`.
- Produces: `changes/<to날짜>.json`(ChangesFile JSON), `scoring/changes-inbox/<slug>.md`, `--report` 시 `reports/changes/<to날짜>.md`. Task 7·8이 `changes/` 형식에 의존.

- [ ] **Step 1: CLI 구현**

`packages/scoring/src/cli-detect.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadWeights } from "@ai-benchmark/core";
import { loadCompanies } from "@ai-benchmark/crawler";
import type { Fingerprint } from "./fingerprint.js";
import { detectChanges, type CompanyLike } from "./detect.js";
import { buildChangeInboxDoc, buildChangeReport, formatEntryLines } from "./changeReport.js";

function listSnapshotDates(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

function loadCompaniesFromSnapshot(file: string): CompanyLike[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as { companies?: unknown };
  if (!Array.isArray(raw.companies)) throw new Error(`companies 배열이 없습니다: ${file}`);
  return raw.companies as CompanyLike[];
}

function loadFingerprints(dir: string): Record<string, Fingerprint> {
  const out: Record<string, Fingerprint> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const fp = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Fingerprint;
      if (fp && typeof fp.slug === "string" && typeof fp.text === "string") out[fp.slug] = fp;
    } catch {
      // 깨진 지문 파일은 건너뛴다
    }
  }
  return out;
}

function argValue(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : null;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const snapshotsDir = resolve(root, "snapshots");

  const dates = listSnapshotDates(snapshotsDir);
  const to = argValue("to") ?? dates[dates.length - 1];
  const from = argValue("from") ?? dates.filter((d) => d < (to ?? "")).pop();
  if (!from || !to || from === to) {
    console.log("비교 기준이 없습니다 — snapshots/ 에 서로 다른 날짜의 스냅샷이 2개 이상 필요합니다.");
    return;
  }

  const fromCompanies = loadCompaniesFromSnapshot(resolve(snapshotsDir, `${from}.json`));
  const toCompanies = loadCompaniesFromSnapshot(resolve(snapshotsDir, `${to}.json`));
  const fromFps = loadFingerprints(resolve(snapshotsDir, "content", from));
  const toFps = loadFingerprints(resolve(snapshotsDir, "content", to));
  const weights = loadWeights(resolve(root, "config/weights.yaml"));

  const changes = detectChanges({
    fromDate: from, toDate: to, generatedAt: new Date().toISOString(),
    from: fromCompanies, to: toCompanies, fromFps, toFps, weights,
  });

  const changesDir = resolve(root, "changes");
  mkdirSync(changesDir, { recursive: true });
  writeFileSync(resolve(changesDir, `${to}.json`), JSON.stringify(changes, null, 2));

  // LLM 요약 입력(inbox): 신규/제외를 뺀, 실제 변화가 있는 회사만.
  const urlBySlug = new Map(
    loadCompanies(resolve(root, "config/companies.yaml")).map((c) => [c.slug, c.homepageUrl]),
  );
  const inboxDir = resolve(root, "scoring/changes-inbox");
  mkdirSync(inboxDir, { recursive: true });
  let inboxCount = 0;
  for (const e of changes.entries) {
    if (!e.kinds.some((k) => k === "content" || k === "score" || k === "rank")) continue;
    const doc = buildChangeInboxDoc({
      entry: e,
      url: urlBySlug.get(e.slug) ?? "",
      fromDate: from,
      toDate: to,
      fromText: fromFps[e.slug]?.text ?? "",
      toText: toFps[e.slug]?.text ?? "",
    });
    writeFileSync(resolve(inboxDir, `${e.slug}.md`), doc);
    inboxCount += 1;
  }

  console.log(`\n[${from} → ${to}] 변화 감지: ${changes.entries.length}개사`);
  for (const e of changes.entries) {
    console.log(`\n- ${e.name} (${e.kinds.join(", ")})`);
    for (const l of formatEntryLines(e)) console.log(`    ${l}`);
  }
  console.log(
    `\nchanges/${to}.json 기록. inbox ${inboxCount}건 → Claude Code로 요약해 ` +
    `scoring/changes-outbox/<slug>.json 저장 후 \`pnpm import-change-summaries\` 실행.`,
  );

  if (process.argv.includes("--report")) {
    const reportDir = resolve(root, "reports/changes");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(resolve(reportDir, `${to}.md`), buildChangeReport(changes));
    console.log(`reports/changes/${to}.md 기록(요약 없음 버전).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
```

루트 `package.json` scripts에 추가(`"import-scores"` 다음 줄):

```json
    "detect-changes": "tsx packages/scoring/src/cli-detect.ts",
```

- [ ] **Step 2: 스모크 실행으로 검증**

현재 snapshots에는 07-08·07-09가 있고 데이터가 동일하므로 "변화 0건"이 정답이다:

Run: `pnpm detect-changes`
Expected 출력: `[2026-07-08 → 2026-07-09] 변화 감지: 0개사` + changes/2026-07-09.json 안내. inbox 0건.

검증:
- `cat changes/2026-07-09.json` → `entries: []`, `fromDate: "2026-07-08"`, `date: "2026-07-09"`.
- 콘텐츠 diff는 07-08 지문이 없으므로 수행되지 않음(정상 — 기준선은 07-09부터).
- `pnpm detect-changes --from=2026-07-08 --to=2026-07-09 --report` → `reports/changes/2026-07-09.md`에 "변화가 감지되지 않았습니다" 포함.

- [ ] **Step 3: 커밋**

```bash
git add packages/scoring/src/cli-detect.ts package.json changes/ reports/
git commit -m "feat(scoring): pnpm detect-changes — 스냅샷·지문 비교 CLI + changes/ 기록"
```

---

### Task 7: `pnpm import-change-summaries` CLI

**Files:**
- Create: `packages/scoring/src/cli-import-summaries.ts`
- Modify: `package.json` (루트 — scripts에 한 줄 추가)

**Interfaces:**
- Consumes: Task 3 `ChangesFile`, Task 4 `buildChangeReport`, Task 5 `parseSummaryFile/mergeSummaries`.
- Produces: `changes/<최신>.json`의 summary 필드 갱신 + `reports/changes/<date>.md`.

- [ ] **Step 1: CLI 구현**

`packages/scoring/src/cli-import-summaries.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ChangesFile } from "./detect.js";
import { buildChangeReport } from "./changeReport.js";
import { mergeSummaries, parseSummaryFile, type ChangeSummary } from "./summaries.js";

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../../..");
  const changesDir = resolve(root, "changes");
  const outboxDir = resolve(root, "scoring/changes-outbox");

  const files = existsSync(changesDir)
    ? readdirSync(changesDir).filter((f) => f.endsWith(".json")).sort()
    : [];
  if (files.length === 0) {
    console.log("changes/ 에 변화 기록이 없습니다 — 먼저 `pnpm detect-changes`를 실행하세요.");
    return;
  }
  const latest = files[files.length - 1];
  const changesPath = resolve(changesDir, latest);
  const changes = JSON.parse(readFileSync(changesPath, "utf8")) as ChangesFile;

  const summaries: ChangeSummary[] = [];
  let failed = 0;
  if (existsSync(outboxDir)) {
    for (const f of readdirSync(outboxDir)) {
      if (!f.endsWith(".json")) continue;
      try {
        summaries.push(parseSummaryFile(readFileSync(resolve(outboxDir, f), "utf8")));
      } catch (e) {
        console.error(`[${f}] 검증 실패: ${(e as Error).message}`);
        failed += 1;
      }
    }
  }

  const { merged, unmatched } = mergeSummaries(changes, summaries);
  for (const slug of unmatched) console.warn(`[${slug}] changes 엔트리에 없는 slug — 건너뜀`);
  writeFileSync(changesPath, JSON.stringify(merged, null, 2));

  const reportDir = resolve(root, "reports/changes");
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(resolve(reportDir, `${merged.date}.md`), buildChangeReport(merged));

  const applied = summaries.length - unmatched.length;
  console.log(
    `요약 ${applied}건 병합(검증 실패 ${failed}건, 미매칭 ${unmatched.length}건) → ` +
    `changes/${latest} / reports/changes/${merged.date}.md 갱신.`,
  );
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
```

루트 `package.json` scripts에 추가(`"detect-changes"` 다음 줄):

```json
    "import-change-summaries": "tsx packages/scoring/src/cli-import-summaries.ts",
```

- [ ] **Step 2: 스모크 실행으로 검증**

Run:
```bash
mkdir -p scoring/changes-outbox
printf '{ "slug": "ghost", "summary": "테스트" }' > scoring/changes-outbox/ghost.json
pnpm import-change-summaries
rm scoring/changes-outbox/ghost.json
```
Expected: `[ghost] changes 엔트리에 없는 slug — 건너뜀` 경고 + `요약 0건 병합(... 미매칭 1건)` + `reports/changes/2026-07-09.md` 생성("변화가 감지되지 않았습니다" 포함). exit code 0.

- [ ] **Step 3: 커밋**

```bash
git add packages/scoring/src/cli-import-summaries.ts package.json reports/
git commit -m "feat(scoring): pnpm import-change-summaries — 요약 병합 + 리포트 생성"
```

---

### Task 8: 웹 데이터 레이어 (`changes.ts`)

**Files:**
- Create: `packages/web/src/lib/data/changes.ts`
- Create: `packages/web/src/lib/data/changes.test.ts`

**Interfaces:**
- Consumes: `changes/*.json` 파일 형식(Task 6이 생성).
- Produces (Task 9가 사용): `interface WebChangesFile { date; fromDate; entries: WebChangeEntry[] }`, `interface WebChangeEntry { slug; name; kinds: string[]; overall?; axes?; rank?; metrics?; content?; summary: string | null }`, `loadChangeHistory(dir: string): WebChangesFile[]` (날짜 내림차순).

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/web/src/lib/data/changes.test.ts` (history.test.ts 관례를 따른다):

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadChangeHistory } from "./changes.js";

describe("loadChangeHistory", () => {
  it("없는 디렉터리는 빈 배열", () => {
    expect(loadChangeHistory(resolve(tmpdir(), "definitely-missing-changes"))).toEqual([]);
  });

  it("날짜 내림차순 정렬 + 깨진/필드누락 파일 skip", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "changes-"));
    writeFileSync(resolve(dir, "2026-07-09.json"), JSON.stringify({
      date: "2026-07-09", fromDate: "2026-07-08", generatedAt: "g", entries: [],
    }));
    writeFileSync(resolve(dir, "2026-07-22.json"), JSON.stringify({
      date: "2026-07-22", fromDate: "2026-07-09", generatedAt: "g",
      entries: [{ slug: "a", name: "A", kinds: ["score"], overall: { from: 70, to: 75 }, summary: "요약" }],
    }));
    writeFileSync(resolve(dir, "broken.json"), "{ not json");
    writeFileSync(resolve(dir, "no-entries.json"), JSON.stringify({ date: "d", fromDate: "f" }));

    const files = loadChangeHistory(dir);
    expect(files.map((f) => f.date)).toEqual(["2026-07-22", "2026-07-09"]);
    expect(files[0].entries[0].name).toBe("A");
    expect(files[0].entries[0].overall).toEqual({ from: 70, to: 75 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm exec vitest run packages/web/src/lib/data/changes.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`packages/web/src/lib/data/changes.ts`:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm exec vitest run packages/web/src/lib/data/changes.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/web/src/lib/data/changes.ts packages/web/src/lib/data/changes.test.ts
git commit -m "feat(web): changes/*.json 빌드타임 로더(loadChangeHistory)"
```

---

### Task 9: `/changes` 페이지 + ChangesView + nav

**Files:**
- Create: `packages/web/src/components/ChangesView.tsx`
- Create: `packages/web/src/app/changes/page.tsx`
- Modify: `packages/web/src/components/NavBar.tsx` (NAV 배열 한 줄)

**Interfaces:**
- Consumes: Task 8의 `loadChangeHistory/WebChangesFile/WebChangeEntry`, glossary `AXIS_INFO/METRIC_INFO`.
- Produces: 정적 라우트 `/changes`.

- [ ] **Step 1: ChangesView 구현** (서버 컴포넌트 — 상태 없음, `"use client"` 불필요)

`packages/web/src/components/ChangesView.tsx`:

```tsx
import type { Axis } from "@ai-benchmark/core";
import { AXIS_INFO, METRIC_INFO } from "../lib/glossary.js";
import type { WebChangeEntry, WebChangesFile } from "../lib/data/changes.js";

const KIND_LABEL: Record<string, string> = {
  content: "콘텐츠", score: "점수", rank: "순위", new: "신규", removed: "제외",
};

/** 점수/순위 delta. 순위는 숫자가 줄어드는 게 개선이므로 invert. */
function Delta({ from, to, invert = false, suffix = "" }: {
  from: number; to: number; invert?: boolean; suffix?: string;
}) {
  const up = invert ? to < from : to > from;
  const color = up ? "var(--score-high)" : "var(--score-low)";
  return (
    <span className="mono" style={{ color }}>
      {from}{suffix} → {to}{suffix} <span aria-hidden>{up ? "▲" : "▼"}</span>
    </span>
  );
}

function EntryCard({ e }: { e: WebChangeEntry }) {
  const c = e.content;
  return (
    <article className="rounded-lg border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold">{e.name}</h3>
        {e.kinds.map((k) => (
          <span
            key={k}
            className="rounded px-1.5 py-0.5 text-xs"
            style={{ border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            {KIND_LABEL[k] ?? k}
          </span>
        ))}
      </div>
      {e.summary && <p className="mt-2 text-sm">{e.summary}</p>}
      <ul className="mt-2 space-y-1 text-sm" style={{ color: "var(--muted)" }}>
        {e.overall && <li>종합 <Delta from={e.overall.from} to={e.overall.to} /></li>}
        {(e.axes ?? []).map((a) => (
          <li key={a.axis}>
            {AXIS_INFO[a.axis as Axis]?.label ?? a.axis} <Delta from={a.from} to={a.to} />
          </li>
        ))}
        {e.rank && <li>순위 <Delta from={e.rank.from} to={e.rank.to} invert suffix="위" /></li>}
        {(e.metrics ?? []).map((m) => (
          <li key={m.metricKey}>
            {METRIC_INFO[m.metricKey]?.label ?? m.metricKey} <Delta from={m.from} to={m.to} />
            {m.evidence && <span className="ml-1">— {m.evidence}</span>}
          </li>
        ))}
        {c?.titleChanged && <li>title 변경: “{c.titleFrom}” → “{c.titleTo}”</li>}
        {c?.metaChanged && <li>메타 설명 변경</li>}
        {c && c.headingsAdded.length > 0 && <li>헤딩 추가: {c.headingsAdded.join(" · ")}</li>}
        {c && c.headingsRemoved.length > 0 && <li>헤딩 삭제: {c.headingsRemoved.join(" · ")}</li>}
        {c && c.textChangedPct > 0 && <li>본문 텍스트 약 {c.textChangedPct}% 변경</li>}
      </ul>
    </article>
  );
}

export function ChangesView({ files }: { files: WebChangesFile[] }) {
  if (files.length === 0) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">변화 소식</h1>
        <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
          아직 감지된 변화가 없습니다. 재측정 후 <code className="mono">pnpm detect-changes</code>를
          실행하면 이곳에 표시됩니다.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">변화 소식</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        재측정 시점마다 직전 측정 대비 각 사 홈페이지의 콘텐츠·점수·순위 변화를 기록합니다.
      </p>
      <div className="mt-6 space-y-8">
        {files.map((f) => (
          <section key={f.date}>
            <h2 className="font-display text-lg font-semibold">
              {f.date}{" "}
              <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>
                (vs {f.fromDate})
              </span>
            </h2>
            {f.entries.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                변화가 감지되지 않았습니다.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {f.entries.map((e) => (
                  <EntryCard key={e.slug} e={e} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 라우트 + nav**

`packages/web/src/app/changes/page.tsx`:

```tsx
import { resolve } from "node:path";
import { loadChangeHistory } from "../../lib/data/changes.js";
import { ChangesView } from "../../components/ChangesView.js";

export default function ChangesPage() {
  const files = loadChangeHistory(resolve(process.cwd(), "../../changes"));
  return <ChangesView files={files} />;
}
```

`packages/web/src/components/NavBar.tsx`의 NAV 배열 수정 — "자사 추이" 다음에 추가:

```ts
const NAV = [
  { href: "/", label: "순위" },
  { href: "/improvement", label: "자사 개선 방향" },
  { href: "/trend", label: "자사 추이" },
  { href: "/changes", label: "변화 소식" },
  { href: "/methodology", label: "평가 기준·방식" },
];
```

- [ ] **Step 3: 빌드로 검증**

Run: `pnpm web:build`
Expected: 성공, 라우트 목록에 `/changes` (○ Static). 현재 changes/2026-07-09.json(entries 빈 배열)이 있으므로 페이지는 "2026-07-09 (vs 2026-07-08) — 변화가 감지되지 않았습니다"를 렌더.

- [ ] **Step 4: 커밋**

```bash
git add packages/web/src/components/ChangesView.tsx packages/web/src/app/changes/ packages/web/src/components/NavBar.tsx
git commit -m "feat(web): /changes 변화 소식 페이지 + nav 탭"
```

---

### Task 10: 최종 검증

**Files:** 없음(검증만).

- [ ] **Step 1: 전체 테스트·타입체크·빌드**

Run:
```bash
pnpm test && pnpm typecheck && pnpm web:build
```
Expected: 전부 통과(기존 111 + 신규 테스트). 실패 시 superpowers:systematic-debugging으로 원인 규명 후 수정.

- [ ] **Step 2: 엔드투엔드 리허설(합성 데이터, 커밋 안 함)**

과거 지문을 조작해 콘텐츠 diff가 실제로 잡히는지 1회 확인:

```bash
mkdir -p snapshots/content/2026-07-08
cp snapshots/content/2026-07-09/parameta.json snapshots/content/2026-07-08/parameta.json
# 2026-07-08 지문의 title을 다른 값으로 바꾼다(수동 편집 대신 node 한 줄):
node -e "
const f='snapshots/content/2026-07-08/parameta.json';
const j=JSON.parse(require('fs').readFileSync(f,'utf8'));
j.date='2026-07-08'; j.title='(구) '+j.title; j.headings.push({level:2,text:'사라질 섹션'});
require('fs').writeFileSync(f,JSON.stringify(j,null,2));
"
pnpm detect-changes --from=2026-07-08 --to=2026-07-09
```
Expected: 파라메타 1개사 감지 — `title 변경`, `헤딩 삭제: 사라질 섹션` 라인 + `scoring/changes-inbox/parameta.md` 생성.

정리(합성 데이터 제거 + 진짜 빈 changes 복원):
```bash
rm -rf snapshots/content/2026-07-08 scoring/changes-inbox
pnpm detect-changes   # 07-08→07-09 재실행으로 changes/2026-07-09.json 원상복구
git status            # snapshots/·changes/ 에 수정 잔재 없는지 확인
```

- [ ] **Step 3: 최종 커밋(잔여 변경이 있으면)**

```bash
git status
# changes/2026-07-09.json 이 generatedAt만 바뀌었으면 커밋(기록물 갱신), 그 외 잔재는 원복
git add changes/
git commit -m "chore: detect-changes 리허설 후 변화 기록 정리"
```

---

## 운영 흐름 (구현 후 재측정 루틴 — 참고)

```
pnpm crawl                       # 새 크롤
pnpm prepare-scores              # LLM 채점 inbox
(Claude Code / Codex 채점)       # scoring/outbox/<model>/
pnpm exec tsx packages/scoring/scripts/gen-measured.ts   # measured + 스냅샷 + 지문
pnpm detect-changes              # 변화 감지 + CLI 요약 + changes-inbox
(Claude Code 변화 요약)          # scoring/changes-outbox/<slug>.json
pnpm import-change-summaries     # summary 병합 + reports/changes/<date>.md
pnpm web:build                   # /changes 반영
```
