// app/api/scripture/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title');

  if (!title) {
    return NextResponse.json({ error: 'No title provided' }, { status: 400 });
  }

  try {
    const normalized = title
      .trim()
      .replace(/﻿/g, '')
      .replace(/\s/g, '')
      .normalize('NFC');

    const { data, error } = await supabase
      .from('scriptures')
      .select('content, format, filename')
      .eq('title', normalized)
      .maybeSingle();

    if (error) {
      console.error('scripture 조회 오류:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({
      content: data.content,
      format: data.format,
      sourceFile: data.filename,
    });
  } catch (error) {
    console.error('scripture 조회 오류:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
