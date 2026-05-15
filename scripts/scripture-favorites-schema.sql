-- 사용자별 경전(그룹) 즐겨찾기. 권 단위가 아닌 group_key 단위.
-- 본문 위치 표시용 bookmarks 테이블과는 별개.

create table if not exists public.scripture_favorites (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  group_key  text        not null references public.scripture_groups(group_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_key)
);

create index if not exists scripture_favorites_user_idx
  on public.scripture_favorites (user_id, created_at desc);

-- RLS: 본인 row 만 select / insert / delete
alter table public.scripture_favorites enable row level security;

drop policy if exists scripture_favorites_select_own on public.scripture_favorites;
create policy scripture_favorites_select_own on public.scripture_favorites
  for select using (auth.uid() = user_id);

drop policy if exists scripture_favorites_insert_own on public.scripture_favorites;
create policy scripture_favorites_insert_own on public.scripture_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists scripture_favorites_delete_own on public.scripture_favorites;
create policy scripture_favorites_delete_own on public.scripture_favorites
  for delete using (auth.uid() = user_id);
