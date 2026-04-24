// app/api/scripture/list/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('scriptures')
      .select('title')
      .not('title', 'ilike', '%용어사전%');

    if (error) {
      console.error('파일 목록 불러오기 실패:', error);
      return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
    }

    const titles = (data ?? [])
      .map((row) => row.title as string)
      .map((title) => title.trim().replace(/﻿/g, '').replace(/\s/g, '').normalize('NFC'))
      .sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));

    return NextResponse.json({ titles });
  } catch (error) {
    console.error('파일 목록 불러오기 실패:', error);
    return NextResponse.json({ error: '불러오기 실패' }, { status: 500 });
  }
}
