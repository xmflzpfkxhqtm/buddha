export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // App Router의 정적화 방지
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_BUCKET = 'tts-audios';
const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_API_KEY!;
const SIGN_EXPIRES = 60 * 60;        // 서명 URL 유효시간(초) – 1시간

export async function POST(req: NextRequest) {
  const { scripture_id, line_index, text } = await req.json();

  if (!text || !scripture_id || line_index == null) {
    return NextResponse.json({ error: '필수 정보 누락' }, { status: 400 });
  }

  const textHash = crypto.createHash('md5').update(text).digest('hex');
  const fileName = `${textHash}.mp3`;
  const uploadPath = `tts/${fileName}`;
  const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${uploadPath}`;

  // ✅ 1. 캐시 확인
  const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/tts_cache?select=audio_url&scripture_id=eq.${scripture_id}&line_index=eq.${line_index}&text_hash=eq.${textHash}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: 'application/json',
    },
  });

  if (cacheRes.ok) {
    const json = await cacheRes.json();
    if (json.length > 0) {
      return NextResponse.json({ url: json[0].audio_url });
    }
  }

  console.time('TTS 전체');
  console.time('1️⃣ Google TTS fetch');

  // ✅ 2. Google TTS 호출
  const gRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-C' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85, pitch: -5.0 },
    }),
  });

  const gResText = await gRes.text();
  console.timeEnd('1️⃣ Google TTS fetch');

  if (!gRes.ok) {
    return NextResponse.json({ error: 'TTS 실패', detail: gResText.slice(0, 100) }, { status: 502 });
  }

  let gData;
  try {
    gData = JSON.parse(gResText);
  } catch {
    return NextResponse.json({ error: 'TTS 응답 파싱 실패', preview: gResText.slice(0, 100) }, { status: 502 });
  }

  if (!gData.audioContent) {
    return NextResponse.json({ error: 'TTS 응답 오류', detail: gData }, { status: 500 });
  }
  const audioBuffer = Buffer.from(gData.audioContent, 'base64');

 // 3. Storage 업로드 먼저 완료
 const uploadRes = await fetch(
   `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${uploadPath}`,
   {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
       'Content-Type': 'application/octet-stream',
       'x-upsert': 'true',
     },
     body: audioBuffer,
   },
 );

 if (!uploadRes.ok) {
   const errText = await uploadRes.text();
   console.error('❌ Storage 업로드 실패', errText);
   return NextResponse.json({ error: 'upload_failed', detail: errText }, { status: 502 });
 }
  
// ── 3-b. 서명 URL 발급 (버킷이 public 이어도 사용) ──────────────
// ── 3-b. 서명 URL 발급 ─────────────────────────────
const signRes = await fetch(
  `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${encodeURIComponent(uploadPath)}`,
  {
    method: 'POST',                                 // ★ POST!
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn: SIGN_EXPIRES }) // ★ body 로 전달
  }
);

if (!signRes.ok) {
  const err = await signRes.text();
  console.error('❌ signURL 실패', err);
  return NextResponse.json({ error: 'sign_failed', detail: err }, { status: 502 });
}

const { signedURL } = await signRes.json();          // eg. /object/sign/...
const signedFullURL = `${SUPABASE_URL}/storage/v1${signedURL}`;  // ✅





  // ✅ 4. 백그라운드 작업 (업로드 + DB insert)


  // 3-2. DB insert (fetch)
  fetch(`${SUPABASE_URL}/rest/v1/tts_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates', // 중복 insert 무시
    },
    body: JSON.stringify({
      scripture_id,
      line_index,
      text_original: text,
      text_hash: textHash,
      audio_url: signedFullURL,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      console.error('❌ DB insert 실패', await res.text());
      return;
    }
    console.log('✅ DB insert 성공 또는 무시');
  });


  const response = NextResponse.json({ url: signedFullURL });
  console.timeEnd('TTS 전체');
  return response;
}
