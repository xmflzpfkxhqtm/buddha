-- 사용자 highlight (책갈피 + 메모 + 미래 AI 문답 컨텍스트의 통합 모델).
-- 옛 `bookmarks` 테이블을 폐기하고 이 테이블로 통합. range (start_sentence ~ end_sentence) 지원.
-- anchor 텍스트 컬럼은 콘텐츠 normalize 후 fuzzy 복구용 (이전 논의 B안).

create table if not exists public.highlights (
  id                  uuid          primary key default gen_random_uuid(),
  user_id             uuid          not null references auth.users(id) on delete cascade,
  title               text          not null,        -- 옛 bookmarks 호환 (예: '금강반야바라밀경_K0013_1권')
  start_sentence      int           not null,
  end_sentence        int           not null,        -- 단일 sentence 는 start == end
  anchor_start_text   text,                          -- 저장 시점 start sentence 의 첫 50자 prefix
  anchor_end_text     text,                          -- 저장 시점 end sentence 의 첫 50자 prefix
  memo                text,
  ai_thread_id        uuid,                          -- 향후 AI 부처님 문답 연결점 (Phase 3)
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  constraint highlights_range check (start_sentence >= 0 and end_sentence >= start_sentence)
);

create index if not exists highlights_user_created_idx
  on public.highlights (user_id, created_at desc);
create index if not exists highlights_user_title_idx
  on public.highlights (user_id, title);

alter table public.highlights enable row level security;

drop policy if exists highlights_select_own on public.highlights;
create policy highlights_select_own on public.highlights
  for select using (auth.uid() = user_id);

drop policy if exists highlights_insert_own on public.highlights;
create policy highlights_insert_own on public.highlights
  for insert with check (auth.uid() = user_id);

drop policy if exists highlights_update_own on public.highlights;
create policy highlights_update_own on public.highlights
  for update using (auth.uid() = user_id);

drop policy if exists highlights_delete_own on public.highlights;
create policy highlights_delete_own on public.highlights
  for delete using (auth.uid() = user_id);

-- updated_at 자동 갱신 trigger
create or replace function public.set_highlights_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists highlights_updated_at on public.highlights;
create trigger highlights_updated_at
  before update on public.highlights
  for each row execute function public.set_highlights_updated_at();

-- ============================================================================
-- 데이터 마이그: 옛 bookmarks → highlights (단일 sentence highlight, anchor 없음)
-- 옛 row 의 index 가 그대로 start/end 가 됨. anchor 는 NULL 이라 normalize 후
-- 정확한 sentence 가 어긋날 수 있으나 graceful fallback 으로 처리 (코드 변경 측).
-- ============================================================================

insert into public.highlights
  (user_id, title, start_sentence, end_sentence, anchor_start_text, anchor_end_text, memo, created_at)
select
  user_id, title, index, index, null, null, memo, created_at
from public.bookmarks
on conflict do nothing;

-- bookmarks 테이블은 일단 유지 (rollback safety). 신규 코드 안정화 확인 후
-- 별도 SQL 로 drop 예정:
--   drop table public.bookmarks;
