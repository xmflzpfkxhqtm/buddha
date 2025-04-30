// app/api/tts/route.ts
export const runtime = 'nodejs';
export const maxDuration = 60;       // 60 s (안전)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;  // 느낌표로 non-null 단언

interface TTSRequest {
  scripture_id: string;
  line_index:  number;
  text:        string;
  voice?:      string;
}




const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // SERVICE  KEY!
);

function makeKey({ scripture_id, line_index, voice = 'ko-KR-Wavenet-C' }: TTSRequest) {
  return crypto
    .createHash('sha1')
    .update(`${scripture_id}:${line_index}:${voice}`)
    .digest('hex') + '.mp3';
}

export async function POST(req: NextRequest) {
  const body: TTSRequest = await req.json();
  const key = makeKey(body);
  /* 이하 동일 */

  const { data: row } = await supabase
    .from('tts_queue')
    .select('url')          // url 컬럼만
    .eq('key', key)
    .maybeSingle();

  if (row?.url) {
    return NextResponse.json({ url: row.url });   // 캐시 HIT
  }



  /* 1) 이미 스토리지에 있으면 → URL만 바로 리턴 */
  const { data: hit } = await supabase
    .storage.from('tts-audios')
    .createSignedUrl(key, 60);
  if (hit?.signedUrl) {
    return NextResponse.json({ url: hit.signedUrl });
  }

  /* 2) 없으면 큐 테이블에 upsert (중복 insert 방지) */
  await supabase.from('tts_queue').upsert({ key,
    ready: false,                        // ★ 추가 ①
    ...body });

  /* 3) 방금 만든 잡을 바로 처리하도록 워커 호출 */
   void fetch(`${SUPABASE_URL}/functions/v1/tts_worker`, {
      method : 'POST',
      // keepalive 옵션을 주면 커넥션을 백그라운드에 맡기고
      // 현재 이벤트 루프 핸들을 잡아먹지 않습니다.
      keepalive : true,
    }).catch(() => {/* 로그만 */});
  

  /* 3) 202 Accepted + 더미 2 KB → Edge 25 s 룰 회피 */
  return new Response(
    JSON.stringify({ status: 'processing' }).padEnd(2048, ' '),
    { status: 202, headers: { 'content-type': 'application/json' } }
  );
}
