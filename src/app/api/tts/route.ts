// app/api/tts/route.ts
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface TTSRequest {
  scripture_id: string;
  line_index:  number;
  text:        string;
  voice?:      string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function makeKey({ scripture_id, line_index, voice = 'ko-KR-Wavenet-C' }: TTSRequest) {
  return crypto
    .createHash('sha1')
    .update(`${scripture_id}:${line_index}:${voice}`)
    .digest('hex') + '.mp3';
}
async function getSignedUrl(key: string): Promise<string | null> {
  // console.log(`[getSignedUrl] Generating signed URL for key: ${key}`); // 디버깅용 로그 추가
  const { data, error } = await supabase
    .storage.from('tts-audios')
    .createSignedUrl(key, 60 * 5); // 5분 유효기간

  if (error) {
    // 'Object not found' 는 정상적인 캐시 미스일 수 있으므로 에러 로깅 안 함
    if (!error.message.includes('Object not found')) {
       console.error(`[getSignedUrl] Storage Error for key ${key}:`, error.message);
    }
    return null; // 에러가 있으면 URL 없음
  }

  // 에러가 없더라도 data 객체와 signedUrl 속성이 있는지 확인 (TypeScript 추론 도움)
  if (!data || !data.signedUrl) {
    console.warn(`[getSignedUrl] No error but signedUrl is missing for key ${key}. Data:`, data);
    return null; // 예상치 못한 상황, URL 없음
  }

  // console.log(`[getSignedUrl] Successfully got signed URL for key: ${key}`); // 디버깅용 로그
  return data.signedUrl; // 이제 data.signedUrl 접근이 안전함
}

export async function POST(req: NextRequest) {
  const body: TTSRequest = await req.json();
  const key = makeKey(body);

  console.log(`[API /tts] Received request for key: ${key}`);

  /* 1) 스토리지에서 직접 확인 (가장 빠른 캐시 히트) */
  const storageUrl = await getSignedUrl(key);
  if (storageUrl) {
    console.log(`[API /tts] Cache HIT (Storage): ${key}`);
    return NextResponse.json({ url: storageUrl });
  }

  console.log(`[API /tts] Cache MISS (Storage): ${key}. Checking queue...`);

  /* 2) 큐 테이블 확인 */
  const { data: job, error: dbError } = await supabase
    .from('tts_queue')
    .select('ready') // ready 상태만 필요
    .eq('key', key)
    .maybeSingle();

  if (dbError) {
    console.error(`[API /tts] DB Error checking queue for ${key}:`, dbError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  if (job) {
    // --- 작업이 큐에 있음 ---
    if (job.ready) {
      // Case A: 작업 완료됨 -> Storage URL 다시 생성해서 반환
      console.log(`[API /tts] Cache HIT (Queue Ready): ${key}`);
      const finalUrl = await getSignedUrl(key);
      if (finalUrl) {
        return NextResponse.json({ url: finalUrl });
      } else {
        // 큐에는 ready인데 Storage에 파일이 없는 이상한 경우 (오류 처리)
        console.error(`[API /tts] Discrepancy: Job ready but file not in storage for key ${key}. Re-queuing.`);
        // 문제가 있으니 작업을 다시 큐에 넣는 로직을 추가하거나 에러 반환
         await supabase.from('tts_queue').upsert({ key, ready: false, ...body });
         // 워커 호출 (혹시 모르니 다시)
         fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tts_worker`, { method: 'POST' });
         return NextResponse.json({ status: 'processing' }, { status: 200 }); // 다시 처리 중 상태 반환
      }
    } else {
      // Case B: 작업 진행 중 -> 'processing' 상태 반환
      console.log(`[API /tts] Job PENDING (In Queue): ${key}`);
      return NextResponse.json({ status: 'processing' }, { status: 200 }); // 200 OK + 상태 정보
    }
  } else {
    // --- 작업이 큐에 없음 ---
    // Case C: 새 작업 -> 큐에 넣고 워커 호출, 'pending' 상태 반환
    console.log(`[API /tts] Job NEW: ${key}. Adding to queue and triggering worker.`);
    const { error: upsertError } = await supabase.from('tts_queue').upsert({
      key,
      ready: false,
      scripture_id: body.scripture_id,
      line_index: body.line_index,
      text: body.text, // 필요하면 voice도 저장
    });

    if (upsertError) {
      console.error(`[API /tts] DB Error upserting job for ${key}:`, upsertError);
      return NextResponse.json({ error: 'Failed to queue job' }, { status: 500 });
    }

    // 워커 호출 (백그라운드에서 실행되므로 await 필요 없음)
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tts_worker`, {
      method: 'POST',
    }).catch(err => console.error('[API /tts] Failed to trigger worker:', err)); // 호출 실패 로깅

    // 클라이언트에게 작업이 시작되었고 폴링해야 함을 알림
    return NextResponse.json({ status: 'pending' }, { status: 200 }); // 200 OK + 상태 정보
  }
}