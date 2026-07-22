# 경쟁사 변화 감지("변화 소식") 설계

- 작성일: 2026-07-22
- 상태: 설계 승인됨 (구현 전)
- 관련: [자사 추이 설계](2026-07-09-self-trend-history-design.md), [전체 스펙](2026-07-08-ai-readability-benchmark-design.md)

## 배경 / 문제

대시보드는 최신 측정 결과와 자사 추이(/trend)만 보여준다. 경쟁사 홈페이지가 **무엇을 바꿨는지**(리뉴얼, llms.txt 추가, 새 제품 소개 등)는 재측정을 해도 점수 숫자 변화로만 간접적으로 드러나고, 점수에 안 잡히는 콘텐츠 변화는 아예 알 수 없다. 사용자는 재측정 시 "경쟁사에 어떤 업데이트가 있었는지"를 알림 형태로 받고 싶어 한다.

## 목표

- 재측정 시점에 직전 측정 대비 **① 콘텐츠/구조 변화 ② 벤치마크 점수 변화 ③ 순위 변동**을 자동 감지한다.
- 감지 결과를 **CLI 요약 + 커밋되는 변화 기록(JSON) + 마크다운 리포트 + 대시보드 "변화 소식" 페이지** 네 경로로 전달한다.
- 콘텐츠 변화는 기계적 diff로 감지하고, 변화가 있는 회사만 기존 로컬 배치 패턴(inbox → Claude Code 요약 → outbox → import)으로 **LLM 한줄 요약**을 붙인다.

## 비목표 (YAGNI)

- 주기적 자동 크롤/감지(GitHub Actions 등) — 재측정 시에만 실행. 후속 확장 가능.
- 홈페이지 외 하위 페이지 크롤 확대 — 현재 크롤 범위(홈페이지+robots+sitemap+llms.txt) 유지.
- 이메일/슬랙 등 외부 알림 채널 — 대시보드/리포트/CLI로 충분.
- Supabase 적재 — 기존 로컬 JSON 관례 유지.

## 핵심 설계 결정

1. **콘텐츠 지문(fingerprint)은 별도 아카이브로 커밋한다.** raw/는 gitignore(휘발성)이고 snapshots/<date>.json은 점수 전용이므로, `snapshots/content/<YYYY-MM-DD>/<slug>.json`에 title·메타·헤딩·본문 텍스트·해시를 저장한다. 점수 스냅샷 스키마와 history.ts 로드 경로를 건드리지 않는다.
2. **변화 기록(`changes/<date>.json`)에는 당시 계산된 delta를 저장한다.** /trend의 "파생값 저장 안 함" 원칙과 다르게, 변화 소식은 **그 시점에 알린 내용의 기록물**이다. weights를 나중에 바꿔도 과거 리포트가 소급 변경되면 안 되므로 의도적 예외로 한다.
3. **LLM 요약은 기존 inbox/outbox 패턴과 동형.** prepare-scores → 채점 → import-scores 흐름을 그대로 본떠 detect-changes → 요약 → import-change-summaries로 구성한다. 런타임 API 호출 없음(로컬 배치 원칙 유지).
4. **노이즈 임계값.** 점수 diff는 종합·축 기준 ±3점 이상만 "변화"로 취급(상수로 두되 detect-changes 내 config 객체로 분리해 조정 용이하게). 본문 변경률은 1% 미만이면 무시(광고 배너·날짜 등 잡음 방지).

## 아키텍처 / 컴포넌트

### 1. 콘텐츠 지문 아카이브 (`snapshots/content/`)

- 위치: `snapshots/content/<YYYY-MM-DD>/<slug>.json` (커밋 대상).
- 포맷:
  ```json
  {
    "slug": "alchemy",
    "date": "2026-07-22",
    "url": "https://www.alchemy.com/",
    "title": "...",
    "metaDescription": "...",
    "headings": [{ "level": 1, "text": "..." }],
    "text": "정규화된 본문 텍스트 (extractText 재사용, 상한 내)",
    "textHash": "sha256 hex"
  }
  ```
- 추출: 신규 순수함수 모듈 `packages/scoring/src/fingerprint.ts`
  - `extractFingerprint(html, url, slug, date): Fingerprint` — 기존 `text.ts`의 `extractText` 재사용 + title/meta/헤딩 파싱(정규식 기반, 크롤러의 기존 HTML 파싱 관례 준수). 해시는 node:crypto sha256.
- 기록: `gen-measured.ts` 확장. raw 최신 파일을 읽는 기존 루프에서 회사별로 지문 추출 → 해당 날짜 디렉터리에 기록. `--date` 옵션·같은 날 덮어쓰기 규칙은 점수 스냅샷과 동일.
- raw 파일이 없거나 homepage.status ≠ 200인 회사는 지문 생략(파일 미생성).

### 2. 변화 감지 CLI (`pnpm detect-changes`)

- 파일: `packages/scoring/src/cli-detect.ts` + 순수 로직 `packages/scoring/src/detect.ts`. 루트 package.json scripts에 `"detect-changes"` 추가.
- 입력: 기본 = `snapshots/`의 최신 날짜(to)와 그 직전 날짜(from). `--from=YYYY-MM-DD --to=YYYY-MM-DD`로 재정의 가능.
- 비교 로직 (전부 순수함수, detect.ts):
  - `diffScores(fromCompanies, toCompanies, weights)` — core `overallForView`/`axisForView`(뷰='average')로 양쪽 재계산 후 delta. |Δ| ≥ 3(종합 또는 축)만 변화로 채택.
  - `diffRanks(fromCompanies, toCompanies, weights)` — 종합점 내림차순 순위 산출 후 순위 변동(신규 편입은 "신규").
  - `diffMetrics(fromCompany, toCompany)` — 규칙 지표(model='rule-based')의 score 변화 목록. evidence 병기(예: `llms_txt_present 0→100`).
  - `diffContent(fromFp, toFp)` — textHash 동일하면 변화 없음. 다르면: title/metaDescription 변경 여부, 헤딩 추가/삭제 목록, 본문 단어 단위 변경률 %(간단한 토큰 집합 비교 — LCS 불필요, added/removed 단어 비율).
- 출력:
  - `changes/<to날짜>.json` (커밋 대상): 변화가 감지된 회사만 항목 생성.
    ```json
    {
      "date": "2026-07-22",
      "fromDate": "2026-07-09",
      "generatedAt": "ISO",
      "entries": [
        {
          "slug": "alchemy",
          "name": "Alchemy",
          "kinds": ["content", "score", "rank"],
          "score": { "overall": { "from": 78, "to": 83 }, "axes": { "B": { "from": 54, "to": 66 } } },
          "rank": { "from": 3, "to": 2 },
          "metrics": [{ "metricKey": "llms_txt_present", "from": 0, "to": 100, "evidence": "..." }],
          "content": { "titleChanged": false, "metaChanged": true, "headingsAdded": ["AI Agent Platform"], "headingsRemoved": [], "textChangedPct": 12.4 },
          "summary": null
        }
      ]
    }
    ```
    `summary`는 이 단계에서 null — import-change-summaries가 채운다. `kinds`는 해당 회사에 잡힌 변화 유형 배지.
  - CLI 요약: 회사별 한 줄(변화 유형·주요 delta) + "N개사 변화 감지 / M개사 변화 없음" 총평.
  - `scoring/changes-inbox/<slug>.md` (gitignore, 아래 3절): 변화 감지된 회사만.
- 엣지 케이스:
  - 스냅샷이 1개 이하 → "비교 기준이 없습니다" 안내 후 정상 종료(에러 아님). changes 파일 미생성.
  - to 스냅샷에만 있는 회사 → entry에 `kinds: ["new"]`로 "신규 편입" 표기(점수/콘텐츠 diff 생략).
  - from에만 있는 회사(로스터 제외) → `kinds: ["removed"]`.
  - 지문 파일이 한쪽에만 있으면 콘텐츠 diff 생략(점수·순위 diff는 수행).
  - 같은 날짜 재실행 → `changes/<date>.json` 덮어쓰기.

### 3. LLM 요약 파이프라인

- `detect-changes`가 변화 회사별로 `scoring/changes-inbox/<slug>.md` 생성:
  - 내용: 회사 개요, 기계 diff 결과(위 entry 요약), 이전/현재 본문 텍스트 발췌(각 상한 적용), 요약 지시("무엇이 왜 바뀌었는지 한국어 1~2문장, JSON으로 출력").
  - 출력 계약: `scoring/changes-outbox/<slug>.json` = `{ "slug": "...", "summary": "..." }`.
- 사용자가 Claude Code(서브에이전트)로 inbox를 순회 요약 → outbox 기록. (기존 축 채점과 동일한 사용 패턴. 채점 모델 구분은 불필요하므로 outbox에 모델 하위 디렉터리 없음.)
- `pnpm import-change-summaries` (`packages/scoring/src/cli-import-summaries.ts`): outbox를 검증(slug 매칭, summary 비어있지 않음) 후 `changes/<최신날짜>.json`의 해당 entry `summary`에 병합. 이후 4절 리포트 생성까지 이어서 수행.
- inbox/outbox는 `scoring/inbox`·`outbox`처럼 gitignore.

### 4. 마크다운 리포트 (`reports/changes/<date>.md`)

- `import-change-summaries` 마지막 단계에서 생성(요약 없이 보고 싶으면 `pnpm detect-changes --report`로 summary 없는 버전도 생성 가능하게 순수함수 `buildChangeReport(changesFile): string` 공유).
- 구성: 제목(기간 from→to), 총평 1줄, 회사별 섹션(변화 유형 배지, LLM 요약, 점수/순위 delta 표, 지표 변화 목록, 헤딩 추가/삭제). 커밋 대상.

### 5. 웹 "변화 소식" 페이지 (`/changes`)

- 데이터: `packages/web/src/lib/data/changes.ts`
  - `loadChangeHistory(dir): ChangeFile[]` — 빌드타임 fs로 `changes/*.json` 로드, 날짜 내림차순. history.ts와 같은 방어적 파싱(깨진 파일 skip)·경로 해석(process.cwd() 기준 `../../changes`).
- 라우트: `packages/web/src/app/changes/page.tsx` (서버 컴포넌트, 정적 export 호환).
- 컴포넌트: `packages/web/src/components/ChangesView.tsx`
  - 날짜별 타임라인(최신 위) → 회사 카드: 변화 유형 배지(콘텐츠/점수/순위/신규), 점수 delta(상승=긍정색·하락=부정색, 기존 신호색 관례), 순위 변동(예: 3위→2위 ↑), 지표 변화, LLM 요약 문장(있을 때만).
  - 빈 상태: "아직 감지된 변화가 없습니다. 재측정 2회차부터 표시됩니다." 안내.
- nav: `layout.tsx` nav 배열에 `{ href: "/changes", label: "변화 소식" }` 추가("자사 추이" 다음).

## 데이터 흐름 (요약)

```
crawl → gen-measured ─┬─ measured.ts / snapshots/<date>.json          (기존)
                      └─ snapshots/content/<date>/<slug>.json          (신규: 지문)
pnpm detect-changes ──┬─ changes/<date>.json (기계 diff, summary=null)
                      ├─ CLI 요약 출력
                      └─ scoring/changes-inbox/<slug>.md (변화 회사만)
Claude Code 요약 ────── scoring/changes-outbox/<slug>.json
pnpm import-change-summaries ─┬─ changes/<date>.json에 summary 병합
                              └─ reports/changes/<date>.md
web build ──────────── changes/*.json → /changes 타임라인
```

## 오류 처리

- 비교 대상 스냅샷/지문 부재 → 해당 diff만 생략하거나 안내 후 정상 종료(위 엣지 케이스 참조).
- outbox 검증 실패(slug 불일치, summary 누락) → 해당 파일 skip + 경고 출력, 나머지 진행.
- changes/ 디렉터리 없음(웹) → 빈 히스토리, 빈 상태 안내.
- 지문 추출 실패(HTML 파싱 불가) → 해당 회사 지문 생략, gen-measured는 계속 진행.

## 테스트 (vitest, `*.test.ts`)

- `fingerprint.test.ts`: title/meta/헤딩/텍스트/해시 추출, 비정상 HTML 관용 처리.
- `detect.test.ts`: diffScores 임계값 경계(±3), diffRanks 신규/제외, diffMetrics evidence 병기, diffContent 해시 동일/변경률 계산/헤딩 diff, 1% 미만 무시.
- `cli-import-summaries` 병합 로직(순수 부분): outbox 검증·summary 병합.
- `buildChangeReport`: 대표 changes fixture → 마크다운 스냅샷 검증.
- `web changes.test.ts`: loadChangeHistory 정렬·방어 파싱.
- UI는 로직이 데이터 레이어에 있으므로 스모크 수준.

## 산출물 목록

- `packages/scoring/src/fingerprint.ts` + 테스트, `gen-measured.ts` 확장.
- `packages/scoring/src/detect.ts` + `cli-detect.ts` + 테스트, 루트 `detect-changes` script.
- `packages/scoring/src/cli-import-summaries.ts` + 리포트 순수함수 + 테스트, 루트 `import-change-summaries` script.
- `snapshots/content/`(커밋), `changes/`(커밋), `reports/changes/`(커밋), `scoring/changes-inbox|outbox`(.gitignore 추가).
- `packages/web/src/lib/data/changes.ts` + 테스트, `app/changes/page.tsx`, `components/ChangesView.tsx`, nav 항목.

## 열린 질문 / 후속

- 첫 실행은 기준(from) 지문이 없어 콘텐츠 diff가 비므로, 이번 구현 직후 재측정 1회를 돌려 지문 기준선을 만든다(점수 diff는 기존 snapshots 2개로 즉시 동작).
- 주기 자동화(GitHub Actions에서 기계 diff만)와 하위 페이지 확대는 후속.
