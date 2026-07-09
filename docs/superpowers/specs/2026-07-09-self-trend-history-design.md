# 자사 추이(히스토리) 페이지 설계

- 작성일: 2026-07-09
- 상태: 설계 승인 대기
- 관련: [개선 방향 페이지](2026-07-08-improvement-direction-page-design.md), [진단 요약 재설계](2026-07-08-diagnostic-summary-qualitative-redesign-design.md)

## 배경 / 문제

현재 대시보드는 **최신 1개 스냅샷**만 보여준다. 데이터 흐름은 이미 로컬·파일 기반이지만 확정된 종합 결과(`packages/web/src/lib/data/measured.ts`)는 최신 상태만 유지된다.

- `raw/<slug>/<ISO>.json` — 크롤 스냅샷(날짜별로 쌓임)
- `scoring/outbox/<model>/<slug>.json` — 축 C(LLM) 점수(날짜 없음, 덮어쓰기)
- `measured.ts` — `gen-measured.ts`가 위 둘을 합쳐 생성하는 **최신 1개** 종합 스냅샷

그 결과 "지난 측정 대비 자사 점수가 어떻게 변했는가"(개선 추적)를 보여줄 수 없다. 이 프로젝트의 목적이 **자사(파라메타) 홈페이지의 AI 친화도 개선**이므로, 시간에 따른 추이를 보는 화면이 필요하다.

## 목표

- `gen-measured` 실행 시점마다 **전체 회사 스냅샷을 날짜별 JSON으로 아카이브**한다.
- 웹 대시보드에 **자사 단독 추이 차트**(종합 + 축별 A/B/C/D)를 신규 `/trend` 페이지로 추가한다.
- 새 도구·DB(Supabase) 도입 없이, 기존 로컬 JSON 관례를 확장한다.

## 비목표 (YAGNI)

- 경쟁사 추이 라인(차트) — 이번 범위 아님. 단, **데이터는 전 회사 저장**하여 후속 확장은 가능하게 둔다.
- 모델별 추이 토글 — 기본(평균) 뷰만. 후순위.
- 자동 스케줄링/크론 — 로컬에서 수동 실행.
- Supabase 이력 적재.

## 핵심 설계 결정

1. **아카이브 = 전 회사 원본 스냅샷.** 파생값(overall/축)이 아니라 `CompanyRecord[]`(원본 점수 배열)를 저장한다. 이유:
   - weights/루브릭이 바뀌어도 **현재 기준으로 재계산**할 수 있어 추이가 일관된 잣대(사과 대 사과)가 된다.
   - 나중에 경쟁사 추이 등 확장 시 데이터 수정이 불필요하다.
2. **스냅샷 키 = 로컬 날짜(YYYY-MM-DD).** 같은 날 재실행 시 **덮어쓰기**(하루 = 점 1개). 로컬 테스트 재실행이 차트를 오염시키지 않게 한다.
3. **집계는 읽을 때(빌드타임) core 함수로 파생.** `overallForView`/`axisForView`를 재사용, 저장은 원본만.

## 아키텍처 / 컴포넌트

### 1. 데이터 아카이브 (저장소 루트 `snapshots/`)

- 위치: 저장소 루트 `snapshots/<YYYY-MM-DD>.json` (`raw/`, `scoring/`와 나란히).
- 포맷:
  ```json
  {
    "date": "2026-07-09",
    "generatedAt": "2026-07-09T12:34:56.789Z",
    "rubricVersion": "rubric_v1",
    "companies": [ /* CompanyRecord[] — measured.ts와 동일 구조 */ ]
  }
  ```
- 생성: `packages/scoring/scripts/gen-measured.ts` 확장.
  - 현재 `records: CompanyRecord[]`를 만들어 `measured.ts`를 쓴다. **같은 `records`로 스냅샷 파일도 기록**한다.
  - 스냅샷 객체 생성 로직은 순수 함수 `buildSnapshotFile(records, date, generatedAt, rubricVersion)`로 분리(테스트 대상). 파일 I/O(경로 계산·쓰기)는 스크립트에 남긴다.
  - `date`는 실행 시점 로컬 날짜(`YYYY-MM-DD`), `generatedAt`은 실행 시각 ISO. 같은 날짜 파일이 있으면 덮어쓴다.

### 2. 웹 읽기 레이어 (`packages/web/src/lib/data/history.ts`)

- 빌드타임(서버 컴포넌트)에 `snapshots/*.json`을 fs로 읽는다.
  - 스냅샷 디렉터리 경로는 `page.tsx`가 weights를 읽는 방식과 동일하게 `process.cwd()` 기준 상대경로로 해석한다(`resolve(process.cwd(), "../../snapshots")`).
- 타입:
  ```ts
  interface DaySnapshot { date: string; companies: CompanyRecord[]; }
  type SnapshotHistory = DaySnapshot[]; // date 오름차순 정렬
  interface TrendPoint { date: string; overall: number | null; axes: Record<Axis, number | null>; }
  ```
- 함수:
  - `loadSnapshotHistory(dir): SnapshotHistory` — 파일 파싱 + 날짜 오름차순 정렬. 디렉터리 없음/빈 폴더/파싱 실패 파일은 건너뛰고 빈 배열 허용.
  - `buildSelfTrend(history, weights, view): TrendPoint[]` — 각 스냅샷에서 `isSelf === true` 회사를 찾아 core의 `overallForView`/`axisForView`로 파생. 자사 레코드가 없는 스냅샷은 건너뛴다.
- 파싱은 방어적으로: 최소 필드(`date`, `companies`) 검증, 실패 시 해당 파일 skip(전체 실패 아님).

### 3. 화면 (`/trend` 라우트)

- 라우트: `packages/web/src/app/trend/page.tsx` (서버 컴포넌트).
  - `loadSnapshotHistory` → `buildSelfTrend(history, weights, defaultView)` → `SelfTrendView`에 전달.
- 넷째 네비 탭 추가: `layout.tsx`의 nav 배열에 `{ href: "/trend", label: "자사 추이" }`를 `자사 개선 방향` 다음에 삽입.
- 컴포넌트 `packages/web/src/components/SelfTrendView.tsx` (`"use client"`):
  - recharts `LineChart`. x축 = `date`, y축 = 0~100.
  - 기본 **종합** 라인 1개. 상단 토글로 **축별(A/B/C/D)** 전환 — 기존 축 전환 UX(예: `ModelToggle`/`AxisRadar` 패턴)와 시각적으로 일관되게.
  - 값이 `null`인 점은 라인에서 끊기게(connectNulls=false) 처리.
- 빈/단일 상태 처리:
  - 스냅샷 0개 → "아직 추이 데이터가 없습니다. `pnpm exec tsx packages/scoring/scripts/gen-measured.ts`를 1회 이상 실행하세요." 안내.
  - 스냅샷 1개 → 라인 대신 현재 종합/축 값 요약 + "추이는 2회차 측정부터 표시됩니다." 안내.

### 4. 초기 백필 (1회)

- 현재 `measured.ts`(= 2026-07-08 크롤 반영)를 첫 점으로 확보하기 위해 `snapshots/2026-07-08.json`을 **1회 생성**한다.
- 방법: `gen-measured.ts`에 `--date=YYYY-MM-DD` 옵션(선택 인자)을 추가해, 백필 시 `date`를 명시적으로 지정할 수 있게 한다. 기본(옵션 없음)은 오늘 날짜.
  - 백필 실행: `pnpm exec tsx packages/scoring/scripts/gen-measured.ts --date=2026-07-08`
  - `generatedAt`은 실제 실행 시각(백필임을 부정하지 않음), `date`만 07-08로.
- 이후 오늘(07-09) 일반 실행 시 07-09 점이 붙어 최소 2점 → 라인이 그려진다.

## 데이터 흐름 (요약)

```
크롤/채점 → gen-measured.ts
                 ├─ packages/web/src/lib/data/measured.ts   (최신 1개, 기존)
                 └─ snapshots/<date>.json                    (전 회사 원본, 신규)
                                        ↓ 빌드타임 fs 읽기
                        web/lib/data/history.ts (loadSnapshotHistory)
                                        ↓ buildSelfTrend (core 파생)
                              /trend page → SelfTrendView (recharts)
```

## 오류 처리

- `snapshots/` 없음/빈 폴더 → 빈 히스토리, 페이지에서 안내 문구.
- 개별 스냅샷 파일 파싱 실패/필드 누락 → 해당 파일만 skip, 나머지로 진행.
- 스냅샷에 자사 레코드 없음 → 해당 날짜 점 제외.
- 같은 날짜 재생성 → 덮어쓰기(에러 아님).

## 테스트 (vitest, 레포 관례 `*.test.ts`)

- `packages/scoring`: `buildSnapshotFile` 순수 함수 — records/date/generatedAt 입력 시 올바른 스냅샷 객체 형태를 만드는지.
- `packages/web`: `history.test.ts`
  - `loadSnapshotHistory`: 정렬, 빈 폴더, 깨진 파일 skip.
  - `buildSelfTrend`: 자사 파생값 정확도(고정 weights fixture로 overall/축 계산 검증), 자사 없는 스냅샷 제외, null 처리.
- `SelfTrendView`는 렌더 스모크 수준(선택) — 로직은 파생 함수에 있으므로 과한 UI 테스트는 지양.

## 산출물 목록

- `snapshots/` 디렉터리(런타임 생성) + `.gitignore` 정책 결정: 스냅샷 JSON은 **커밋한다**(추이 데이터 자체가 자산이며 로컬 단일 사용자). `snapshots/`는 추적 대상.
- `packages/scoring/scripts/gen-measured.ts` 확장 + `--date` 옵션 + `buildSnapshotFile` 추출.
- `packages/scoring/.../buildSnapshotFile` 테스트.
- `packages/web/src/lib/data/history.ts` + 테스트.
- `packages/web/src/app/trend/page.tsx`.
- `packages/web/src/components/SelfTrendView.tsx`.
- `packages/web/src/app/layout.tsx` nav 항목 추가.

## 열린 질문 / 후속

- 종합 점수 뷰(모델 평균)만 사용. 모델별 추이는 후속.
- 경쟁사 추이/비교 라인은 데이터가 이미 저장되므로 후속 페이지에서 확장 가능.
