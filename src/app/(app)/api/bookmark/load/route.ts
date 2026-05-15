// src/app/api/bookmark/load/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const title = searchParams.get('title'); // title도 함께 필터

  // bookmarks → highlights 마이그. 옛 응답 형태 유지 위해 index 컬럼을 alias 로 노출.
  const { data, error } = await supabase
    .from('highlights')
    .select('id, user_id, title, start_sentence, end_sentence, anchor_start_text, anchor_end_text, memo, created_at')
    .eq('user_id', user_id)
    .eq('title', title)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
