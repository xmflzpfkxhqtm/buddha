// app/api/tts/route.ts
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

const BUCKET = 'tts-audios';
const VOICE_NAME = 'ko-KR-Neural2-C';
const DAILY_CHAR_CAP = 300_000; // Google Neural2 기준 최악의 경우에도 하루 약 $4.8 상한

interface TTSRequest {
  scripture_id: string;
  line_index: number;
  text: string;
}

function textHash(text: string) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function storagePath(hash: string) {
  return `tts/${hash}.mp3`;
}

function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function checkDailyCap(newChars: number): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('tts_cache')
    .select('text_original')
    .gte('created_at', since);

  if (error) {
    console.error('[API /tts] Daily cap check failed, allowing request:', error.message);
    return true;
  }

  const used = (data ?? []).reduce((sum, row) => sum + (row.text_original?.length ?? 0), 0);
  return used + newChars <= DAILY_CHAR_CAP;
}

async function synthesize(text: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY missing');

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'ko-KR', name: VOICE_NAME },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Google TTS API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  if (!json.audioContent) throw new Error('Google TTS API returned no audioContent');
  return Buffer.from(json.audioContent, 'base64');
}

export async function POST(req: NextRequest) {
  let body: TTSRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scripture_id, line_index, text } = body;
  if (!scripture_id || typeof line_index !== 'number' || !text?.trim()) {
    return NextResponse.json({ error: 'scripture_id, line_index, text가 필요합니다' }, { status: 400 });
  }

  const hash = textHash(text);
  const path = storagePath(hash);

  /* 1) DB 캐시 확인 (scripture_id + line_index + text_hash 조합) */
  const { data: cached, error: cacheError } = await supabase
    .from('tts_cache')
    .select('audio_url')
    .eq('scripture_id', scripture_id)
    .eq('line_index', line_index)
    .eq('text_hash', hash)
    .maybeSingle();

  if (cacheError) {
    console.error('[API /tts] Cache lookup error:', cacheError.message);
  }
  if (cached?.audio_url) {
    return NextResponse.json({ url: cached.audio_url });
  }

  /* 2) 동일 텍스트가 다른 위치에서 이미 합성된 적 있는지 (Storage에 파일이 이미 존재하는지) 확인 → 있으면 재합성 없이 재사용 */
  const { data: existingFile } = await supabase.storage.from(BUCKET).list('tts', { search: `${hash}.mp3` });
  let audioUrl: string;

  if (existingFile && existingFile.length > 0) {
    audioUrl = getPublicUrl(path);
  } else {
    /* 3) 신규 합성 — 일일 상한 확인 후 Google TTS 호출 */
    const withinCap = await checkDailyCap(text.length);
    if (!withinCap) {
      return NextResponse.json({ error: 'Daily TTS synthesis cap reached' }, { status: 429 });
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = await synthesize(text);
    } catch (e) {
      console.error('[API /tts] Synthesis failed:', e);
      return NextResponse.json({ error: 'TTS synthesis failed' }, { status: 502 });
    }

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, audioBuffer, {
      contentType: 'audio/mpeg',
      cacheControl: '31536000', // 콘텐츠 해시 키라 영구 캐시 안전
      upsert: true,
    });

    if (uploadError) {
      console.error('[API /tts] Upload failed:', uploadError.message);
      return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
    }

    audioUrl = getPublicUrl(path);
  }

  /* 4) 캐시 테이블에 기록 (동일 키 upsert) */
  const { error: upsertError } = await supabase.from('tts_cache').upsert(
    {
      scripture_id,
      line_index,
      text_original: text,
      text_hash: hash,
      audio_url: audioUrl,
    },
    { onConflict: 'scripture_id,line_index,text_hash' },
  );

  if (upsertError) {
    console.error('[API /tts] Cache row upsert failed:', upsertError.message);
  }

  return NextResponse.json({ url: audioUrl });
}
