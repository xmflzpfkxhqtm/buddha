// supabase/functions/tts_worker/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 환경 변수는 Supabase 프로젝트 설정에 저장
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // ← 이름 통일
);

async function googleTTS(text: string, voice: string) {
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
  const { audioContent } = await res.json();
  return Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
}

serve(async () => {
    for (;;) {                              // ★ while 루프
      const { data: job } = await supabase
        .from('tts_queue').select('*')
        .eq('ready', false).limit(1)
        .maybeSingle();
  
      if (!job) break;                      // 큐가 비면 종료
  
      const { key, text, voice } = job;
      const mp3 = await googleTTS(text, voice ?? 'ko-KR-Wavenet-C');

      const { data: up, error: upErr } = await supabase          // ✏️ 수정
        .storage.from('tts-audios')
        .createSignedUploadUrl(key);

      /* ─── ① 이미 같은 파일이 있을 때 처리 ───────────────── */
      if (upErr?.statusCode === '409' /* AlreadyExists */ || !up) {
        await supabase
          .from('tts_queue')
          .update({ ready: true })
          .eq('key', key);          // 큐만 ready=true 로 바꾸고
        continue;                   // 다음 문장으로
      }

      /* ─── ② 새 파일이면 업로드 ───────────────────────────── */
      await fetch(up.signedUrl, { method: 'PUT', body: mp3 });

      /* ─── ③ 완료 표시 ──────────────────────────────────── */
      await supabase
        .from('tts_queue')
        .update({ ready: true })
        .eq('key', key);

    }
    return new Response('done');
  });
  