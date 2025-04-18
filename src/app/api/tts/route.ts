// app/api/tts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const apiKey = process.env.GOOGLE_TTS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API 키가 없습니다.' }, { status: 500 });
  }

  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
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
  });

  const data = await res.json();

  if (data.audioContent) {
    return NextResponse.json({ audioContent: data.audioContent });
  } else {
    return NextResponse.json({ error: 'TTS 실패', detail: data }, { status: 500 });
  }
}
