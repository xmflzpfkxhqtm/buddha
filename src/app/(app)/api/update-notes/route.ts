// app/api/update-notes/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function GET() {
  const { data, error } = await supabase
    .from('update_notes')
    .select('id, title, body, published_at')
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('update_notes 조회 오류:', error);
    return NextResponse.json({ notes: [] }, { status: 500 });
  }

  // Supabase Table editor 에서 줄바꿈을 `\n` 두 글자로 입력해도 자연스럽게 표시되도록 변환.
  const notes = (data ?? []).map((n) => ({
    ...n,
    body: typeof n.body === 'string' ? n.body.replace(/\\r\\n|\\n/g, '\n') : n.body,
  }));

  return NextResponse.json(
    { notes },
    {
      headers: {
        // 운영자가 Supabase 에서 편집 후 ~5분 내 노출. 그 후 1일까지 stale 응답하며 백그라운드 갱신.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
      },
    },
  );
}
