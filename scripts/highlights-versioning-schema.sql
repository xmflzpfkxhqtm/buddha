-- Phase 5A — Highlight 위치 versioning (docs/recommendations.md… 아니 docs/highlights-versioning.md 참고)
-- 본문이 업데이트되어도 사용자 highlight 를 forward-only 로 재앵커링하기 위한 schema.
-- additive only — 옛 row 통과 안전, 옛 코드 영향 없음.
--
-- 적용:
--   Supabase SQL Editor 에서 통째 실행. 또는 psql 직접.
--   atomic 트랜잭션 X — 각 ALTER 가 독립 (Postgres 가 자동). 실패 시 부분 적용 가능 — idempotent 작성.

-- ============================================================================
-- 1. scriptures.content_version — 본문 버전. 업데이트 시 increment.
-- ============================================================================
alter table public.scriptures
  add column if not exists content_version int not null default 1;

alter table public.scriptures
  add column if not exists content_updated_at timestamptz not null default now();

-- 옛 row 들은 default 로 자동 채워짐 (1, now()). 첫 실제 업데이트 시 increment.

-- ============================================================================
-- 2. highlights — anchor_status + resolved_version
-- ============================================================================
alter table public.highlights
  add column if not exists anchor_status text not null default 'ok';

-- 'ok'        : 좌표 신선 (resolved_version == 현재 content_version)
-- 'rematched' : 본문 변경 후 cascade 로 새 위치 매핑됨 (자연 진행)
-- 'orphaned'  : cascade 실패. memo/highlight_text 만 보존, 본문 시각화 없음.
-- 'pending'   : 본문 업데이트 직후 cascade 재실행 대기 (migration script 용 임시 상태)

alter table public.highlights
  add column if not exists resolved_version int;

-- ============================================================================
-- 3. 옛 row backfill — 현재 본문 기준 'ok' 상태로 시작
-- ============================================================================
-- 모든 기존 highlight: anchor_status = 'ok' (이미 default), resolved_version = 1 (현재 default).
-- 명시적으로 set 해서 NULL 방지.
update public.highlights
  set resolved_version = 1
where resolved_version is null;

-- 이후 NOT NULL 강제 (column add 시점에 일부 row 가 null 일 수 있으므로 update 후 alter)
alter table public.highlights
  alter column resolved_version set not null;

alter table public.highlights
  alter column resolved_version set default 1;

-- ============================================================================
-- 4. 인덱스 — title 별 anchor_status 필터 빠르게 (orphan 카운터용)
-- ============================================================================
create index if not exists highlights_title_anchor_idx
  on public.highlights (title, anchor_status);

-- ============================================================================
-- 검증 쿼리 (적용 후 실행)
-- ============================================================================
-- select content_version, count(*) from public.scriptures group by 1;
--   → 모두 1 이어야 함
-- select anchor_status, count(*) from public.highlights group by 1;
--   → 모두 'ok' (옛 row 전부)
-- select count(*) from public.highlights where resolved_version is null;
--   → 0
