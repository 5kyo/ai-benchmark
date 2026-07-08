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
