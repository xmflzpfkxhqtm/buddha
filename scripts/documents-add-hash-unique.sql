-- documents 테이블에 청크 hash 기반 중복 방지 추가
-- metadata->>'hash' 를 generated column 으로 노출하여 unique index/onConflict 지원.
-- 적용 시점: documents 테이블이 비어있을 때 (TRUNCATE 직후) 권장.

alter table public.documents
  add column if not exists hash text
  generated always as (metadata->>'hash') stored;

create unique index if not exists documents_hash_unique
  on public.documents (hash);
