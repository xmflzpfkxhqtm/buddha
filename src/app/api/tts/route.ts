// src/app/api/tts/route.ts
export const runtime = 'nodejs';          // Edge 로 바꾸면 maxDuration 불가
export const dynamic = 'force-dynamic';   // 정적화 방지
export const maxDuration = 60;            // ⬅️ 60 초로 연장 (Hobby 한도)

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

async function fetchWithRetry(
  url: string,
  opts: RequestInit & { timeout?: number; retries?: number } = {},
) {
  const { timeout = 8000, retries = 3, ...rest } = opts;
  for (let i = 0; i < retries; i++) {
    const ctl = new AbortController();
    const tId = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { ...rest, signal: ctl.signal });
      clearTimeout(tId);
      if (res.ok) return res;
      if (res.status >= 500) {            // 5xx 재시도
        await new Promise(r => setTimeout(r, 300 * 2 ** i));
        continue;
      }
      return res;                         // 4xx 는 그대로
    } catch {
      clearTimeout(tId);
      if (i === retries - 1) throw new Error('retry failed');
      await new Promise(r => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw new Error('retry failed');
}

const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_BUCKET     = 'tts-audios';
const GOOGLE_TTS_KEY      = process.env.GOOGLE_TTS_API_KEY!;
const SIGN_EXPIRES        = 60 * 60; // 1 h

export async function POST(req: NextRequest) {
  const { scripture_id, line_index, text } = await req.json();
  if (!text || !scripture_id || line_index == null) {
    return NextResponse.json({ error: '필수 정보 누락' }, { status: 400 });
  }

  const textHash   = crypto.createHash('md5').update(text).digest('hex');
  const fileName   = `${textHash}.mp3`;
  const uploadPath = `tts/${fileName}`;

  /* ──────────────────────────────
     1. Storage HEAD → 캐시 HIT 확인
     ────────────────────────────── */
  const headRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${uploadPath}`,
    {
      method: 'HEAD',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  );

  if (headRes.ok) {
    // 🔒 서명 URL 발급해서 즉시 반환
    const sign = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${uploadPath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGN_EXPIRES }),
      },
    );
    if (sign.ok) {
      const { signedURL } = await sign.json();
      return NextResponse.json({ url: `${SUPABASE_URL}/storage/v1${signedURL}` });
    }
  }

  /* ──────────────────────────────
     2. Google TTS 호출
     ────────────────────────────── */
  console.time('TTS 전체');
  const gRes = await fetchWithRetry(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input:  { text },
        voice:  { languageCode: 'ko-KR', name: 'ko-KR-Standard-C' },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.85, pitch: -5.0 },
      }),
    },
  );

  const raw = await gRes.text();
  if (!gRes.ok) {
    return NextResponse.json({ error: 'TTS 실패', detail: raw.slice(0, 120) }, { status: 502 });
  }
  const { audioContent } = JSON.parse(raw);
  if (!audioContent) {
    return NextResponse.json({ error: 'TTS 응답 오류' }, { status: 500 });
  }

  /* ──────────────────────────────
     3. Storage 업로드
     ────────────────────────────── */
  const upload = await fetchWithRetry(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${uploadPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'audio/mpeg',
        'x-upsert': 'true',
      },
      body: Buffer.from(audioContent, 'base64'),
    },
  );
  if (!upload.ok) {
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }

  /* ──────────────────────────────
     4. 서명 URL 발급 & 캐시 테이블 기록 (fire-and-forget)
     ────────────────────────────── */
  const signRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${SUPABASE_BUCKET}/${uploadPath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SIGN_EXPIRES }),
    },
  );
  if (!signRes.ok) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 502 });
  }
  const { signedURL } = await signRes.json();
  const signedFullURL = `${SUPABASE_URL}/storage/v1${signedURL}`;

  // DB insert → 실패해도 응답엔 영향 X
  fetch(`${SUPABASE_URL}/rest/v1/tts_cache`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({
      scripture_id,
      line_index,
      text_original: text,
      text_hash: textHash,
      audio_url: signedFullURL,
    }),
  }).catch(console.error);

  console.timeEnd('TTS 전체');
  return NextResponse.json({ url: signedFullURL });
}
