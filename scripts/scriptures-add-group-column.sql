-- scriptures 테이블에 scripture_group 컬럼 추가
-- nested 폴더로 묶인 다권 경전의 그룹(첫 폴더명, K-suffix 포함)을 저장한다.
-- 단권/평면 파일은 NULL.

alter table public.scriptures
  add column if not exists scripture_group text;

create index if not exists scriptures_group_idx
  on public.scriptures (scripture_group);
