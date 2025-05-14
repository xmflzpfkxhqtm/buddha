// src/app/api/bookmark/load/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const title = searchParams.get('title'); // title도 함께 필터

  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', user_id)
    .eq('title', title)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
