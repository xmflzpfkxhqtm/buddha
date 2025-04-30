// supabase/functions/tts_worker/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function googleTTS(text: string, voice: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' +
        Deno.env.get('GOOGLE_TTS_API_KEY'),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input:  { text },
          voice:  { languageCode: 'ko-KR', name: voice },
          audioConfig: { audioEncoding: 'MP3' }
        })
      }
    );
    if (!res.ok) {
      console.error(`Google TTS API Error: ${res.status} ${await res.text()}`);
      return null; // TTS 실패 시 null 반환
    }
    const { audioContent } = await res.json();
    if (!audioContent) {
       console.error('Google TTS API Error: No audio content received.');
       return null;
    }
    return Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
  } catch (error) {
    console.error('Error calling Google TTS API:', error);
    return null; // 네트워크 오류 등 예외 발생 시 null 반환
  }
}

serve(async () => {
  console.log('[Worker] Starting TTS worker cycle.');
  let processedCount = 0;

  for (;;) {
    // 1) 작업 가져오기 (ready=false 인 것)
    const { data: job, error: fetchError } = await supabase
      .from('tts_queue').select('*') // 모든 정보 가져오기 (text, voice 등)
      .eq('ready', false)
      .limit(1) // 한 번에 하나씩 처리
      .maybeSingle();

    if (fetchError) {
      console.error('[Worker] Error fetching job:', fetchError);
      break; // DB 오류 시 루프 중단
    }

    if (!job) {
      // console.log('[Worker] No pending jobs found. Exiting cycle.');
      break; // 처리할 작업 없으면 루프 종료
    }

    const { key, text, voice } = job;
    console.log(`[Worker] Processing job for key: ${key}`);

    // 2) Google TTS 호출
    const mp3 = await googleTTS(text, voice ?? 'ko-KR-Wavenet-C');

    if (!mp3) {
      console.error(`[Worker] Failed to generate TTS for key: ${key}. Skipping job.`);
      // TTS 실패 시 처리를 어떻게 할지 결정해야 함 (예: ready=true로 하고 에러 플래그 추가?)
      // 일단 여기서는 그냥 넘어감 (다음 작업 처리 시도)
      // 또는 실패했음을 기록하고 ready=true로 바꿀 수도 있음
      await supabase.from('tts_queue').update({ ready: true, has_error: true }).eq('key', key); // 예시: 에러 플래그 추가
      continue;
    }

    // 3) Storage에 업로드 시도 (Signed Upload URL 사용)
    const { data: up, error: upErr } = await supabase
    .storage.from('tts-audios')
    .createSignedUploadUrl(key);

  if (upErr) {
    // --- 업로드 URL 생성 실패 처리 ---
    // 파일 중복 오류 코드나 메시지 확인 (Supabase 버전에 따라 다를 수 있음)
    // 예: 'duplicate key value', 'The resource already exists', statusCode 409 등
    const isDuplicateError = upErr.message.includes('duplicate key') ||
                             upErr.message.includes('Duplicate') ||
                             upErr.message.includes('already exists') ||
                             (upErr as any).statusCode === 409; // statusCode를 확인해야 할 수도 있음

    if (isDuplicateError) {
      console.log(`[Worker] File already exists (createSignedUploadUrl check) for key: ${key}. Marking as ready.`);
      // 중복이면 성공 처리 (다른 워커가 이미 업로드 함)
      await supabase.from('tts_queue').update({ ready: true, has_error: false }).eq('key', key);
    } else {
      // 예상치 못한 Storage 오류
      console.error(`[Worker] Error creating signed upload URL for key ${key}:`, upErr);
      // 작업을 실패로 처리하거나 재시도를 위해 ready=false로 남겨둘 수 있음
      // 예: 실패 처리
      await supabase.from('tts_queue').update({ ready: true, has_error: true, error_message: `Failed to create upload URL: ${upErr.message}` }).eq('key', key);
    }
    continue; // 다음 작업으로 넘어감
  }

  // --- 업로드 URL 생성 성공 확인 ---
  // 'up' 객체와 'signedUrl' 속성이 실제로 있는지 명시적으로 확인!
  if (!up || !up.signedUrl) {
      console.error(`[Worker] Failed to get signed upload URL for key ${key} even though no error was reported. Data 'up':`, up);
      // 치명적인 문제일 수 있으므로 작업 실패 처리
      await supabase.from('tts_queue').update({ ready: true, has_error: true, error_message: 'Got null/invalid upload URL data without specific error' }).eq('key', key);
      continue; // 다음 작업으로
  }

    // --- 업로드 URL 생성 성공 -> 실제 업로드 ---
    console.log(`[Worker] Uploading MP3 for key: ${key} using signed URL.`);
    const uploadResponse = await fetch(up.signedUrl, {
      method: 'PUT',
      headers: {
          // Supabase가 생성한 Signed Upload URL은 Content-Type을 자동으로 처리하는 경우가 많음
          // 필요하다면 명시: 'Content-Type': 'audio/mpeg'
      },
      body: mp3
    });
  
    if (!uploadResponse.ok) {
        console.error(`[Worker] Failed to upload MP3 using signed URL for key ${key}. Status: ${uploadResponse.status} ${await uploadResponse.text()}`);
        // 업로드 실패 시 처리 (예: 재시도 로직을 위해 ready=false 유지 또는 에러 플래그 설정)
        // 예: 실패 처리
        await supabase.from('tts_queue').update({ ready: true, has_error: true, error_message: `MP3 Upload Failed: ${uploadResponse.status}` }).eq('key', key);
        continue;
      }
    
      // 4) 업로드 성공 -> 큐 상태 업데이트 (ready=true)
      console.log(`[Worker] Successfully uploaded MP3 for key: ${key}. Marking as ready.`);
      // ... (큐 업데이트 로직) ...
        const { error: updateError } = await supabase
      .from('tts_queue')
      .update({ ready: true, has_error: false }) // 에러 없음을 명시적으로 표시 (선택 사항)
      .eq('key', key);

    if (updateError) {
      console.error(`[Worker] Error updating queue status for key ${key}:`, updateError);
      // DB 업데이트 실패 시 심각한 문제일 수 있음. 로깅 철저히.
    }
    processedCount++;
  }

  console.log(`[Worker] Worker cycle finished. Processed ${processedCount} jobs.`);
  return new Response('done');
});