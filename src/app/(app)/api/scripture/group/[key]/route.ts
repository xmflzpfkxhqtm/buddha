// app/api/scripture/group/[key]/route.ts
// Layer 2 (그룹 상세 + 권 리스트) 용. 기존 API 동결, 이 라우트는 순수 additive.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import { type ScriptureGroupRow } from '@/types/scripture';

export const runtime = 'nodejs';

const PAGE_SIZE = 1000;

type GroupRow = ScriptureGroupRow;

type VolumeRow = {
  title: string;
  volume_no: number | null;
  filename: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key: rawKey } = await params;
  if (!rawKey) {
    return NextResponse.json({ error: 'No group key provided' }, { status: 400 });
  }

  // path 세그먼트는 Next.js가 decodeURIComponent 처리하지만 NFC 정규화는 안 함.
  // 기존 코드 컨벤션 (route.ts) 과 동일하게 보수적으로 정규화.
  const key = rawKey.trim().replace(/﻿/g, '').normalize('NFC');

  try {
    const { data: groupData, error: groupErr } = await supabase
      .from('scripture_groups')
      .select(
        'group_key, display_name, chinese_title, translator, intro, school_tags, topic_tags, is_featured, volume_total, k_code',
      )
      .eq('group_key', key)
      .maybeSingle();

    if (groupErr) {
      console.error('scripture_groups 조회 오류:', groupErr);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }
    if (!groupData) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const volumes: VolumeRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('scriptures')
        .select('title, volume_no, filename')
        .eq('group_key', key)
        .order('volume_no', { ascending: true, nullsFirst: false })
        .order('title', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('scriptures 조회 오류:', error);
        return NextResponse.json({ error: 'DB error' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      volumes.push(...(data as VolumeRow[]));
      if (data.length < PAGE_SIZE) break;
    }

    return NextResponse.json(
      { group: groupData as GroupRow, volumes },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('group route 오류:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
