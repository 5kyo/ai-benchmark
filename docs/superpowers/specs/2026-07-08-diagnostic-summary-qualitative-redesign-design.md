# 진단 요약 정성 재설계 — "근거 기반 해석"

날짜: 2026-07-08

## 배경

상세 페이지 좌측 컬럼의 **진단 요약**(`CompanySummary`) 패널은 현재 점수·라벨 중심의
정량 정보로 구성돼 있다. 헤드라인 한 줄 + "잘하고 있는 점" 점수 리스트(예: 5개 항목이
모두 100점) + "개선하면 좋은 점" 점수 리스트(각 항목에 개선 제안 서술).

레이더 차트와 우측 지표 표(`MetricTable`)에 이미 점수·근거가 풍부하게 노출돼 있어,
요약 패널에서 점수를 반복하는 것은 정보 가치가 낮다. 요약 패널이 더해야 할 것은
**정성적 해석** — "왜 이런 점수인가"를 실제 근거로 읽히게 하는 서술이다.

## 목표

진단 요약을 **실제 근거(evidence)를 합성한 정성 서술** 중심으로 재설계한다. 정량 상세는
우측 지표 표에 맡기고, 요약 패널은 **선별된 소수 항목의 우선순위 서술**을 제공한다.
모든 계산은 기존과 동일하게 결정론적(뷰가 바뀌면 함께 갱신)으로 유지한다.

## 비목표

- LLM 실시간 생성이나 회사별 수기 총평 도입(현재 파이프라인 밖).
- 우측 `MetricTable`의 전(全) 지표 근거 노출 방식 변경.
- 점수 임계값(STRONG=85, WEAK=60)·강점/약점 선별 개수 로직의 근본 변경.

## 설계

### 데이터: `buildSummary` (`packages/web/src/lib/summary.ts`)

`SummaryItem`에 서술 재료를 추가한다.

```ts
export interface SummaryItem {
  axis: Axis;
  metricKey: string;
  label: string;
  score: number;
  evidence?: string;    // 신규: 근거 첫 문장(합성용)
  suggestion?: string;  // 기존: 약점 항목 개선 제안
  grouped?: boolean;    // 신규: 규칙 만점 묶음 항목(렌더에서 점수 숨김)
}
```

근거 선택 규칙:

1. **근거 소스**: `MetricRow.evidence`. 평균 뷰에서 `perModel`(모델별 근거 다수)이 있으면
   **합쳐진 점수(`row.score`)에 가장 가까운 모델**의 evidence 1개를 고른다(동점 시 배열 앞선 것).
2. **길이**: evidence의 **첫 문장만** 사용한다(`"…. "` 또는 `"…."` 기준 분리). 전문은 우측 표에 있다.
3. **없을 때**: evidence가 없으면 `evidence`를 비워 두고 라벨·점수만 표시한다.

강점 항목의 **규칙 만점 묶기**: 강점 목록 안에서 **같은 축의 규칙(비-LLM) 지표 중 만점(round 100)**이
2개 이상이면, 개별 나열 대신 한 개의 합성 항목으로 압축한다.

- 축의 규칙 만점 항목들을 1개의 "기본기" 항목으로 대체: `label = "<축라벨> 기본기"`,
  `evidence = "<지표라벨1>·<지표라벨2>… 등 기본 신호를 갖췄습니다."`, `score`는 표시하지 않음(묶음 표식).
- LLM 강점 지표는 개별 유지(각자 evidence 서술).
- 규칙/LLM 판별은 `glossary.ts`의 `LLM_METRIC_KEYS`(=`metricScorer`) 사용.
- 묶음 항목은 `SummaryItem.grouped = true`로 표식하고, 렌더에서 점수를 숨긴다
  (`score`는 대표값으로 100을 담되 표시하지 않음).

전체 강점 개수 상한(5)은 묶은 뒤 기준으로 적용한다.

### 렌더: `CompanySummary` (`packages/web/src/components/CompanySummary.tsx`)

세 블록 구조 유지, 서술을 얹는다.

1. **총평**: 기존 `headline` 한 줄 그대로(정량 앵커).
2. **강점(▲)**: 항목마다 `라벨 (점수) · <축태그>` + 아래 줄에 `evidence`(있으면). 묶음 항목은
   점수 숨김, evidence만.
3. **개선 우선순위(▼)**: 항목마다 `라벨 (점수) · <축태그>` + `evidence`(현상) + `→ suggestion`(처방).
   evidence가 없으면 suggestion만.

스타일은 기존 토큰(`--muted`, `scoreColor`, `AxisTag`, `text-xs leading-snug`)을 재사용한다.
근거 서술은 `--muted` 톤으로, 제안(→)은 기존과 동일하게 표시한다.

## 데이터 흐름

`metricRowsForView` → `MetricRow[]`(evidence·perModel 포함) → `buildSummary`가 근거 선택·묶기 →
`SummaryItem[]` → `CompanySummary` 렌더. 뷰 전환(단일/평균) 시 rows가 갱신되며 요약도 재계산된다.

## 엣지 케이스

- 강점 없음(85점 이상 없음): 기존 "85점 이상 항목이 아직 없습니다." 유지.
- 약점 임계 미달(60점 미만 없음): 기존 fallback(하위 3개 + "(상대적으로 낮은 항목)") 유지.
- evidence 전무: 라벨·점수만. 회귀 없이 기존 동작으로 자연 축소.
- 규칙 만점이 1개뿐: 묶지 않고 개별 표시.
- 첫 문장 분리 실패(마침표 없음): evidence 전체를 그대로 사용.

## 테스트 (`summary.test.ts` 확장)

- evidence 첫 문장 추출(2문장 → 첫 문장, 마침표 없음 → 전체).
- perModel에서 점수 최근접 모델 evidence 선택.
- 같은 축 규칙 만점 2개 이상 → 1개 묶음 항목(라벨·묶음 evidence), LLM 강점은 개별 유지.
- 규칙 만점 1개 → 묶지 않음.
- 약점 항목에 evidence·suggestion 동시 부착.
- 기존 헤드라인·fallback 동작 회귀 없음.

## 영향 범위

- 변경: `packages/web/src/lib/summary.ts`, `packages/web/src/components/CompanySummary.tsx`,
  `packages/web/src/lib/summary.test.ts`.
- 무변경: `MetricTable`, 데이터 provider, glossary(읽기만).
