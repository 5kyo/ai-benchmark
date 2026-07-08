# 자사 홈페이지 개선 방향 페이지 설계

날짜: 2026-07-08

## 배경·목표

실무진이 자사(파라메타) 홈페이지의 AI 친화도를 개선할 때 "무엇을 먼저 고쳐야
하는가"를 한눈에 보고, 재측정을 반복하며 진행 상황을 추적할 수 있는 전용 페이지를
신설한다. 종합 1·2위(글로벌 포함) 대비 **가중 격차 영향도** 순으로 개선 항목을
우선순위화한다.

현재 데이터 기준: 자사 9위/13(종합 73.6), 1위 Lambda256(87.8), 2위 Alchemy(87.6).

## 결정 사항

- **추적 방식**: 읽기 전용 자동 산출. 편집·영속 상태 없음. 크롤러 재측정 →
  `measured.ts` 재생성 시 페이지가 자동 갱신되며 격차·순위가 움직인다.
- **비교 대상**: 전체 종합 1·2위(`buildRanking`의 `rows[0]`, `rows[1]`).
- **우선순위 기준**: `영향도 = 격차 × 실효가중치`. 이는 곧 "해당 지표를 리더(타깃)
  수준으로 올렸을 때 종합점수 상승분(점)"으로 해석된다.

## 비목표

- 화면 내 편집·담당자·상태 관리(읽기 전용 결정에 따름).
- 뷰 토글(모델별). 평균(`"average"`) 뷰 고정.
- 기존 순위/상세 페이지 로직 변경.

## 우선순위·격차 계산 (`packages/web/src/lib/improvement.ts`, 신규·순수 함수)

### 실효가중치

`overallScore`가 축가중치 × (축내 정규화 지표가중치)로 종합점수를 만든다. 따라서
지표 하나의 종합점수 기여 비중:

```
effWeight(metric) = axesWeight[axis] × (metricWeight[axis][metric] / Σ 자사에 존재하는 축내 지표가중치)
```

### 항목 산출

평균 뷰에서 자사·1위·2위의 지표별 점수를 얻어(각각 `metricRowsForView(scores,"average")`),
자사에 점수가 있는 각 지표에 대해:

- `target = max(1위 지표점수, 2위 지표점수)` (둘 중 존재하는 최댓값; 리더가 보인 달성 가능한 상한)
- `gap = max(0, target − selfScore)`
- `projectedGain = gap × effWeight(metric)` (예상 종합점수 상승분)
- `gap > 0`인 항목만 포함, `projectedGain` 내림차순 정렬

### 우선순위 티어

`projectedGain` 절대값(≈ 종합점수 상승 포인트) 기준:

- `high`(최우선): `projectedGain ≥ 1.0`
- `mid`(권장): `0.3 ≤ projectedGain < 1.0`
- `low`(여력 시): `0 < projectedGain < 0.3`

### 반환 형태

```ts
interface ImprovementItem {
  axis: Axis;
  metricKey: string;
  label: string;              // metricLabel
  selfScore: number;          // 반올림
  leaderScores: { name: string; score: number | null }[]; // [1위, 2위]
  target: number;
  gap: number;                // 반올림
  projectedGain: number;      // 소수1자리
  tier: "high" | "mid" | "low";
  suggestion: string;         // metricSuggestion (처방)
  selfEvidence?: string;      // 자사 근거 첫 문장 (현상)
  leaderEvidence?: string;    // target 달성 리더의 근거 첫 문장 (참고)
  leaderName?: string;        // 그 리더 이름
}

interface ImprovementPlan {
  self: { name: string; overall: number | null; rank: number; total: number };
  leaders: { name: string; overall: number | null }[];   // [1위, 2위]
  gapToTop: number | null;                                // 1위 종합 − 자사 종합
  items: ImprovementItem[];                               // projectedGain desc
  projectedOverallIfHigh: number | null;                  // 자사 종합 + Σ high gains (예상)
}

function buildImprovementPlan(companies: CompanyRecord[], weights: Weights): ImprovementPlan
```

근거 선택(현상·참고)은 기존 `summary.ts`의 로직과 동일해야 하므로, `firstSentence`와
행 근거 선택을 `packages/web/src/lib/evidence.ts`로 추출해 `summary.ts`·`improvement.ts`가
공유한다(중복 제거 리팩터, 기존 summary 테스트로 회귀 보호).

### 엣지 케이스

- 자사(`isSelf`) 없음: 빈 `items`, self.overall null → 안내 문구.
- 회사 2개 미만: leaders 부족 시 존재하는 것만. target 계산은 존재값만.
- 지표 근거 없음: evidence 필드 생략.
- 자사가 이미 1위: gap 없는 항목뿐 → items 빈 배열 + "선도 중" 안내.

## 화면 (`packages/web/src/components/ImprovementView.tsx` + `app/improvement/page.tsx`)

서버 컴포넌트(인터랙션 불필요). 페이지는 홈과 동일 패턴으로 데이터 로드 후
`buildImprovementPlan` 결과를 뷰에 전달.

1. **헤더 요약 패널**: 자사 종합·순위(9위/13), 1·2위 목표 점수, 격차(−14.2),
   "최우선 항목 모두 리더 수준 개선 시 종합 73.6 → 약 XX (예상)".
2. **우선순위 섹션** (high → mid → low 순, 각 티어 헤더 + 항목 수):
   각 항목 카드:
   - 순번 + 지표 라벨 + 축 태그 + `+X.X점` 배지(예상 기여)
   - 점수 비교: `자사 56 · 1위 64 · 2위 78` (자사=scoreColor, 격차 막대)
   - 현상: 자사 근거 (muted)
   - 처방: `→ suggestion` (signal 색)
   - 참고: `1위 Lambda256 사례` + leaderEvidence (있을 때, 접힘/작게)
3. 빈 상태: 자사 없음/선도 중 안내.

스타일 토큰(`--muted/--signal/--line/--ink`, `scoreColor`, `AxisTag` 패턴)과
`panel` 클래스를 재사용. 반응형은 기존 `max-w-6xl` 컨테이너 안.

## 네비게이션

`layout.tsx`의 `NAV` 배열에 `{ href: "/improvement", label: "자사 개선 방향" }` 추가.

## 테스트

- `evidence.test.ts`: `firstSentence`(2문장/무마침표), 행 근거 선택(perModel 최근접).
- `improvement.test.ts`:
  - effWeight·projectedGain 계산(격차×실효가중), target=max(1·2위).
  - 정렬(projectedGain desc), 티어 경계(1.0, 0.3).
  - gap≤0 항목 제외.
  - selfEvidence·leaderEvidence·suggestion 부착.
  - 자사 없음/1위(빈 items) 엣지.
  - `projectedOverallIfHigh` = 자사 종합 + Σ high gains.
- 기존 `summary.test.ts` 회귀(evidence 추출 리팩터 후에도 통과).

## 영향 범위

- 신규: `lib/improvement.ts`, `lib/evidence.ts`, `components/ImprovementView.tsx`,
  `app/improvement/page.tsx`, `lib/improvement.test.ts`, `lib/evidence.test.ts`.
- 변경: `lib/summary.ts`(evidence 유틸 추출 사용), `app/layout.tsx`(NAV 1줄).
- 무변경: 데이터 provider, core, 순위/상세 페이지.
