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
  /* ① ready=false 한 건 가져오기 */
  const { data: job } = await supabase
    .from('tts_queue')
    .select('*')
    .eq('ready', false)
    .limit(1)
    .maybeSingle();

  if (!job) return new Response('no job');

  const { key, text, voice } = job;

  /* ② Google TTS */
  const mp3 = await googleTTS(text, voice || 'ko-KR-Wavenet-C');

  /* ③ presigned PUT 업로드 */
  const { data: up } = await supabase
    .storage.from('tts-audios')
    .createSignedUploadUrl(key);
  await fetch(up!.signedUrl, { method: 'PUT', body: mp3 });

  /* ④ ready=true 로 업데이트 */
  await supabase.from('tts_queue').update({ ready: true }).eq('key', key);

  return new Response('done');
});
