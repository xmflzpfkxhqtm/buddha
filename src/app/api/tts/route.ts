export const dynamic = 'force-dynamic'; // ✅ App Router의 빌드 정적화 막기

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🚀 실행된 route.ts는 최신 버전입니다');

export async function POST(req: NextRequest) {
  const { scripture_id, line_index, text } = await req.json();

  if (!text || !scripture_id || line_index == null) {
    return NextResponse.json({ error: '필수 정보 누락' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API 키 없음' }, { status: 500 });
  }

  const textHash = crypto.createHash('md5').update(text).digest('hex');
  const fileName = `${textHash}.mp3`;
  const uploadPath = `tts/${fileName}`;

  // ✅ 1. 캐시 확인
  const { data: existing } = await supabase
    .from('tts_cache')
    .select('audio_url')
    .eq('scripture_id', scripture_id)
    .eq('line_index', line_index)
    .eq('text_hash', textHash)
    .single();

  if (existing?.audio_url) {
    return NextResponse.json({ url: existing.audio_url });
  }

  console.time('TTS 전체');
  console.time('1️⃣ Google TTS fetch');

  // ✅ 2. Google TTS 호출
  const gRes = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-C' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85, pitch: -4.0 },
      }),
    }
  );

  const gResText = await gRes.text();
  console.timeEnd('1️⃣ Google TTS fetch');

  if (!gRes.ok) {
    console.error('❌ Google TTS 실패:', gRes.status, gResText.slice(0, 200));
    return NextResponse.json({ error: 'TTS API 실패', detail: gResText.slice(0, 100) }, { status: 502 });
  }

  let gData;
  try {
    gData = JSON.parse(gResText);
  } catch {
    console.error('❌ JSON 파싱 실패:', gResText.slice(0, 200));
    return NextResponse.json({ error: 'TTS 응답 파싱 실패', preview: gResText.slice(0, 100) }, { status: 502 });
  }

  if (!gData.audioContent) {
    console.error('❌ TTS 응답 이상:', gData);
    return NextResponse.json({ error: 'TTS 실패', detail: gData }, { status: 500 });
  }

  // ✅ 3. URL 미리 생성
  const { data: urlData } = supabase.storage.from('tts-audios').getPublicUrl(uploadPath);
  const audioUrl = urlData?.publicUrl;

  if (!audioUrl) {
    console.error('❌ Supabase URL 생성 실패');
    return NextResponse.json({ error: 'URL 생성 실패' }, { status: 500 });
  }

  // ✅ 4. 바로 응답 먼저 보내기
  const response = NextResponse.json({ url: audioUrl });

  // ✅ 5. 백그라운드에서 Storage 업로드 + DB insert
  const audioBuffer = Buffer.from(gData.audioContent, 'base64');

  supabase.storage
    .from('tts-audios')
    .upload(uploadPath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })
    .then(({ error: uploadError }) => {
      if (uploadError) {
        console.error('❌ Supabase 업로드 실패:', uploadError);
      } else {
        console.log('✅ Supabase 업로드 성공');
      }
    });

  supabase
    .from('tts_cache')
    .insert({
      scripture_id,
      line_index,
      text_original: text,
      text_hash: textHash,
      audio_url: audioUrl,
    })
    .then(({ error }) => {
      if (error && error.code !== '23505') {
        console.error('❌ DB insert 실패:', error);
      } else {
        console.log('✅ DB insert 성공 또는 중복 무시');
      }
    });

  console.timeEnd('TTS 전체');
  return response;
}
