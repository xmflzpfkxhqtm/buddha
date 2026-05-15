-- Layer 1/2를 위한 group-level 메타데이터 테이블
-- 각 row = 한 경전 그룹 (단권 또는 다권 묶음)

create table if not exists public.scripture_groups (
  group_key text primary key,                    -- 예: '도행반야경', '금강반야바라밀경_K0013'
  display_name text not null,                    -- 예: '도행반야경'
  chinese_title text,                            -- 예: '道行般若經'
  translator text,                               -- 예: '구마라집 한역'
  intro text,                                    -- 2~3문장 소개
  school_tags text[] default '{}',               -- 교파 (1~2개)
  topic_tags text[] default '{}',                -- 주제 (2~3개)
  is_featured boolean default false,             -- 주요 경전 시드
  confidence numeric(3,2),                       -- LLM 자기평가
  volume_total int default 1,                    -- 총 권 수
  k_code text,                                   -- 고려대장경 번호 (예: 'K0013')
  generated_by text,                             -- 'sonnet-4-6' 등
  generated_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scripture_groups_school_tags_gin on public.scripture_groups using gin (school_tags);
create index if not exists scripture_groups_topic_tags_gin on public.scripture_groups using gin (topic_tags);
create index if not exists scripture_groups_featured_idx on public.scripture_groups (is_featured) where is_featured = true;
create index if not exists scripture_groups_display_name_idx on public.scripture_groups (display_name);

-- 권 단위 scriptures 테이블에 volume_no 추가 (정렬·라우팅용)
alter table public.scriptures add column if not exists volume_no int;
alter table public.scriptures add column if not exists group_key text;

-- group_key는 scripture_group 또는 title에서 _N권 suffix 제거
update public.scriptures
set group_key = coalesce(scripture_group, regexp_replace(title, '_\d+권$', ''))
where group_key is null;

-- volume_no는 title 끝의 _N권 또는 NULL이면 1
update public.scriptures
set volume_no = coalesce(
  (regexp_match(title, '_(\d+)권$'))[1]::int,
  (regexp_match(title, '/(\d+)권$'))[1]::int,
  1
)
where volume_no is null;

create index if not exists scriptures_group_key_idx on public.scriptures (group_key, volume_no);
