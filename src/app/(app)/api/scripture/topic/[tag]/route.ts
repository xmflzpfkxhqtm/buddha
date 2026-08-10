// app/api/scripture/topic/[tag]/route.ts
// Topic Layer 용. 특정 태그 (school 또는 topic) 가 포함된 모든 그룹.
// 기존 API 동결, 이 라우트는 순수 additive.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { type ScriptureGroupRow } from '@/types/scripture';

export const runtime = 'nodejs';

const PAGE_SIZE = 1000;

type GroupRow = ScriptureGroupRow;

const SELECT_COLS =
  'group_key, display_name, chinese_title, translator, intro, school_tags, topic_tags, is_featured, volume_total, k_code';

async function fetchByCol(col: 'topic_tags' | 'school_tags', tag: string): Promise<GroupRow[]> {
  const rows: GroupRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('scripture_groups')
      .select(SELECT_COLS)
      .contains(col, [tag])
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as GroupRow[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag: rawTag } = await params;
  if (!rawTag) {
    return NextResponse.json({ error: 'No tag provided' }, { status: 400 });
  }
  // path segment 는 Next.js 가 decodeURIComponent 처리하지만 NFC 정규화는 안 함.
  const tag = rawTag.trim().replace(/﻿/g, '').normalize('NFC');
  if (!tag) {
    return NextResponse.json({ error: 'Empty tag' }, { status: 400 });
  }

  try {
    // school_tags / topic_tags 둘 다에서 검색해 합집합 (한 그룹이 두 태그 분류 동시 보유 가능)
    const [topicRows, schoolRows] = await Promise.all([
      fetchByCol('topic_tags', tag),
      fetchByCol('school_tags', tag),
    ]);

    const seen = new Set<string>();
    const merged: GroupRow[] = [];
    for (const r of [...topicRows, ...schoolRows]) {
      if (!seen.has(r.group_key)) {
        seen.add(r.group_key);
        merged.push(r);
      }
    }

    // 정렬: featured 우선, 그 다음 display_name 가나다순
    merged.sort((a, b) => {
      const fa = a.is_featured ? 1 : 0;
      const fb = b.is_featured ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const na = a.display_name ?? a.group_key;
      const nb = b.display_name ?? b.group_key;
      return na.localeCompare(nb, 'ko-KR', { numeric: true });
    });

    return NextResponse.json(
      { tag, groups: merged },
      {
        headers: {
          // 그룹 메타는 LLM 갱신 시점에만 바뀜 — 사실상 정적
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('topic route 오류:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
