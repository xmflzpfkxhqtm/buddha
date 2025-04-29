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
  console.log('🚀 실행된 route.ts는 최신 버전입니다');

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

  // ✅ 1. DB에서 캐시 조회
  const { data: existing } = await supabase
    .from('tts_cache')
    .select('audio_url')
    .eq('scripture_id', scripture_id)
    .eq('line_index', line_index)
    .eq('text_hash', textHash)
    .single();

  if (existing && existing.audio_url) {
    return NextResponse.json({ url: existing.audio_url }); // ✅ 캐시 hit
  }


  console.time('TTS 전체');
console.time('1️⃣ Google TTS fetch');

// ✅ 2. Google TTS 호출
console.time('1️⃣ Google TTS fetch');
const gRes = await fetch(
  `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: 'ko-KR',
        name: 'ko-KR-Neural2-C',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.85,
        pitch: -4.0,
      },
    }),
  }
);

const gResText = await gRes.text();

if (!gRes.ok) {
  console.error('❌ Google TTS API 실패', {
    status: gRes.status,
    statusText: gRes.statusText,
    response: gResText.slice(0, 200),
    textTried: text,
  });
  return NextResponse.json({ error: 'TTS API 호출 실패', detail: gResText.slice(0, 100) }, { status: 502 });
}

let gData;
try {
  gData = JSON.parse(gResText);
} catch {
  console.error('❌ Google TTS 응답 파싱 실패 (HTML?):', gResText.slice(0, 200));
  return NextResponse.json({ error: 'TTS 응답 파싱 실패', preview: gResText.slice(0, 100) }, { status: 502 });
}



  if (!gData.audioContent) {
    console.error('❌ Google TTS 응답 이상:', gData);
    return NextResponse.json({ error: 'TTS 실패', detail: gData }, { status: 500 });
  }

  const audioBuffer = Buffer.from(gData.audioContent, 'base64');

  // ✅ 3. Supabase Storage 업로드
  const uploadPath = `tts/${fileName}`;
  const { error: uploadError } = await supabase.storage
  .from('tts-audios')
  .upload(uploadPath, audioBuffer, {
    contentType: 'audio/mpeg',
    upsert: true, // ✅ 충돌 허용하고 덮어쓰기
  });
  console.timeEnd('2️⃣ Supabase upload');
console.time('3️⃣ Supabase DB insert');


  if (uploadError) {
    console.error('❌ Supabase 업로드 실패:', uploadError);
    return NextResponse.json({ error: 'Storage 업로드 실패', detail: uploadError }, { status: 500 });
  }

  const { data: urlData } = supabase
    .storage
    .from('tts-audios')
    .getPublicUrl(uploadPath);

  const audioUrl = urlData.publicUrl;

  // ✅ 4. DB에 캐시 저장

  const insertResult = await supabase.from('tts_cache').insert({
    scripture_id,
    line_index,
    text_original: text,
    text_hash: textHash,
    audio_url: audioUrl,
  });
  
  if (insertResult.error) {
    console.error('❌ DB insert 실패:', insertResult.error);
    return NextResponse.json({ error: 'DB 삽입 실패', detail: insertResult.error }, { status: 500 });
  }
    
  return NextResponse.json({ url: audioUrl }); // ✅ 캐시 miss → 생성 완료
}

