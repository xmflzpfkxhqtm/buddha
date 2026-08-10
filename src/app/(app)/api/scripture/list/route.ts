// app/api/scripture/list/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const PAGE_SIZE = 1000;

export async function GET() {
  try {
    const titles: string[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('scriptures')
        .select('title')
        .not('title', 'ilike', '%용어사전%')
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('파일 목록 불러오기 실패:', error);
        return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
      }
      if (!data || data.length === 0) break;
      for (const row of data) titles.push(row.title as string);
      if (data.length < PAGE_SIZE) break;
    }

    const normalized = titles
      .map((title) => title.trim().replace(/﻿/g, '').replace(/\s/g, '').normalize('NFC'))
      .sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));

    return NextResponse.json(
      { titles: normalized },
      {
        headers: {
          // Vercel Edge Network: 24h 캐시, 그 후 7일까지 stale 응답하면서 백그라운드 재검증.
          // 경전 목록은 migrate 시점에만 바뀌는 사실상 정적 데이터라 길게 잡음.
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('파일 목록 불러오기 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
