// app/api/tts/route.ts
export const runtime = 'nodejs';
export const maxDuration = 60;       // 60 s (안전)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // SERVICE  KEY!
);

function makeKey({ scripture_id, line_index, voice = 'ko-KR-Wavenet-C' }: any) {
  return crypto.createHash('sha1')
    .update(`${scripture_id}:${line_index}:${voice}`)
    .digest('hex') + '.mp3';
}

export async function POST(req: NextRequest) {
  const body = await req.json();      // {scripture_id,line_index,text,voice?}
  const key  = makeKey(body);

  /* 1) 이미 스토리지에 있으면 → URL만 바로 리턴 */
  const { data: hit } = await supabase
    .storage.from('tts')
    .createSignedUrl(key, 60);
  if (hit?.signedUrl) {
    return NextResponse.json({ url: hit.signedUrl });
  }

  /* 2) 없으면 큐 테이블에 upsert (중복 insert 방지) */
  await supabase.from('tts_queue').upsert({ key, ...body });

  /* 3) 202 Accepted + 더미 2 KB → Edge 25 s 룰 회피 */
  return new Response(
    JSON.stringify({ status: 'processing' }).padEnd(2048, ' '),
    { status: 202, headers: { 'content-type': 'application/json' } }
  );
}
